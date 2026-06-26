// ============================================================
// PUBLIC inbound-ring / missed-call telephony webhook.
//
// POST /api/webhooks/telephony/inbound?provider=EXOTEL|KNOWLARITY|MYOPERATOR|IVR
//
// No session. Auth = the active TelephonyConfig.webhookSecret verified via
// timingSafeEqual, FAIL-CLOSED (401 if no secret configured or header missing),
// exactly like the existing /api/webhooks/telephony route. This endpoint is
// PUBLIC and therefore spoofable without the secret — an attacker could spray
// fake numbers to mint leads and burn WhatsApp template quota — so the secret
// gate is mandatory.
//
// Behaviour: parse the inbound ring (caller phone + externalCallId) and
// delegate to handleMissedCallRescue (which owns idempotency, known-vs-unknown
// branching, lead capture, and the instant WhatsApp first-response). Always
// returns 200 on parse success / no-op / redelivery so the provider does not
// retry-storm; 401 only on auth failure; 400 on a bad/missing provider.
//
// This is DELIBERATELY separate from /api/webhooks/telephony, which syncs
// post-call recording/duration onto EXISTING CallLogs and would no_match/ignore
// inbound rings — bolting lead creation onto it would risk minting leads for
// outbound-call status callbacks.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  parseInboundRing,
  type InboundProvider,
} from "@/lib/telephony/inbound-parse";
import { handleMissedCallRescue } from "@/lib/telephony/missed-call-rescue";

const VALID_PROVIDERS: InboundProvider[] = [
  "EXOTEL",
  "KNOWLARITY",
  "MYOPERATOR",
  "IVR",
];

export async function POST(req: NextRequest) {
  try {
    const provider = req.nextUrl.searchParams
      .get("provider")
      ?.toUpperCase() as InboundProvider | undefined;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // IVR is a generic POST with no dedicated provider config row; fall back
    // to ANY active config for the shared webhookSecret. EXOTEL/KNOWLARITY/
    // MYOPERATOR resolve their own active config (same pattern as the existing
    // telephony route).
    const config =
      provider === "IVR"
        ? await prisma.telephonyConfig.findFirst({ where: { isActive: true } })
        : await prisma.telephonyConfig.findFirst({
            where: { provider: provider as any, isActive: true },
          });

    if (!config) {
      return NextResponse.json(
        { error: "No config found for provider" },
        { status: 404 }
      );
    }

    // FAIL-CLOSED secret verification. Unlike the post-call route (which only
    // verifies when a secret is set), this PUBLIC lead-minting endpoint rejects
    // when no secret is configured at all — an unsecured endpoint is spoofable.
    const expected = config.webhookSecret;
    if (!expected) {
      console.error(
        "[Inbound Telephony] No webhookSecret configured — rejecting (fail-closed)."
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("x-webhook-secret") ||
      "";
    const headerValue = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (
      !headerValue ||
      headerValue.length !== expected.length ||
      !timingSafeEqual(Buffer.from(headerValue), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the body (JSON or form-encoded — IVR providers often POST forms).
    const body = await readBody(req);

    const ring = parseInboundRing(provider, config, body);
    if (!ring) {
      console.log(
        "[Inbound Telephony] Could not resolve caller from body:",
        JSON.stringify(body).slice(0, 500)
      );
      // 200 no-op so the provider doesn't retry-storm an unparseable ping.
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Delegate. handleMissedCallRescue NEVER throws and owns idempotency,
    // known/unknown branching, capture, and the instant first-response. It is
    // AWAITED so captureLeadFromExternal + runSpeedToLead complete before the
    // serverless function freezes on the 200 response.
    const result = await handleMissedCallRescue({
      provider,
      externalCallId: ring.externalCallId,
      callerPhone: ring.callerPhone,
      rawStatus: ring.status,
    });

    return NextResponse.json(
      { status: "ok", outcome: result.outcome },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Inbound Telephony] Error:", error);
    // Even on error, return 200 so the provider does not retry-storm; the
    // failure is logged and (best-effort) recorded by handleMissedCallRescue.
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}

/**
 * Read the request body as JSON, falling back to form-encoded parsing for
 * IVR/Exotel providers that POST application/x-www-form-urlencoded.
 */
async function readBody(req: NextRequest): Promise<unknown> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (contentType.includes("application/json")) {
      return await req.json();
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      const obj: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") obj[k] = v;
      }
      return obj;
    }
    // Unknown content-type: try JSON, then text → empty object.
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      const obj: Record<string, string> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  } catch {
    return {};
  }
}
