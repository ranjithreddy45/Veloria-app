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
// Weflux POSTs events here (registered under Weflux → Outbound endpoints). We
// authenticate, ACK 2xx fast (<15s), then process asynchronously — mirroring
// Weflux conversations into the CRM inbox and capturing WhatsApp-first leads.
//
// Two accepted auth methods (either passes):
//   1. Shared token in the URL — ?token=<verifyToken> — matching the token the
//      settings page bakes into the webhook URL (read from the saved config).
//   2. HMAC signature — X-Weflux-Signature: sha256=<hex of `${ts}.${raw}`> with
//      env WEFLUX_ENDPOINT_SECRET, X-Weflux-Timestamp within 300s (anti-replay).
// ============================================================

export const runtime = "nodejs";

function timingSafe(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** The shared token from the saved WhatsApp config (what the settings page puts
 *  in the webhook URL). Reading it here is the fix for the handler reporting
 *  "not configured" even though the settings were saved. */
async function getConfigToken(): Promise<string | null> {
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { verifyToken: true },
    });
    return config?.verifyToken || null;
  } catch {
    return null;
  }
}

// GET — handshake. Some providers verify with a hub.challenge / challenge echo.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const challenge = sp.get("hub.challenge") || sp.get("challenge");
  const token = sp.get("hub.verify_token") || sp.get("token") || "";
  const expected = (await getConfigToken()) || process.env.WEFLUX_ENDPOINT_SECRET || "";
  if (challenge && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }
  // Never 405 — return 200 so a provider's reachability check passes.
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const configToken = await getConfigToken();
  const envSecret = process.env.WEFLUX_ENDPOINT_SECRET || null;

  // Fail closed only if there's genuinely nothing to authenticate against.
  if (!configToken && !envSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Method 1 — shared token (URL query or header).
  const providedToken =
    request.nextUrl.searchParams.get("token") || request.headers.get("x-weflux-token") || "";
  const tokenOk = !!(configToken && providedToken && timingSafe(providedToken, configToken));

  // Method 2 — HMAC signature over `${ts}.${raw}` (body-only fallback).
  let sigOk = false;
  const sig = request.headers.get("x-weflux-signature") || "";
  const ts = request.headers.get("x-weflux-timestamp") || "";
  if (envSecret && sig) {
    const staleTs = ts && Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300;
    if (!staleTs) {
      const expTs = "sha256=" + hmacHex(envSecret, `${ts}.${raw}`);
      const expBody = "sha256=" + hmacHex(envSecret, raw);
      sigOk = timingSafe(sig, expTs) || timingSafe(sig, expBody);
    }
  }

  if (!tokenOk && !sigOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const m = (payload.message ?? payload.data ?? payload) as Record<string, unknown>;
  const contactObj = (payload.contact ?? m.contact ?? null) as Record<string, unknown> | null;

  console.log("[Weflux Webhook]", event || "(no event)", "keys:", Object.keys(payload).join(","));

  const phone = str(
    m.phone ?? m.waid ?? m.wa_id ?? m.to ?? m.from ?? payload.phone ?? contactObj?.phone
  )
    .replace(/^\+/, "")
    .trim();
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
      // WhatsApp-first / imported lead reaches the CRM. Only capture if the
      // number is new — avoids echoing back leads WE pushed to Weflux.
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
      break;
  }
}
