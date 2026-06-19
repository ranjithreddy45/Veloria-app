import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { mapInboundToLead } from "@/lib/ota/map-inbound";
import { logOtaSync } from "@/lib/ota/sync-log";
import { otaInboundPayloadSchema } from "@/schemas/ota.schema";

export const runtime = "nodejs";

// ============================================================
// Simple in-memory IP rate limiter (mirrors api/webforms/[slug])
// ============================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) rateLimitMap.delete(key);
    }
  }
}

// Cap inbound body size (defence against payload-bomb spam).
const MAX_BODY_BYTES = 64 * 1024; // 64 KB

// Timing-safe shared-secret comparison (mirrors facebook-leads HMAC check).
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/ota/inbound/[token]
 *
 * PUBLIC, no-auth. The inboundToken is the access key (fail closed 404 on
 * unknown/inactive). Optional shared-secret header `x-ota-secret` enforced
 * when channel.credentials.inboundSecret is set. Maps the raw payload via the
 * channel's fieldMapping, then routes the lead through the EXISTING
 * captureLeadFromExternal() pipeline (which dedupes on externalId).
 *
 * Returns a minimal { success: true } — never echoes internal data.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    maybeCleanup();
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    const channel = await prisma.otaChannel.findFirst({
      where: { inboundToken: token, isActive: true },
      select: {
        id: true,
        fieldMapping: true,
        defaultSource: true,
        credentials: true,
      },
    });

    // Fail closed — identical 404 for unknown/inactive so nothing leaks.
    if (!channel) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Read raw body (size-capped) once.
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      logOtaSync({
        channelId: channel.id,
        direction: "INBOUND",
        status: "FAILED",
        errorCount: 1,
        message: "Payload exceeds size limit",
      });
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }

    // Optional shared-secret check.
    const creds = (channel.credentials || {}) as Record<string, string>;
    if (creds.inboundSecret) {
      const provided = request.headers.get("x-ota-secret");
      if (!secretMatches(provided, creds.inboundSecret)) {
        logOtaSync({
          channelId: channel.id,
          direction: "INBOUND",
          status: "FAILED",
          errorCount: 1,
          message: "Invalid or missing shared secret",
        });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Parse + validate JSON shape (must be an object).
    let json: unknown;
    try {
      json = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      logOtaSync({
        channelId: channel.id,
        direction: "INBOUND",
        status: "FAILED",
        errorCount: 1,
        message: "Body is not valid JSON",
        payloadRef: rawBody,
      });
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = otaInboundPayloadSchema.safeParse(json);
    if (!parsed.success) {
      logOtaSync({
        channelId: channel.id,
        direction: "INBOUND",
        status: "FAILED",
        errorCount: 1,
        message: "Payload must be a JSON object",
        payloadRef: rawBody,
      });
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    // Map via the channel's fieldMapping.
    const mapped = mapInboundToLead(
      parsed.data,
      channel.fieldMapping,
      channel.defaultSource,
      channel.id
    );

    if (!mapped.ok) {
      // Misconfiguration / unusable payload — log PARTIAL so it's observable
      // rather than silently dropped, but still 200 so aggregators don't retry-storm.
      logOtaSync({
        channelId: channel.id,
        direction: "INBOUND",
        status: "PARTIAL",
        errorCount: 1,
        message: mapped.error,
        payloadRef: rawBody,
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Route through the existing lead pipeline (handles dedupe + assignment + scoring).
    const result = await captureLeadFromExternal(mapped.data);

    if (!result.success) {
      logOtaSync({
        channelId: channel.id,
        direction: "INBOUND",
        status: "FAILED",
        errorCount: 1,
        message: ("error" in result && result.error) || "Lead capture failed",
        payloadRef: rawBody,
      });
      // Still 200: don't leak internal failure detail / invite retry storms.
      return NextResponse.json({ success: true }, { status: 200 });
    }

    logOtaSync({
      channelId: channel.id,
      direction: "INBOUND",
      status: "SUCCESS",
      recordCount: 1,
      message:
        "deduped" in result && result.deduped
          ? "Lead ingested (deduped existing)"
          : "Lead ingested",
      payloadRef: rawBody,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[OTA_INBOUND_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
