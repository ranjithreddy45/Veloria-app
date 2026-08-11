import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  recordInboundWhatsAppMessage,
  recordOutboundWhatsAppMessage,
  applyWhatsAppStatusUpdate,
} from "@/lib/whatsapp/inbound";
import { captureLeadFromExternal } from "@/lib/lead-capture";

// ============================================================
// Weflux → CRM webhook (Inbox sync)
// ------------------------------------------------------------
// Weflux POSTs signed events to this endpoint (registered under Weflux →
// Outbound endpoints). We verify the signature, ACK 2xx fast (<15s), then
// process asynchronously — mirroring Weflux conversations into the CRM inbox
// and capturing WhatsApp-first leads.
//
// Signature (per the Weflux spec):
//   X-Weflux-Timestamp: <unix seconds>   (reject > 300s skew — anti-replay)
//   X-Weflux-Signature: sha256=<hex of HMAC-SHA256(`${ts}.${raw}`, secret)>
// Secret from env WEFLUX_ENDPOINT_SECRET (the wfx_sub_… endpoint signing secret).
// ============================================================

export const runtime = "nodejs";

function timingSafe(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function POST(request: NextRequest) {
  const secret = process.env.WEFLUX_ENDPOINT_SECRET;
  if (!secret) {
    // Fail closed — never accept an unverifiable inbound webhook.
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const ts = request.headers.get("x-weflux-timestamp") || "";
  const sig = request.headers.get("x-weflux-signature") || ""; // "sha256=<hex>"

  // Anti-replay: reject a signature more than 5 minutes off.
  const nowSec = Math.floor(Date.now() / 1000);
  if (ts && Math.abs(nowSec - Number(ts)) > 300) {
    return NextResponse.json({ error: "Stale timestamp" }, { status: 401 });
  }

  // Signature is over `${ts}.${raw}` (the documented scheme). If a delivery
  // arrives without a timestamp, fall back to signing the raw body alone.
  const expectedWithTs = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`, "utf8").digest("hex");
  const expectedBodyOnly = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  if (!sig || (!timingSafe(sig, expectedWithTs) && !timingSafe(sig, expectedBodyOnly))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ACK immediately; process after the response is sent (15s Weflux timeout).
  after(async () => {
    try {
      await processWefluxEvent(payload);
    } catch (e) {
      console.error("[Weflux Webhook] processing error:", e);
    }
  });

  return NextResponse.json({ ok: true });
}

async function processWefluxEvent(payload: Record<string, unknown>): Promise<void> {
  const event = str(payload.event ?? payload.type).toLowerCase();
  // Message/contact data may sit at the top level or nested under message/data.
  const m = (payload.message ?? payload.data ?? payload) as Record<string, unknown>;
  const contactObj = (payload.contact ?? m.contact ?? null) as Record<string, unknown> | null;

  // Log the shape (keys only — no PII) so exact field names can be confirmed.
  console.log("[Weflux Webhook]", event || "(no event)", "keys:", Object.keys(payload).join(","));

  const phone = str(
    m.phone ?? m.waid ?? m.wa_id ?? m.to ?? m.from ?? payload.phone ?? contactObj?.phone
  ).replace(/^\+/, "").trim();
  const waId = str(m.id ?? m.message_id ?? m.wamid ?? payload.message_id) || null;
  const textField = m.text ?? m.body ?? m.content ?? payload.text;
  const text =
    (typeof textField === "string" && textField) ||
    (textField && typeof textField === "object" ? str((textField as Record<string, unknown>).body) : "") ||
    "[message]";
  const status = str(m.status ?? payload.status);
  const templateName = str(m.template ?? m.template_name ?? payload.template) || null;

  switch (event) {
    case "message.received":
    case "message_received": {
      if (phone) await recordInboundWhatsAppMessage({ from: phone, waId, text, interactive: null });
      break;
    }
    case "message.sent":
    case "message_sent": {
      if (phone) await recordOutboundWhatsAppMessage({ to: phone, waId, text, templateName, status: status || "sent" });
      break;
    }
    case "message.status":
    case "message_status": {
      await applyWhatsAppStatusUpdate(waId, status);
      break;
    }
    case "contact.opted_out":
    case "unsubscribe": {
      // Honour the opt-out in the CRM so a later export can't re-import someone
      // who said no. Tag the contact (idempotent); best-effort.
      if (phone) {
        const contact = await prisma.contact.findFirst({
          where: { OR: [{ phone }, { phone: `+${phone}` }, { phone: `+91${phone}` }] },
          select: { id: true, tags: true },
        });
        if (contact && !contact.tags.includes("opted-out")) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: { set: [...contact.tags, "opted-out"] } },
          });
        }
      }
      break;
    }
    case "lead.created":
    case "new_lead":
    case "lead_created": {
      // A lead that started on WhatsApp (or arrived in Weflux from a sheet /
      // import) reaches the CRM here. Only capture if we don't already have the
      // number — avoids echoing back the leads WE pushed to Weflux.
      if (phone) {
        const existing = await prisma.contact.findFirst({
          where: { OR: [{ phone }, { phone: `+${phone}` }, { phone: `+91${phone}` }] },
          select: { id: true },
        });
        if (!existing) {
          await captureLeadFromExternal({
            name: str(contactObj?.name ?? m.name ?? payload.name) || phone,
            phone: `+${phone}`,
            source: "whatsapp",
            message: text !== "[message]" ? text : undefined,
          });
        }
      }
      break;
    }
    default:
      // contact.updated, deal.stage_changed, etc. — logged above; no-op for now.
      break;
  }
}
