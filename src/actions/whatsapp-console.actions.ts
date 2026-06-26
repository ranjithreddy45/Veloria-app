"use server";

// ============================================================
// WhatsApp Reply Console — server actions (AI co-pilot + SLA-stamped send).
// ------------------------------------------------------------
// Additive layer on top of the existing /whatsapp inbox. Three actions:
//   (a) getConsoleThread(contactId)   — thread + 24h session-window state +
//                                        contact/lead headline.    [whatsapp:read]
//   (b) generateReplyDrafts(contactId)— 1-3 AI reply variants, persisted to
//                                        WhatsAppReplyDraft.        [whatsapp:reply]
//   (c) sendReplyVariant(input)       — reuse sendWhatsAppMessage for the Meta
//                                        send, THEN logCommunication (stamps the
//                                        speed-to-lead SLA) THEN stamp the draft.
//                                                                   [whatsapp:send]
//
// Reuses (never forks): getConversation, sendWhatsAppMessage, logCommunication,
// humanizeWhatsAppContent, computeSessionWindow, generateWhatsAppReplyVariants.
//
// All returns are Result<T> ({ success, error?, data? }) with serialize() over
// Date/Decimal. No money. No public surface — every action gates at the top.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { humanizeWhatsAppContent } from "@/lib/whatsapp-render";
import { getConversation, sendWhatsAppMessage } from "@/actions/whatsapp.actions";
import { logCommunication } from "@/actions/communication.actions";
import { computeSessionWindow } from "@/lib/whatsapp/session-window";
import {
  generateWhatsAppReplyVariants,
  type ReplyVariant,
  type CopilotRecentMessage,
} from "@/lib/ai/whatsapp-copilot";
import {
  generateReplyDraftsSchema,
  sendReplyVariantSchema,
  type GenerateReplyDraftsInput,
  type SendReplyVariantInput,
} from "@/schemas/whatsapp-console.schema";

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

interface ThreadMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  templateName: string | null;
  status: string;
  sentAt: string;
  contactId: string;
}

/** Format a date for IST display, e.g. "14 Feb 2026". Null-safe. */
function formatEventDateIST(date?: Date | null): string | null {
  if (!date) return null;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(t));
  } catch {
    return null;
  }
}

/**
 * Resolve the most relevant (latest, not soft-deleted) lead for a contact for
 * co-pilot headline + SLA linkage. Returns a non-sensitive subset only.
 */
async function getLeadHeadlineForContact(contactId: string) {
  const lead = await prisma.lead.findFirst({
    where: { contactId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventType: true,
      eventDate: true,
      slot: true,
    },
  });
  return lead;
}

// ============================================================
// (a) getConsoleThread — thread + session-window + headline
// ============================================================

export async function getConsoleThread(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return {
        success: false as const,
        error: "You do not have permission to view WhatsApp messages",
      };
    }

    if (!contactId) {
      return { success: false as const, error: "Contact ID is required" };
    }

    // Reuse the existing thread loader (already gated whatsapp:read; messages
    // come newest-first / serialized).
    const conversationResult = await getConversation(contactId);
    if (!conversationResult.success) {
      return {
        success: false as const,
        error: conversationResult.error || "Failed to load conversation",
      };
    }
    const messages = (conversationResult.data ?? []) as ThreadMessage[];

    const [contact, sessionWindow, lead] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      computeSessionWindow(contactId),
      getLeadHeadlineForContact(contactId),
    ]);

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    const headline = {
      contactName: `${contact.firstName} ${contact.lastName ?? ""}`.trim(),
      contactPhone: contact.phone ?? "",
      leadId: lead?.id ?? null,
      eventType: lead?.eventType ?? null,
      eventDateLabel: formatEventDateIST(lead?.eventDate ?? null),
      slotLabel: lead?.slot ?? null,
    };

    return {
      success: true as const,
      data: serialize({
        messages,
        sessionWindow,
        headline,
      }),
    };
  } catch (error) {
    console.error("[GET_CONSOLE_THREAD_ERROR]", error);
    return { success: false as const, error: "Failed to load console thread" };
  }
}

// ============================================================
// (b) generateReplyDrafts — AI co-pilot variants → WhatsAppReplyDraft
// ============================================================

export async function generateReplyDrafts(input: GenerateReplyDraftsInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:reply")) {
      return {
        success: false as const,
        error: "You do not have permission to use the WhatsApp co-pilot",
      };
    }

    const parsed = generateReplyDraftsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const { contactId } = parsed.data;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Latest messages (newest-first) + session window + lead headline.
    const [recent, sessionWindow, lead] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where: { contactId },
        orderBy: { sentAt: "desc" },
        take: 12,
        select: { direction: true, content: true, templateName: true },
      }),
      computeSessionWindow(contactId),
      getLeadHeadlineForContact(contactId),
    ]);

    // Oldest→newest, humanized for the prompt.
    const recentMessages: CopilotRecentMessage[] = [...recent]
      .reverse()
      .map((m) => ({
        direction: m.direction as "INBOUND" | "OUTBOUND",
        text: humanizeWhatsAppContent(m.content),
      }))
      .filter((m) => m.text.trim().length > 0);

    // Never throws — degrades to deterministic fallback variants.
    const { variants, model } = await generateWhatsAppReplyVariants({
      contactId,
      leadId: lead?.id ?? null,
      recentMessages,
      sessionOpen: sessionWindow.sessionOpen,
      lead: {
        firstName: contact.firstName,
        eventType: lead?.eventType ?? null,
        eventDateLabel: formatEventDateIST(lead?.eventDate ?? null),
        slotLabel: lead?.slot ?? null,
      },
    });

    // Persist the ephemeral draft with a session snapshot for one-shot send
    // bookkeeping (sentVariantIdx / sentMessageId / sentAt set on send).
    const draft = await prisma.whatsAppReplyDraft.create({
      data: {
        contactId,
        leadId: lead?.id ?? null,
        sessionOpen: sessionWindow.sessionOpen,
        sessionExpiresAt: sessionWindow.sessionExpiresAt,
        variants: variants as unknown as Prisma.InputJsonValue,
        model,
        createdById: (session.user.id as string) ?? null,
      },
      select: { id: true },
    });

    return {
      success: true as const,
      data: serialize({
        draftId: draft.id,
        variants,
        model,
        sessionOpen: sessionWindow.sessionOpen,
        sessionExpiresAt: sessionWindow.sessionExpiresAt,
      }),
    };
  } catch (error) {
    console.error("[GENERATE_REPLY_DRAFTS_ERROR]", error);
    return { success: false as const, error: "Failed to generate reply drafts" };
  }
}

// ============================================================
// (c) sendReplyVariant — Meta send → SLA stamp → draft bookkeeping
// ============================================================

export async function sendReplyVariant(input: SendReplyVariantInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // sendWhatsAppMessage re-checks whatsapp:send, but gate here too so we never
    // touch the draft / DB without permission.
    if (!hasPermission(session.user.role as string, "whatsapp:send")) {
      return {
        success: false as const,
        error: "You do not have permission to send WhatsApp messages",
      };
    }

    const parsed = sendReplyVariantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { contactId, draftId, variantIdx, text, templateName, params } =
      parsed.data;
    const trimmedText = text?.trim() || undefined;
    const resolvedTemplate = templateName?.trim() || undefined;

    // One-shot guard: reject re-send of an already-sent draft (double-click /
    // retry idempotency). Load the draft up front when supplied.
    let draft: { id: string; sentAt: Date | null } | null = null;
    if (draftId) {
      draft = await prisma.whatsAppReplyDraft.findUnique({
        where: { id: draftId },
        select: { id: true, sentAt: true },
      });
      if (!draft) {
        return { success: false as const, error: "Draft not found" };
      }
      if (draft.sentAt) {
        return {
          success: false as const,
          error: "This draft has already been sent",
        };
      }
    }

    // Order of side-effects matters (spec risk): send the Meta message FIRST,
    // and only stamp the SLA + draft AFTER a successful send — so a failed send
    // never falsely stops the speed-to-lead clock.
    const sendResult = await sendWhatsAppMessage({
      contactId,
      content: trimmedText,
      templateName: resolvedTemplate,
      params: params || undefined,
    });

    if (!sendResult.success) {
      // sendWhatsAppMessage already recorded a FAILED WhatsAppMessage row with
      // the provider reason. Surface it; do NOT stamp the SLA or the draft.
      return {
        success: false as const,
        error: sendResult.error || "Failed to send WhatsApp message",
      };
    }

    const sentMessage = sendResult.data as { id?: string } | undefined;
    const sentMessageId = sentMessage?.id ?? null;

    // SLA stamp: a rep WhatsApp reply = first response. logCommunication
    // (type=WHATSAPP, direction=OUTBOUND) calls stampLeadResponded internally to
    // stop the speed-to-lead clock. Best-effort: if it fails AFTER a successful
    // send, the message is still delivered — log and continue, don't roll back.
    try {
      const slaContent =
        trimmedText ||
        humanizeWhatsAppContent(
          `[Template: ${resolvedTemplate}] ${JSON.stringify(params || {})}`
        );
      const slaMetadata: Record<string, string> = {
        channel: "whatsapp_console",
        source: "copilot",
      };
      if (draftId) slaMetadata.draftId = draftId;
      if (resolvedTemplate) slaMetadata.templateName = resolvedTemplate;
      if (sentMessageId) slaMetadata.whatsAppMessageId = sentMessageId;
      const slaResult = await logCommunication({
        type: "WHATSAPP",
        direction: "OUTBOUND",
        content: slaContent,
        contactId,
        metadata: slaMetadata,
      });
      if (!slaResult.success) {
        console.error(
          "[SEND_REPLY_VARIANT] SLA stamp failed post-send (continuing):",
          slaResult.error
        );
      }
    } catch (slaErr) {
      console.error(
        "[SEND_REPLY_VARIANT] SLA stamp threw post-send (continuing):",
        slaErr
      );
    }

    // Draft bookkeeping: record which variant was sent + the message id. Guarded
    // by sentAt=null so a concurrent retry can't double-stamp.
    if (draft) {
      try {
        await prisma.whatsAppReplyDraft.updateMany({
          where: { id: draft.id, sentAt: null },
          data: {
            sentVariantIdx: variantIdx ?? 0,
            sentMessageId,
            sentAt: new Date(),
          },
        });
      } catch (draftErr) {
        console.error(
          "[SEND_REPLY_VARIANT] Draft stamp failed post-send (continuing):",
          draftErr
        );
      }
    }

    await logActivity({
      userId: session.user.id as string,
      action: "sent_whatsapp_console_reply",
      entityType: "WhatsAppMessage",
      entityId: sentMessageId ?? "unknown",
      changes: {
        contactId,
        draftId: draftId || null,
        variantIdx: variantIdx ?? null,
        templateName: resolvedTemplate || null,
        mode: resolvedTemplate ? "template" : "freetext",
      },
    });

    return {
      success: true as const,
      data: serialize({
        messageId: sentMessageId,
        draftId: draft?.id ?? null,
        sentVariantIdx: draft ? variantIdx ?? 0 : null,
      }),
    };
  } catch (error) {
    console.error("[SEND_REPLY_VARIANT_ERROR]", error);
    return { success: false as const, error: "Failed to send reply" };
  }
}
