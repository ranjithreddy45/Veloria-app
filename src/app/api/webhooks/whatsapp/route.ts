import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  recordInboundWhatsAppMessage,
  applyWhatsAppStatusUpdate,
} from "@/lib/whatsapp/inbound";

// ============================================================
// WhatsApp Webhook — Meta Cloud API Webhook Handler
// ============================================================
// GET: Verify webhook subscription (Meta requires this)
// POST: Receive incoming messages + delivery status updates

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
  try {
    const body = await request.text();

    // Read app secret from DB config, fallback to env var
    const config = await getActiveConfig();
    const appSecret = config?.appSecret || process.env.WHATSAPP_APP_SECRET;

    // FAIL CLOSED: we can't trust an inbound webhook we can't verify. Reject if
    // no secret is configured, and require a valid signature otherwise.
    if (!appSecret) {
      console.error("[WhatsApp Webhook] No app secret configured — rejecting unverifiable inbound.");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const expectedSignature =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    // Timing-safe compare.
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn("[WhatsApp Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const payload = JSON.parse(body);

    // Parse Meta webhook payload structure:
    // { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages, statuses } }] }] }
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle incoming messages — funnel through the shared, provider-
        // agnostic inbound handler so Meta and WATI behave identically.
        if (value?.messages) {
          for (const message of value.messages) {
            const br = message.interactive?.button_reply;
            const lr = message.interactive?.list_reply;
            const text =
              br?.title || lr?.title || message.text?.body || "[Media message]";
            await recordInboundWhatsAppMessage({
              from: message.from,
              waId: message.id,
              text,
              interactive: message.interactive
                ? { buttonReplyId: br?.id, listReplyId: lr?.id }
                : null,
            });
          }
        }

        // Handle status updates (sent → delivered → read → failed)
        if (value?.statuses) {
          for (const status of value.statuses) {
            await applyWhatsAppStatusUpdate(status.id, status.status);
          }
        }
      }
    }

    // Always return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Webhook Error]", error);
    // Return 200 even on error to prevent retries
    return NextResponse.json({ success: true });
  }
}
