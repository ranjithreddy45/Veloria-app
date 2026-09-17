// ============================================================
// Inbound WhatsApp pipeline — the provider-specific PARSE + DISPATCH step,
// factored out of the two webhook routes so that
//   (a) both routes stay thin (auth → capture → ack), and
//   (b) an admin can REPLAY a captured payload through exactly this code path
//       from /settings/integrations/whatsapp-inbound after a parser fix.
// Each processor returns a summary the capture layer stores next to the raw
// body (event type, sender, message id, matched contact, whether we did any
// work). `handled: false` + a parseError is the signal the log exists for: the
// provider sent a shape we do not (yet) understand.
//
// Downstream behaviour (recordInbound…, status updates, lead capture, opt-out)
// is unchanged — only the return value was added.
// ============================================================

import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import {
  recordInboundWhatsAppMessage,
  recordOutboundWhatsAppMessage,
  applyWhatsAppStatusUpdate,
} from "@/lib/whatsapp/inbound";
import type { InboundProvider } from "@/lib/whatsapp/inbound-capture";

type AnyRec = Record<string, unknown>;

export interface InboundEventSummary {
  eventType: string | null;
  fromPhone: string | null;
  messageId: string | null;
  textPreview: string | null;
  matchedContactId: string | null;
  /** True when the payload reached a branch that did work (stored a message,
   *  applied a status, captured a lead, opted a contact out). */
  handled: boolean;
  /** Soft problem while parsing (unknown event type, no phone, …). Distinct
   *  from a thrown error, which the route records instead. */
  parseError: string | null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function rec(v: unknown): AnyRec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyRec) : null;
}

function arr(v: unknown): AnyRec[] {
  return Array.isArray(v) ? v.filter((x): x is AnyRec => !!x && typeof x === "object") : [];
}

function base(partial: Partial<InboundEventSummary>): InboundEventSummary {
  return {
    eventType: null,
    fromPhone: null,
    messageId: null,
    textPreview: null,
    matchedContactId: null,
    handled: false,
    parseError: null,
    ...partial,
  };
}

// ============================================================
// Weflux (events registered under Weflux → Outbound endpoints)
// ============================================================

export async function processWefluxEvent(payload: AnyRec): Promise<InboundEventSummary> {
  const event = str(payload.event ?? payload.type).toLowerCase();
  const m = (rec(payload.message) ?? rec(payload.data) ?? payload) as AnyRec;
  const contactObj = rec(payload.contact) ?? rec(m.contact);

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
    (textField && typeof textField === "object" ? str((textField as AnyRec).body) : "") ||
    "[message]";
  const status = str(m.status ?? payload.status);
  const templateName = str(m.template ?? m.template_name ?? payload.template) || null;

  const out = base({
    eventType: event || null,
    fromPhone: phone || null,
    messageId: waId,
    textPreview: text !== "[message]" ? text : null,
  });

  switch (event) {
    case "message.received":
    case "message_received": {
      if (phone) {
        const r = await recordInboundWhatsAppMessage({ from: phone, waId, text, interactive: null });
        out.matchedContactId = r.contactId;
        out.handled = true;
        if (r.outcome === "CAPTURE_FAILED") out.parseError = "Unknown number and lead capture failed";
      } else {
        out.parseError = "message.received without a phone number in the payload";
      }
      break;
    }
    case "message.sent":
    case "message_sent": {
      if (phone) {
        const r = await recordOutboundWhatsAppMessage({
          to: phone,
          waId,
          text,
          templateName,
          status: status || "sent",
        });
        out.matchedContactId = r.contactId;
        out.handled = true;
        if (r.outcome === "NO_CONTACT") out.parseError = "No CRM contact for this number — outbound mirror skipped";
      } else {
        out.parseError = "message.sent without a phone number in the payload";
      }
      break;
    }
    case "message.status":
    case "message_status": {
      await applyWhatsAppStatusUpdate(waId, status);
      out.handled = !!(waId && status);
      if (!out.handled) out.parseError = "message.status without message id or status";
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
        out.matchedContactId = contact?.id ?? null;
        out.handled = true;
      } else {
        out.parseError = "opt-out without a phone number in the payload";
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
        if (existing) {
          out.matchedContactId = existing.id;
        } else {
          const capture = await captureLeadFromExternal({
            name: str(contactObj?.name ?? m.name ?? payload.name) || phone,
            phone: `+${phone}`,
            source: "whatsapp",
            message: text !== "[message]" ? text : undefined,
          });
          if (capture?.success) out.matchedContactId = capture.contactId ?? null;
          else out.parseError = "lead.created: lead capture failed";
        }
        out.handled = true;
      } else {
        out.parseError = "lead.created without a phone number in the payload";
      }
      break;
    }
    default: {
      out.parseError = `Unrecognised event type "${event || "(none)"}" — top-level keys: ${
        Object.keys(payload).join(", ") || "(none)"
      }`;
      break;
    }
  }

  return out;
}

// ============================================================
// Meta Cloud API
// { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages, statuses } }] }] }
// ============================================================

export async function processMetaWebhookPayload(payload: AnyRec): Promise<InboundEventSummary> {
  const out = base({});
  const kinds = new Set<string>();
  let fieldName: string | null = null;

  // Load our own business phone number ID so we can detect outbound messages
  // sent directly from the WhatsApp Business app (rep replies from phone/WhatsApp Web).
  // Meta sends these as normal messages where value.metadata.phone_number_id matches ours
  // and message.from is our own number (not the customer's).
  let ownPhoneNumberId: string | null = null;
  try {
    const cfg = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { phoneNumberId: true },
    });
    ownPhoneNumberId = cfg?.phoneNumberId || null;
  } catch { /* non-fatal */ }

  for (const entry of arr(payload.entry)) {
    for (const change of arr(entry.changes)) {
      fieldName = fieldName ?? (str(change.field) || null);
      const value = rec(change.value);

      // Check if this change is from our own phone number ID (outbound mirror).
      const metaPhoneNumberId = str(rec(value?.metadata)?.phone_number_id || "");
      const isOwnPhoneChange = ownPhoneNumberId && metaPhoneNumberId === ownPhoneNumberId;

      // Incoming messages — funnel through the shared, provider-agnostic
      // inbound handler so Meta and Weflux behave identically.
      for (const message of arr(value?.messages)) {
        kinds.add("messages");
        const interactive = rec(message.interactive);
        const br = rec(interactive?.button_reply);
        const lr = rec(interactive?.list_reply);
        const text =
          str(br?.title) || str(lr?.title) || str(rec(message.text)?.body) || "[Media message]";
        const from = str(message.from).replace(/\D/g, "").trim();
        const waId = str(message.id) || null;
        if (!from) {
          out.parseError = "message without a `from` number";
          continue;
        }

        // Detect outbound: message is from our own phone number ID.
        // In this case `value.contacts[0].wa_id` is the customer's number.
        if (isOwnPhoneChange) {
          kinds.add("outbound_mirror");
          const contacts = arr(value?.contacts);
          const customerPhone = str(contacts[0]?.wa_id ?? "").trim();
          if (customerPhone) {
            const r = await recordOutboundWhatsAppMessage({
              to: customerPhone,
              waId,
              text,
              status: "sent",
            });
            out.handled = true;
            if (!out.fromPhone) {
              out.fromPhone = customerPhone;
              out.messageId = waId;
              out.textPreview = text;
              out.matchedContactId = r.contactId;
            }
          }
          continue;
        }

        const r = await recordInboundWhatsAppMessage({
          from,
          waId,
          text,
          interactive: interactive
            ? { buttonReplyId: str(br?.id) || null, listReplyId: str(lr?.id) || null }
            : null,
        });
        out.handled = true;
        // The list shows one line per webhook; summarise the first message.
        if (!out.fromPhone) {
          out.fromPhone = from;
          out.messageId = waId;
          out.textPreview = text;
          out.matchedContactId = r.contactId;
          if (r.outcome === "CAPTURE_FAILED") out.parseError = "Unknown number and lead capture failed";
        }
      }

      // Delivery status updates (sent → delivered → read → failed)
      for (const status of arr(value?.statuses)) {
        kinds.add("statuses");
        await applyWhatsAppStatusUpdate(str(status.id) || null, str(status.status) || null);
        out.handled = true;
        if (!out.messageId) out.messageId = str(status.id) || null;
      }
    }
  }

  out.eventType =
    kinds.size > 0 ? [...kinds].join("+") : fieldName || str(payload.object) || null;
  if (!out.handled && !out.parseError) {
    out.parseError = "No messages or statuses found in payload";
  }
  return out;
}

/** Dispatcher used by the admin Replay action. */
export async function processInboundPayload(
  provider: InboundProvider,
  payload: AnyRec
): Promise<InboundEventSummary> {
  return provider === "META" ? processMetaWebhookPayload(payload) : processWefluxEvent(payload);
}
