import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  recordInboundWhatsAppMessage,
  applyWhatsAppStatusUpdate,
} from "@/lib/whatsapp/inbound";

// ============================================================
// WATI Webhook — wati.io WhatsApp inbound + delivery-status handler
// ------------------------------------------------------------
// WATI does NOT sign payloads (no HMAC). We secure the endpoint with a shared
// secret placed in the webhook URL as ?token=<secret>, verified constant-time
// against the active WhatsApp config's verifyToken (or WATI_WEBHOOK_SECRET).
// Configure the webhook in WATI as:
//   https://app.theveloriagrand.com/api/webhooks/wati?token=<your secret>
// Incoming messages + statuses are funneled through the shared inbound handler,
// so they behave exactly like Meta inbound (same inbox rows, same lead capture).
// ============================================================

export const runtime = "nodejs";

async function getConfiguredSecret(): Promise<string | null> {
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { verifyToken: true },
    });
    return config?.verifyToken || process.env.WATI_WEBHOOK_SECRET || null;
  } catch {
    return process.env.WATI_WEBHOOK_SECRET || null;
  }
}

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    // ---- Authenticate the caller via the shared URL/header secret ----
    const expected = await getConfiguredSecret();
    if (!expected) {
      // Fail closed — never accept an unverifiable inbound webhook.
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const provided =
      request.nextUrl.searchParams.get("token") ||
      request.headers.get("x-wati-token") ||
      "";
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const eventType = String(payload.eventType ?? "");
    const owner = payload.owner === true; // true = message WE sent (echo/status)
    const waId =
      (payload.whatsappMessageId as string) || (payload.id as string) || null;
    // Customer's WhatsApp number (WATI sends digits, no "+"). Normalise off a "+".
    const from = String(payload.waId ?? payload.waid ?? "").replace(/^\+/, "").trim();

    // Interactive replies (button / list taps).
    const buttonReply = (payload.interactiveButtonReply ??
      payload.buttonReply ??
      null) as Record<string, unknown> | null;
    const listReply = (payload.listReply ?? null) as Record<string, unknown> | null;

    const type = String(payload.type ?? "");
    const text =
      (buttonReply && ((buttonReply.text as string) || (buttonReply.title as string))) ||
      (listReply && ((listReply.title as string) || (listReply.text as string))) ||
      (payload.text as string) ||
      (type && type !== "text" ? `[${type}]` : "") ||
      "[Media message]";
    const hasContent = !!(payload.text || buttonReply || listReply || type);

    // Derive a delivery status from either an explicit field or the event name
    // (WATI fires e.g. "sentMessageDELIVERED" / "sentMessageREAD", and
    // "templateMessageSent" / "sessionMessageSent" to confirm our own sends).
    let statusString: string | undefined =
      (payload.statusString as string) || undefined;
    const m = /^sentMessage([A-Za-z]+)$/.exec(eventType);
    if (m) statusString = m[1];
    else if (/MessageSent$/i.test(eventType)) statusString = "SENT";

    if (!owner && from && hasContent && !statusString) {
      // Inbound customer message (eventType is "message", "newContactMessage-
      // Received", or occasionally omitted — all handled the same way).
      await recordInboundWhatsAppMessage({
        from,
        waId,
        text: String(text),
        interactive:
          buttonReply || listReply
            ? {
                buttonReplyId: (buttonReply?.id as string) ?? null,
                listReplyId: (listReply?.id as string) ?? null,
              }
            : null,
      });
    } else if (statusString) {
      // Delivery-status update for a message we sent.
      await applyWhatsAppStatusUpdate(waId, statusString);
    }

    // Always 200 so WATI does not retry something we've already handled.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WATI Webhook] error:", error);
    return NextResponse.json({ success: true });
  }
}
