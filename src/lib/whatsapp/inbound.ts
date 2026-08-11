// ============================================================
// Inbound WhatsApp handling — provider-agnostic
// ------------------------------------------------------------
// Both the Meta webhook and the weflux webhook funnel every incoming message and
// delivery-status update through here, so inbound behaviour (contact linking,
// dedupe, lead capture, cadence-stop, known-contact ack, intent classification,
// catalog funnel) can never drift between providers. Never throws — the caller
// always answers 2xx so the provider does not retry a message we already stored.
// ============================================================

import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { handleInboundReply } from "@/lib/lead-pipeline";

export interface InboundWhatsAppMessage {
  /** Sender's WhatsApp number: digits, country code, no "+" (e.g. 919876543210). */
  from: string;
  /** Provider message id (Meta wamid / weflux message id) — dedupe + status key. */
  waId?: string | null;
  /** Message text, or the title of a tapped button/list option. */
  text: string;
  /** Set when the customer tapped an interactive option (drives the catalog funnel). */
  interactive?: { buttonReplyId?: string | null; listReplyId?: string | null } | null;
}

const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
  // weflux / provider variants
  send: "SENT",
  seen: "READ",
  replied: "READ",
  undelivered: "FAILED",
  error: "FAILED",
};

/**
 * Map a provider delivery-status string onto our enum and update every message
 * row carrying that provider id. Case-insensitive; unknown statuses are ignored.
 */
export async function applyWhatsAppStatusUpdate(
  waId: string | null | undefined,
  providerStatus: string | null | undefined
): Promise<void> {
  if (!waId || !providerStatus) return;
  const mapped = STATUS_MAP[providerStatus.trim().toLowerCase()];
  if (!mapped) return;
  await prisma.whatsAppMessage.updateMany({
    where: { whatsappId: waId },
    data: { status: mapped },
  });
}

/**
 * Record ONE inbound WhatsApp message. Links it to the matching Contact (or
 * captures a brand-new lead for an unknown number), dedupes on the provider
 * message id, and fires the downstream engagement hooks. Best-effort throughout.
 */
export async function recordInboundWhatsAppMessage(
  msg: InboundWhatsAppMessage
): Promise<void> {
  const from = msg.from;
  const waId = msg.waId || null;
  const text = msg.text || "[Media message]";
  const buttonReplyId = msg.interactive?.buttonReplyId || undefined;
  const listReplyId = msg.interactive?.listReplyId || undefined;
  const isInteractive = !!(buttonReplyId || listReplyId);

  // Match a stored contact across the phone formats we persist (E.164 with "+",
  // bare digits, and a 91-prefixed variant), plus the alternate-phone field.
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: from },
        { phone: `+${from}` },
        { phone: `+91${from}` },
        { alternatePhone: from },
        { alternatePhone: `+${from}` },
      ],
    },
    select: { id: true },
  });

  if (contact) {
    // Dedupe: a provider redelivery of the same message must not double-store.
    const existing = waId
      ? await prisma.whatsAppMessage.findFirst({ where: { whatsappId: waId } })
      : null;
    if (existing) return;

    const created = await prisma.whatsAppMessage.create({
      data: {
        direction: "INBOUND",
        content: text,
        status: "DELIVERED",
        whatsappId: waId,
        contactId: contact.id,
      },
    });

    // Prospect engaged → stop any running cadences for them.
    await handleInboundReply(contact.id);

    // Known-contact ack + smart re-route + lead re-wake. Guarded so a redelivery
    // never re-acks (it can't reach here — deduped above), and never throws.
    try {
      const { handleKnownContactAck } = await import("@/lib/inbound/known-contact-ack");
      await handleKnownContactAck(contact.id, {
        inboundText: text,
        inboundMessageId: waId ?? undefined,
      });
    } catch (e) {
      console.error("[WhatsApp inbound] known-contact-ack error:", e);
    }

    // Fire-and-forget intent classification (boost + ping on READY_TO_BUY).
    import("@/lib/ai/intent-stamp")
      .then((m) =>
        m.stampMessageIntent({
          text,
          whatsappMessageId: created.id,
          contactId: contact.id,
        })
      )
      .catch(() => {});

    // Advance any in-flight catalog funnel on a button/list tap.
    if (isInteractive) {
      try {
        const { advanceCatalogSession } = await import("@/lib/whatsapp/catalog-engine");
        await advanceCatalogSession({
          phone: from,
          contactId: contact.id,
          buttonReplyId,
          listReplyId,
          inboundText: text,
        });
      } catch (e) {
        console.error("[WhatsApp inbound] catalog advance error:", e);
      }
    }

    console.log(`[WhatsApp inbound] message from ${from} → contact ${contact.id}`);
  } else {
    // Unknown number → a brand-new inbound lead (WhatsApp is the #1 inbound
    // channel in India; never drop it). Capture creates the contact + lead,
    // scores, assigns, SLA-stamps, and auto-replies.
    const capture = await captureLeadFromExternal({
      name: from,
      phone: from.startsWith("+") ? from : `+${from}`,
      source: "whatsapp",
      message: text,
    });
    console.log(`[WhatsApp inbound] captured new lead from unknown number: ${from}`);

    if (capture?.success) {
      try {
        const { runCatalogFirstInbound } = await import("@/lib/whatsapp/catalog-engine");
        await runCatalogFirstInbound({
          phone: from,
          contactId: capture.contactId,
          leadId: capture.leadId,
          messageId: waId ?? undefined,
          inboundText: text,
        });
      } catch (e) {
        console.error("[WhatsApp inbound] catalog first-inbound error:", e);
      }
    }
  }
}

/** Match a stored contact across the phone formats we persist. */
async function findContactByPhone(phone: string): Promise<{ id: string } | null> {
  const from = (phone || "").replace(/^\+/, "");
  if (!from) return null;
  return prisma.contact.findFirst({
    where: {
      OR: [
        { phone: from },
        { phone: `+${from}` },
        { phone: `+91${from}` },
        { alternatePhone: from },
        { alternatePhone: `+${from}` },
      ],
    },
    select: { id: true },
  });
}

/**
 * Record an OUTBOUND WhatsApp message that Weflux sent (campaign, automation, or
 * an agent typing in Weflux) so the CRM inbox mirrors Weflux. Deduped on the
 * provider message id; skips numbers we have no contact for.
 */
export async function recordOutboundWhatsAppMessage(msg: {
  to: string;
  waId?: string | null;
  text: string;
  templateName?: string | null;
  status?: string | null;
}): Promise<void> {
  const contact = await findContactByPhone(msg.to);
  if (!contact) return;
  const waId = msg.waId || null;
  if (waId) {
    const existing = await prisma.whatsAppMessage.findFirst({ where: { whatsappId: waId } });
    if (existing) return;
  }
  const status = msg.status ? STATUS_MAP[msg.status.trim().toLowerCase()] || "SENT" : "SENT";
  await prisma.whatsAppMessage.create({
    data: {
      direction: "OUTBOUND",
      content: msg.text || "[message]",
      templateName: msg.templateName || null,
      status,
      whatsappId: waId,
      contactId: contact.id,
    },
  });
}
