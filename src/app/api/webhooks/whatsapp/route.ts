import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processMetaWebhookPayload } from "@/lib/whatsapp/inbound-pipeline";
import {
  captureInboundEvent,
  updateInboundEvent,
  errorMessage,
} from "@/lib/whatsapp/inbound-capture";

// ============================================================
// WhatsApp Webhook — Meta Cloud API Webhook Handler
// ============================================================
// GET: Verify webhook subscription (Meta requires this)
// POST: Receive incoming messages + delivery status updates
//
// OBSERVABILITY: every POST is persisted as a WhatsAppInboundEvent BEFORE
// signature verification or parsing (best-effort — logging never changes a
// response code), then updated with the verification result, the parsed
// summary and any error. Viewer + replay: /settings/integrations/whatsapp-inbound.
// Parse/dispatch lives in @/lib/whatsapp/inbound-pipeline so replay runs the
// same code this route does.

export const runtime = "nodejs";

// ============================================================
// Helper: Get active WhatsApp config from DB
// ============================================================

async function getActiveConfig() {
  try {
    return await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: {
        appSecret: true,
        verifyToken: true,
      },
    });
  } catch {
    return null;
  }
}

// ============================================================
// GET — Webhook Verification
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Read verify token from DB config, fallback to env var
  const config = await getActiveConfig();
  const verifyToken =
    config?.verifyToken ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "veloria_whatsapp_verify";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WhatsApp Webhook] Verification failed — invalid token");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ============================================================
// POST — Receive Messages & Status Updates
// ============================================================

export async function POST(request: NextRequest) {
  let captureId: string | null = null;
  try {
    const body = await request.text();

    // Persist FIRST — before signature check, before JSON.parse — so a payload
    // we reject or cannot read is still on record with its (redacted) headers.
    captureId = await captureInboundEvent({
      provider: "META",
      rawBody: body,
      headers: request.headers,
      url: request.nextUrl,
    });

    // Read app secret from DB config, fallback to env var
    const config = await getActiveConfig();
    const appSecret = config?.appSecret || process.env.WHATSAPP_APP_SECRET;

    // FAIL CLOSED: we can't trust an inbound webhook we can't verify. Reject if
    // no secret is configured, and require a valid signature otherwise.
    if (!appSecret) {
      console.error("[WhatsApp Webhook] No app secret configured — rejecting unverifiable inbound.");
      await updateInboundEvent(captureId, {
        parseError: "Webhook not configured — no Meta app secret saved",
      });
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      await updateInboundEvent(captureId, {
        signatureValid: false,
        parseError: "Missing X-Hub-Signature-256 header",
      });
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const expectedSignature =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    // Timing-safe compare.
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn("[WhatsApp Webhook] Invalid signature");
      await updateInboundEvent(captureId, {
        signatureValid: false,
        parseError: "X-Hub-Signature-256 did not match the saved app secret",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    await updateInboundEvent(captureId, { signatureValid: true });

    const payload = JSON.parse(body) as Record<string, unknown>;

    // Parse Meta webhook payload structure and funnel every message / status
    // through the shared, provider-agnostic inbound handler.
    const summary = await processMetaWebhookPayload(payload);
    await updateInboundEvent(captureId, { parsedOk: true, ...summary });

    // Always return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Webhook Error]", error);
    await updateInboundEvent(captureId, { parseError: `Processing threw: ${errorMessage(error)}` });
    // Return 200 even on error to prevent retries
    return NextResponse.json({ success: true });
  }
}
