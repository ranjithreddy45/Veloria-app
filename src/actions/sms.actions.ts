"use server";

// ============================================================
// SMS Server Actions
// ============================================================
// RBAC mirrors the WhatsApp actions shape:
//   sms:manage → send (to contact or raw number)
//   sms:read   → list messages + stats
// Dates are serialized to ISO at the client boundary via serialize().

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { sendSms, isSmsConfigured } from "@/lib/integrations/sms";

const SMS_PATH = "/crm/sms";

// ============================================================
// Send SMS to a contact (looks up the contact's phone)
// ============================================================

export async function sendSmsToContact({
  contactId,
  body,
}: {
  contactId: string;
  body: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "sms:manage")) {
      return { success: false as const, error: "You do not have permission to send SMS" };
    }

    if (!contactId) {
      return { success: false as const, error: "Contact is required" };
    }
    if (!body?.trim()) {
      return { success: false as const, error: "Message body is required" };
    }

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

    // sendSms writes the SmsMessage row itself (SENT or FAILED).
    const result = await sendSms(contact.phone, body.trim(), { contactId });

    if (!result.success) {
      revalidatePath(SMS_PATH);
      return { success: false as const, error: result.error || "Send failed" };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "sent_sms",
      entityType: "SmsMessage",
      entityId: result.providerId || contactId,
      changes: {
        contactId,
        contactName: `${contact.firstName} ${contact.lastName ?? ""}`.trim(),
      },
    });

    revalidatePath(SMS_PATH);
    return { success: true as const };
  } catch (error) {
    console.error("[SEND_SMS_TO_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to send SMS" };
  }
}

// ============================================================
// Send SMS to a raw number
// ============================================================

export async function sendSmsToNumber({
  toNumber,
  body,
}: {
  toNumber: string;
  body: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "sms:manage")) {
      return { success: false as const, error: "You do not have permission to send SMS" };
    }

    if (!toNumber?.trim()) {
      return { success: false as const, error: "Phone number is required" };
    }
    if (!body?.trim()) {
      return { success: false as const, error: "Message body is required" };
    }

    const result = await sendSms(toNumber.trim(), body.trim());

    if (!result.success) {
      revalidatePath(SMS_PATH);
      return { success: false as const, error: result.error || "Send failed" };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "sent_sms",
      entityType: "SmsMessage",
      entityId: result.providerId || toNumber.trim(),
      changes: { toNumber: toNumber.trim() },
    });

    revalidatePath(SMS_PATH);
    return { success: true as const };
  } catch (error) {
    console.error("[SEND_SMS_TO_NUMBER_ERROR]", error);
    return { success: false as const, error: "Failed to send SMS" };
  }
}

// ============================================================
// Get SMS messages (optionally for one contact)
// ============================================================

export interface SmsMessageRow {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  providerId: string | null;
  failureReason: string | null;
  toNumber: string | null;
  contactId: string | null;
  sentAt: string; // ISO
}

export async function getSmsMessages({ contactId }: { contactId?: string } = {}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "sms:read")) {
      return { success: false as const, error: "You do not have permission to view SMS" };
    }

    const messages = await prisma.smsMessage.findMany({
      where: contactId ? { contactId } : undefined,
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    // serialize() round-trips through JSON → Date becomes an ISO string.
    return { success: true as const, data: serialize(messages) as SmsMessageRow[] };
  } catch (error) {
    console.error("[GET_SMS_MESSAGES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch SMS messages" };
  }
}

// ============================================================
// Get SMS stats (counts derived from rows)
// ============================================================

export interface SmsStatsData {
  sent: number;
  delivered: number;
  failed: number;
  queued: number;
  total: number;
  configured: boolean;
}

export async function getSmsStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "sms:read")) {
      return { success: false as const, error: "You do not have permission to view SMS stats" };
    }

    const [counts, total] = await Promise.all([
      prisma.smsMessage.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.smsMessage.count(),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of counts) statusMap[row.status] = row._count.id;

    const stats: SmsStatsData = {
      sent: statusMap["SENT"] ?? 0,
      delivered: statusMap["DELIVERED"] ?? 0,
      failed: statusMap["FAILED"] ?? 0,
      queued: statusMap["QUEUED"] ?? 0,
      total,
      configured: isSmsConfigured(),
    };

    return { success: true as const, data: stats };
  } catch (error) {
    console.error("[GET_SMS_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch SMS stats" };
  }
}

// ============================================================
// Contact picker source (lightweight, gated sms:manage)
// ============================================================

export async function getSmsContactOptions(search?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "sms:manage")) {
      return { success: false as const, error: "You do not have permission" };
    }

    const contacts = await prisma.contact.findMany({
      where: {
        phone: { not: null },
        isActive: true,
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
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: "asc" },
      take: 50,
    });

    return {
      success: true as const,
      data: contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
        phone: c.phone ?? "",
      })),
    };
  } catch (error) {
    console.error("[GET_SMS_CONTACT_OPTIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contacts" };
  }
}
