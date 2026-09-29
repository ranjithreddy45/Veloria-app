// ============================================================
// AiSensy → CRM sink (the real implementation of AiSensySink).
// ------------------------------------------------------------
// Every write here goes through the SAME primitives the Weflux webhook already
// calls (recordInboundWhatsAppMessage / recordOutboundWhatsAppMessage /
// applyWhatsAppStatusUpdate) and the same observability table
// (WhatsAppInboundEvent, viewable at /settings/integrations/whatsapp-inbound).
// There is deliberately NO parallel inbox, contact matcher or lead capturer:
// switching provider must not change where a customer's reply lands.
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  applyWhatsAppStatusUpdate,
  recordInboundWhatsAppMessage,
  recordOutboundWhatsAppMessage,
} from "@/lib/whatsapp/inbound";
import { previewText } from "@/lib/whatsapp/inbound-capture";
import type {
  AiSensySink,
  InboundLogEntry,
  WhatsAppSettingsForAiSensy,
} from "./sink";
import type {
  ContactEvent,
  InboundMessageEvent,
  OutboundEchoEvent,
  StatusEvent,
} from "./webhook";

export const aisensySink: AiSensySink = {
  async loadSettings(): Promise<WhatsAppSettingsForAiSensy | null> {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: {
        provider: true,
        aisensyProjectId: true,
        aisensyApiPassword: true,
        aisensyApiEndpoint: true,
        aisensyWebhookSecret: true,
        aisensyVerifyToken: true,
      },
    });
    if (!config) return null;
    return {
      provider: config.provider,
      projectId: config.aisensyProjectId ?? "",
      apiPassword: config.aisensyApiPassword ?? "",
      baseUrl: config.aisensyApiEndpoint,
      webhookSecret: config.aisensyWebhookSecret ?? "",
      verifyToken: config.aisensyVerifyToken ?? "",
    };
  },

  /**
   * Atomic claim, not a lookup: we INSERT the receipt and read the unique
   * violation as "someone else already has it". A SELECT-then-INSERT would let
   * two concurrent deliveries — or two of the four pm2 workers — both store the
   * same customer message.
   */
  async alreadyProcessed(notificationId: string): Promise<boolean> {
    try {
      await prisma.whatsAppWebhookReceipt.create({
        data: { provider: "AISENSY", notificationId },
      });
      return false;
    } catch (e) {
      // P2002 = unique violation on notificationId → already claimed.
      if ((e as { code?: string })?.code === "P2002") return true;
      throw e;
    }
  },

  async markProcessed(notificationId: string): Promise<void> {
    await prisma.whatsAppWebhookReceipt.updateMany({
      where: { notificationId },
      data: { processedAt: new Date() },
    });
  },

  /** Best-effort, like the rest of the capture layer: logging must never change
   *  a webhook's response code, so this swallows its own failures. */
  async log(entry: InboundLogEntry): Promise<void> {
    try {
      await prisma.whatsAppInboundEvent.create({
        data: {
          provider: "AISENSY",
          signatureValid: entry.authOk,
          eventType: entry.topic || entry.kind,
          fromPhone: entry.phone ?? null,
          messageId: entry.notificationId || null,
          textPreview: previewText(entry.error ?? null),
          parsedOk: entry.parseOk,
          parseError: entry.error ?? null,
          matchedContactId: entry.matchedContactId ?? null,
          handled: entry.parseOk && !entry.error,
          rawBody: entry.rawBody,
          headers: JSON.stringify(entry.headers),
        },
      });
    } catch (e) {
      console.error("[aisensy-sink] inbound log write failed", e);
    }
  },

  async onInbound(e: InboundMessageEvent): Promise<string | null> {
    if (!e.phone) return null;
    // A tapped button arrives as messageType BUTTON_REPLY with the button's
    // TITLE as text; AiSensy's payload carries no reply id, so `interactive` is
    // left null rather than inventing one. Effect: the WhatsApp-catalog funnel
    // (which keys off buttonReplyId) stays text-only on this provider.
    const r = await recordInboundWhatsAppMessage({
      from: e.phone,
      waId: e.waMessageId ?? e.messageId ?? null,
      text: e.text || `[${e.messageType.toLowerCase()} message]`,
      interactive: null,
    });
    return r.contactId;
  },

  async onOutboundEcho(e: OutboundEchoEvent): Promise<void> {
    if (!e.phone) return;
    // Deduped inside recordOutboundWhatsAppMessage on the provider id, so a
    // message WE sent (already stored by sendWhatsApp) is not mirrored twice.
    await recordOutboundWhatsAppMessage({
      to: e.phone,
      waId: e.waMessageId ?? e.messageId ?? null,
      text: e.text || `[${e.messageType.toLowerCase()} message]`,
      templateName: e.templateName ?? null,
      status: "sent",
    });
  },

  async onStatus(e: StatusEvent): Promise<void> {
    if (e.status === "UNKNOWN") return;
    // Our stored id is whatever the send call returned; try the wamid first,
    // then AiSensy's own id, because either can be the one on the row.
    await applyWhatsAppStatusUpdate(e.waMessageId ?? null, e.status);
    if (e.messageId && e.messageId !== e.waMessageId) {
      await applyWhatsAppStatusUpdate(e.messageId, e.status);
    }
  },

  /**
   * A contact created or updated inside the AiSensy app is NOT an enquiry — it
   * can be a bulk import or a campaign audience row. So we only note the match
   * and never capture a lead from it; real enquiries arrive as inbound messages.
   */
  async onContact(_e: ContactEvent): Promise<void> {
    return;
  },
};
