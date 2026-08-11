import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  recordInboundWhatsAppMessage,
  applyWhatsAppStatusUpdate,
} from "@/lib/whatsapp/inbound";

// ============================================================
// Weflux Webhook — weflux WhatsApp inbound + delivery-status handler
// ------------------------------------------------------------
// Secured with a shared secret in the webhook URL as ?token=<secret>, verified
// constant-time against the active WhatsApp config's verifyToken (or the
// WEFLUX_WEBHOOK_SECRET env var). Configure the webhook in weflux as:
//   https://app.theveloriagrand.com/api/webhooks/weflux?token=<your secret>
//
// NOTE: weflux also *signs* its webhooks. Once the "Signature verification"
// header + scheme is confirmed from the weflux docs, add HMAC verification on
// top of the URL token below. Payload field names are parsed defensively (the
// exact "Event types" shape is pending confirmation) — the top-level keys of
// the first events are logged so the mapping can be locked precisely.
// ============================================================

export const runtime = "nodejs";

async function getConfiguredSecret(): Promise<string | null> {
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { verifyToken: true },
    });
    return config?.verifyToken || process.env.WEFLUX_WEBHOOK_SECRET || null;
  } catch {
    return process.env.WEFLUX_WEBHOOK_SECRET || null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function POST(request: NextRequest) {
  try {
    // ---- Authenticate via the shared URL/header secret ----
    const expected = await getConfiguredSecret();
    if (!expected) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const provided =
      request.nextUrl.searchParams.get("token") ||
      request.headers.get("x-weflux-token") ||
      "";
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Log the shape (keys only, no message content) so the exact field mapping
    // can be confirmed from the first real events without leaking PII.
    console.log("[Weflux Webhook] event keys:", Object.keys(payload).join(","));

    // Some providers nest the message under `data`/`message`/`entry`.
    const inner = (payload.data ??
      payload.message ??
      payload.entry ??
      payload) as Record<string, unknown>;

    const eventType = str(
      payload.event ?? payload.type ?? payload.eventType ?? inner.event ?? inner.type
    ).toLowerCase();

    // Sender phone (digits, no "+"), across likely field names.
    const contactObj = (inner.contact ?? payload.contact ?? null) as Record<string, unknown> | null;
    const from = str(
      inner.from ??
        payload.from ??
        inner.waId ??
        inner.wa_id ??
        inner.phone ??
        payload.phone ??
        contactObj?.phone ??
        contactObj?.wa_id ??
        inner.sender
    )
      .replace(/^\+/, "")
      .trim();

    const waId =
      str(inner.id ?? payload.id ?? inner.messageId ?? inner.message_id ?? inner.wamid) || null;

    // Message text across likely shapes (string or { body }).
    const textField = inner.text ?? payload.text ?? inner.body ?? inner.message;
    const text =
      (typeof textField === "string" && textField) ||
      (typeof textField === "object" && textField
        ? str((textField as Record<string, unknown>).body)
        : "") ||
      "[Media message]";

    // Delivery status, if this is a status event.
    const statusRaw = str(inner.status ?? payload.status).toLowerCase();
    const isStatusEvent =
      !!statusRaw ||
      /status|delivered|read|sent|failed/.test(eventType);
    const isInboundEvent =
      /receiv|inbound|message\.in|incoming/.test(eventType) ||
      (eventType === "message" && !statusRaw);

    if (isInboundEvent && from) {
      await recordInboundWhatsAppMessage({
        from,
        waId,
        text,
        interactive: null,
      });
    } else if (isStatusEvent) {
      const s = statusRaw || eventType.replace(/^.*\.(\w+)$/, "$1");
      await applyWhatsAppStatusUpdate(waId, s);
    } else if (from && text && text !== "[Media message]") {
      // Fallback: an event we couldn't classify but that carries a real inbound
      // message — capture it rather than drop a customer message.
      await recordInboundWhatsAppMessage({ from, waId, text, interactive: null });
    }

    // Always 200 so weflux does not retry something we've handled.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Weflux Webhook] error:", error);
    return NextResponse.json({ success: true });
  }
}
