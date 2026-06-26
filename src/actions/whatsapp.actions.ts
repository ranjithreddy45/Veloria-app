"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { humanizeWhatsAppContent } from "@/lib/whatsapp-render";
import {
  sendWhatsAppMessageSchema,
  bulkSendWhatsAppSchema,
  type SendWhatsAppMessageInput,
  type BulkSendWhatsAppInput,
} from "@/schemas/whatsapp.schema";
import {
  sendWhatsApp,
  getWhatsAppApiConfig,
  WHATSAPP_TEMPLATES,
} from "@/lib/integrations/whatsapp";

// ============================================================
// Send WhatsApp Message
// ============================================================

export async function sendWhatsAppMessage(data: SendWhatsAppMessageInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:send")) {
      return { success: false as const, error: "You do not have permission to send WhatsApp messages" };
    }

    const parsed = sendWhatsAppMessageSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { contactId, content, templateName, params } = parsed.data;

    // Verify contact exists and get phone number
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    if (!contact.phone) {
      return { success: false as const, error: "Contact does not have a phone number" };
    }

    // Build message content — store a readable line, never a raw JSON params blob.
    const messageContent = content
      ? content
      : templateName
        ? humanizeWhatsAppContent(`[Template: ${templateName}] ${JSON.stringify(params || {})}`)
        : "WhatsApp message";

    // Call the placeholder WhatsApp integration
    const result = await sendWhatsApp({
      to: contact.phone,
      template: templateName || undefined,
      message: content || undefined,
      params: params || undefined,
    });

    if (!result.success) {
      // Capture the provider/error reason so it surfaces in the UI instead of a
      // silent failure (E-3). `result.error` is the Meta Cloud API message or a
      // "not configured" hint from the integration layer.
      const reason = result.error || "Send failed (no reason returned by provider).";
      await prisma.whatsAppMessage.create({
        data: {
          direction: "OUTBOUND",
          content: messageContent,
          templateName: templateName || null,
          status: "FAILED",
          failureReason: reason,
          contactId,
        },
      });

      revalidatePath(`/contacts/${contactId}`);
      revalidatePath("/whatsapp");
      return { success: false as const, error: reason };
    }

    // Create a SENT record
    const message = await prisma.whatsAppMessage.create({
      data: {
        direction: "OUTBOUND",
        content: messageContent,
        templateName: templateName || null,
        status: "SENT",
        whatsappId: result.messageId || null,
        contactId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "sent_whatsapp",
      entityType: "WhatsAppMessage",
      entityId: message.id,
      changes: {
        contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        templateName: templateName || null,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/whatsapp");
    return { success: true as const, data: serialize(message) };
  } catch (error) {
    console.error("[SEND_WHATSAPP_ERROR]", error);
    return { success: false as const, error: "Failed to send WhatsApp message" };
  }
}

// ============================================================
// Get Conversation (all messages for a contact)
// ============================================================

export async function getConversation(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false as const, error: "You do not have permission to view WhatsApp messages" };
    }

    if (!contactId) {
      return { success: false as const, error: "Contact ID is required" };
    }

    const messages = await prisma.whatsAppMessage.findMany({
      where: { contactId },
      orderBy: { sentAt: "desc" },
    });

    return { success: true as const, data: serialize(messages) };
  } catch (error) {
    console.error("[GET_CONVERSATION_ERROR]", error);
    return { success: false as const, error: "Failed to fetch conversation" };
  }
}

// ============================================================
// Get WhatsApp Templates
// ============================================================

export async function getWhatsAppTemplates() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false as const, error: "You do not have permission to view WhatsApp templates" };
    }

    return {
      success: true as const,
      data: WHATSAPP_TEMPLATES.map((t) => ({
        name: t.name,
        label: t.label,
        params: [...t.params],
      })),
    };
  } catch (error) {
    console.error("[GET_WHATSAPP_TEMPLATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch templates" };
  }
}

// ============================================================
// Get Conversations List (for Inbox)
// ============================================================

export interface ConversationSummary {
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: "INBOUND" | "OUTBOUND";
  lastStatus: string;
  messageCount: number;
}

export async function getConversationsList(search?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false as const, error: "You do not have permission to view WhatsApp messages" };
    }

    // Find contacts that have WhatsApp messages
    const contacts = await prisma.contact.findMany({
      where: {
        whatsappMessages: { some: {} },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappMessages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            content: true,
            sentAt: true,
            direction: true,
            status: true,
          },
        },
        _count: {
          select: { whatsappMessages: true },
        },
      },
      orderBy: {
        whatsappMessages: { _count: "desc" },
      },
    });

    // Sort by latest message time
    const conversations: ConversationSummary[] = contacts
      .map((c) => {
        const lastMsg = c.whatsappMessages[0];
        // Render a friendly preview — older rows may store the raw
        // `[Template: …] {json}` payload; humanize it (E-4). Falls back to a
        // clean "Template Label" if the JSON is missing/unparseable.
        const preview = humanizeWhatsAppContent(lastMsg?.content);
        return {
          contactId: c.id,
          contactName: `${c.firstName} ${c.lastName ?? ""}`.trim(),
          contactPhone: c.phone ?? "",
          lastMessage: preview.slice(0, 100),
          lastMessageAt: lastMsg?.sentAt?.toISOString() ?? "",
          lastDirection: (lastMsg?.direction ?? "OUTBOUND") as "INBOUND" | "OUTBOUND",
          lastStatus: lastMsg?.status ?? "SENT",
          messageCount: c._count.whatsappMessages,
        };
      })
      .sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

    return { success: true as const, data: conversations };
  } catch (error) {
    console.error("[GET_CONVERSATIONS_LIST_ERROR]", error);
    return { success: false as const, error: "Failed to fetch conversations" };
  }
}

// ============================================================
// Get WhatsApp Stats
// ============================================================

export interface WhatsAppStatsData {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
  deliveryRate: number;
  readRate: number;
  configured: boolean;
}

export async function getWhatsAppStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false as const, error: "You do not have permission to view WhatsApp stats" };
    }

    // Tallies derive directly from the actual message rows' statuses, so the
    // Sent/Delivered/Read/Failed cards always reconcile with what's in the DB
    // (E-3). `total` is the true row count, not a sum that could drift.
    const [counts, total, config] = await Promise.all([
      prisma.whatsAppMessage.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.whatsAppMessage.count(),
      getWhatsAppApiConfig(),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of counts) {
      statusMap[row.status] = row._count.id;
    }

    const sent = statusMap["SENT"] ?? 0;
    const delivered = statusMap["DELIVERED"] ?? 0;
    const read = statusMap["READ"] ?? 0;
    const failed = statusMap["FAILED"] ?? 0;
    // Rates are computed only over messages that have reached a terminal state
    // (DELIVERED, READ, or FAILED). SENT is an intermediate state in the
    // WhatsApp lifecycle (SENT -> DELIVERED -> READ) whose final outcome is
    // not yet known, so including it in the denominator would understate the
    // true delivery/read rate. Excluding it gives an honest picture and avoids
    // NaN (the guard returns 0 when no message has reached a terminal state).
    const terminalTotal = delivered + read + failed;

    const stats: WhatsAppStatsData = {
      sent,
      delivered,
      read,
      failed,
      total,
      deliveryRate: terminalTotal > 0 ? Math.round(((delivered + read) / terminalTotal) * 100) : 0,
      readRate: terminalTotal > 0 ? Math.round((read / terminalTotal) * 100) : 0,
      configured: config !== null,
    };

    return { success: true as const, data: stats };
  } catch (error) {
    console.error("[GET_WHATSAPP_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch stats" };
  }
}

// ============================================================
// Bulk Send WhatsApp
// ============================================================

export async function bulkSendWhatsApp(data: BulkSendWhatsAppInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "whatsapp:send")) {
      return { success: false as const, error: "You do not have permission to send WhatsApp messages" };
    }

    const parsed = bulkSendWhatsAppSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { contactIds, templateName, params } = parsed.data;

    // Fetch contacts with phone numbers
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    const skippedNoPhone: string[] = [];

    for (const contact of contacts) {
      if (!contact.phone) {
        skippedNoPhone.push(`${contact.firstName} ${contact.lastName ?? ""}`.trim());
        failedCount++;
        continue;
      }

      try {
        const result = await sendWhatsApp({
          to: contact.phone,
          template: templateName,
          params: params || undefined,
        });

        const messageContent = humanizeWhatsAppContent(`[Template: ${templateName}] ${JSON.stringify(params || {})}`);

        await prisma.whatsAppMessage.create({
          data: {
            direction: "OUTBOUND",
            content: messageContent,
            templateName,
            status: result.success ? "SENT" : "FAILED",
            whatsappId: result.messageId || null,
            failureReason: result.success
              ? null
              : result.error || "Send failed (no reason returned by provider).",
            contactId: contact.id,
          },
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        // Record the message as FAILED with the thrown reason so the count
        // reconciles with actual rows (E-3) rather than vanishing.
        const reason = e instanceof Error ? e.message : "Unexpected send error.";
        try {
          await prisma.whatsAppMessage.create({
            data: {
              direction: "OUTBOUND",
              content: humanizeWhatsAppContent(
                `[Template: ${templateName}] ${JSON.stringify(params || {})}`
              ),
              templateName,
              status: "FAILED",
              failureReason: reason,
              contactId: contact.id,
            },
          });
        } catch {
          // If even the row write fails, still tally it so counts stay honest.
        }
        failedCount++;
      }
    }

    logActivity({
      userId: session.user.id as string,
      action: "bulk_sent_whatsapp",
      entityType: "WhatsAppMessage",
      entityId: "bulk",
      changes: {
        templateName,
        totalContacts: contactIds.length,
        sent: sentCount,
        failed: failedCount,
        skippedNoPhone: skippedNoPhone.length,
      },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/contacts");

    return {
      success: true as const,
      data: {
        sent: sentCount,
        failed: failedCount,
        total: contactIds.length,
        skippedNoPhone,
      },
    };
  } catch (error) {
    console.error("[BULK_SEND_WHATSAPP_ERROR]", error);
    return { success: false as const, error: "Failed to send bulk WhatsApp messages" };
  }
}
