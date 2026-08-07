import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { parseAttributionFromRequest } from "@/lib/attribution";
import { prisma } from "@/lib/prisma";
import { firstUsable } from "@/lib/webhook-field";

export const runtime = "nodejs";

/**
 * GET /api/webhooks/facebook-leads
 * Hub verification for Facebook webhook subscription
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify token from DB config, else env var. NO hardcoded fallback — an
  // unconfigured webhook must fail closed, not accept a publicly-known default.
  let verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "";
  try {
    const config = await prisma.leadCaptureConfig.findFirst({
      where: { platform: "FACEBOOK", isActive: true },
    });
    if (config) {
      const creds = config.credentials as Record<string, string>;
      if (creds.verifyToken) verifyToken = creds.verifyToken;
    }
  } catch {
    // Fall back to env var
  }

  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    console.log("[FacebookLeads] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST /api/webhooks/facebook-leads
 * Receive Facebook Lead Ads webhooks.
 *
 * Security: verifies `X-Hub-Signature-256` HMAC-SHA256 against the raw body
 * using the Facebook App Secret. Set FACEBOOK_APP_SECRET in env, or store
 * `appSecret` in the LeadCaptureConfig credentials JSON.
 */
// Facebook drops a lead entirely if we do not answer inside its timeout, so
// this must never be killed mid-write. The slow side effects of capture are
// no longer awaited (see lead-capture.ts); this is the backstop.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Read raw body once for signature verification + JSON parse
    const rawBody = await request.text();

    // Load credentials (DB takes precedence over env)
    let pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
    let appSecret = process.env.FACEBOOK_APP_SECRET || "";
    let configId: string | null = null;
    try {
      const config = await prisma.leadCaptureConfig.findFirst({
        where: { platform: "FACEBOOK", isActive: true },
      });
      if (config) {
        configId = config.id;
        const creds = config.credentials as Record<string, string>;
        if (creds.accessToken) pageAccessToken = creds.accessToken;
        if (creds.appSecret) appSecret = creds.appSecret;
      }
    } catch {
      // Fall back to env vars
    }

    // ----------------------------------------------------------------
    // HMAC signature verification
    // ----------------------------------------------------------------
    // Facebook signs the raw POST body with the app secret. Drop any
    // request that lacks a valid signature (when secret is configured).
    if (appSecret) {
      const signature = request.headers.get("x-hub-signature-256");
      if (!signature || !signature.startsWith("sha256=")) {
        console.warn("[FacebookLeads] Missing signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      // Use timing-safe comparison to prevent timing attacks
      const signatureBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);
      if (
        signatureBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(signatureBuf, expectedBuf)
      ) {
        console.warn("[FacebookLeads] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      // Fail closed: without an app secret we cannot trust the request
      // in production. Refuse rather than silently accept fake leads.
      console.warn(
        "[FacebookLeads] FACEBOOK_APP_SECRET not configured — refusing webhook"
      );
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 503 }
      );
    }

    const body = JSON.parse(rawBody);

    // Verify it's a page event with leadgen changes
    if (body.object !== "page") {
      return NextResponse.json({ error: "Not a page event" }, { status: 400 });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;

          if (leadgenId) {
            const leadData = {
              name: "Facebook Lead",
              email: "",
              phone: "",
            };

            if (pageAccessToken) {
              try {
                const fbRes = await fetch(
                  `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`
                );
                if (fbRes.ok) {
                  const fbData = await fbRes.json();
                  const fieldData = fbData.field_data || [];

                  for (const field of fieldData) {
                    // firstUsable skips [], [null] and [false] — an unfilled
                    // field — and accepts a phone returned as a number. Taking
                    // values[0] raw could hand a non-string straight to the
                    // capture pipeline.
                    const value = firstUsable(field?.values);
                    if (!value) continue;
                    const fieldName = String(field?.name ?? "").toLowerCase();
                    if (fieldName === "full_name" || fieldName === "name") {
                      leadData.name = value;
                    } else if (fieldName.includes("email")) {
                      leadData.email = value;
                    } else if (fieldName.includes("phone")) {
                      leadData.phone = value;
                    }
                  }
                }
              } catch (err) {
                console.error("[FacebookLeads] Failed to fetch lead from FB:", err);
              }
            }

            await captureLeadFromExternal({
              name: leadData.name,
              email: leadData.email || undefined,
              phone: leadData.phone || undefined,
              source: "facebook_ads",
              message: `Facebook Lead Ad (ID: ${leadgenId})`,
              externalId: leadgenId ? `fb:${leadgenId}` : undefined,
              attribution: await parseAttributionFromRequest(request, body),
            });

            // Update lastSyncAt
            if (configId) {
              try {
                await prisma.leadCaptureConfig.update({
                  where: { id: configId },
                  data: { lastSyncAt: new Date() },
                });
              } catch {
                // Non-critical
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[FacebookLeads] Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
