"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  sendWhatsAppMessageSchema,
  bulkSendWhatsAppSchema,
  type SendWhatsAppMessageInput,
  type BulkSendWhatsAppInput,
} from "@/schemas/whatsapp.schema";
import {
  sendWhatsApp,
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

    // Build message content
    const messageContent =
      content || `[Template: ${templateName}] ${JSON.stringify(params || {})}`;

    // Call the placeholder WhatsApp integration
    const result = await sendWhatsApp({
      to: contact.phone,
      template: templateName || undefined,
      message: content || undefined,
      params: params || undefined,
    });

    if (!result.success) {
      // Create a FAILED record
      await prisma.whatsAppMessage.create({
        data: {
          direction: "OUTBOUND",
          content: messageContent,
          templateName: templateName || null,
          status: "FAILED",
          contactId,
        },
      });

      return { success: false as const, error: "Failed to send WhatsApp message" };
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
        return {
          contactId: c.id,
          contactName: `${c.firstName} ${c.lastName ?? ""}`.trim(),
          contactPhone: c.phone ?? "",
          lastMessage: lastMsg?.content?.slice(0, 100) ?? "",
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

    const counts = await prisma.whatsAppMessage.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    for (const row of counts) {
      statusMap[row.status] = row._count.id;
    }

    const sent = statusMap["SENT"] ?? 0;
    const delivered = statusMap["DELIVERED"] ?? 0;
    const read = statusMap["READ"] ?? 0;
    const failed = statusMap["FAILED"] ?? 0;
    const total = sent + delivered + read + failed;
    const successTotal = sent + delivered + read;

    const stats: WhatsAppStatsData = {
      sent,
      delivered,
      read,
      failed,
      total,
      deliveryRate: successTotal > 0 ? Math.round(((delivered + read) / successTotal) * 100) : 0,
      readRate: successTotal > 0 ? Math.round((read / successTotal) * 100) : 0,
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

        const messageContent = `[Template: ${templateName}] ${JSON.stringify(params || {})}`;

        await prisma.whatsAppMessage.create({
          data: {
            direction: "OUTBOUND",
            content: messageContent,
            templateName,
            status: result.success ? "SENT" : "FAILED",
            whatsappId: result.messageId || null,
            contactId: contact.id,
          },
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
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
