"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import {
  upsertReminderTemplateSchema,
  type UpsertReminderTemplateInput,
} from "@/schemas/invitation.schema";
import {
  getDefaultTemplate,
  buildReminderMessage,
} from "@/lib/reminder-templates";

// ============================================================
// Get Reminder Status (Summary for a Booking)
// ============================================================

export async function getReminderStatus(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!bookingId) {
      return { success: false as const, error: "Booking ID is required" };
    }

    const reminders = await prisma.guestReminder.findMany({
      where: { bookingId },
      select: { stage: true, status: true },
    });

    // Group by stage
    const stages = [
      "SAVE_THE_DATE",
      "EXCITEMENT_BUILDER",
      "FINAL_COUNTDOWN",
      "TOMORROW_REMINDER",
      "DAY_OF_WELCOME",
    ] as const;

    const stageStats = stages.map((stage) => {
      const stageReminders = reminders.filter((r) => r.stage === stage);
      return {
        stage,
        total: stageReminders.length,
        sent: stageReminders.filter((r) => r.status === "REMINDER_SENT").length,
        pending: stageReminders.filter((r) => r.status === "REMINDER_PENDING").length,
        failed: stageReminders.filter((r) => r.status === "REMINDER_FAILED").length,
        skipped: stageReminders.filter((r) => r.status === "REMINDER_SKIPPED").length,
      };
    });

    const totalSent = stageStats.reduce((sum, s) => sum + s.sent, 0);
    const totalPending = stageStats.reduce((sum, s) => sum + s.pending, 0);
    const totalFailed = stageStats.reduce((sum, s) => sum + s.failed, 0);
    const totalReminders = reminders.length;

    return {
      success: true as const,
      data: {
        stages: stageStats,
        overall: {
          total: totalReminders,
          sent: totalSent,
          pending: totalPending,
          failed: totalFailed,
        },
      },
    };
  } catch (error) {
    console.error("[GET_REMINDER_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch reminder status" };
  }
}

// ============================================================
// Get Reminder Schedule (Full Details)
// ============================================================

export async function getReminderSchedule(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!bookingId) {
      return { success: false as const, error: "Booking ID is required" };
    }

    const reminders = await prisma.guestReminder.findMany({
      where: { bookingId },
      include: {
        guest: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: [{ stage: "asc" }, { guest: { name: "asc" } }],
    });

    return { success: true as const, data: serialize(reminders) };
  } catch (error) {
    console.error("[GET_REMINDER_SCHEDULE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch reminder schedule" };
  }
}

// ============================================================
// Get Custom Templates for a Booking
// ============================================================

export async function getCustomTemplates(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const templates = await prisma.reminderTemplate.findMany({
      where: { bookingId },
      orderBy: { stage: "asc" },
    });

    return { success: true as const, data: serialize(templates) };
  } catch (error) {
    console.error("[GET_CUSTOM_TEMPLATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch custom templates" };
  }
}

// ============================================================
// Upsert Reminder Template (Custom Override)
// ============================================================

export async function upsertReminderTemplate(data: UpsertReminderTemplateInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = upsertReminderTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { bookingId, stage, subject, messageTemplate } = parsed.data;

    const template = await prisma.reminderTemplate.upsert({
      where: {
        bookingId_stage: { bookingId, stage: stage as any },
      },
      create: {
        bookingId,
        stage: stage as any,
        subject,
        messageTemplate,
      },
      update: {
        subject,
        messageTemplate,
      },
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[UPSERT_REMINDER_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to save reminder template" };
  }
}

// ============================================================
// Reset to Default Template
// ============================================================

export async function resetToDefaultTemplate(
  bookingId: string,
  stage: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.reminderTemplate.deleteMany({
      where: { bookingId, stage: stage as any },
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const };
  } catch (error) {
    console.error("[RESET_DEFAULT_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to reset template" };
  }
}

// ============================================================
// Retry Failed Reminders
// ============================================================

export async function retryFailedReminders(
  bookingId: string,
  stage?: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const where: Record<string, unknown> = {
      bookingId,
      status: "REMINDER_FAILED",
    };
    if (stage) {
      where.stage = stage;
    }

    const result = await prisma.guestReminder.updateMany({
      where: where as any,
      data: {
        status: "REMINDER_PENDING",
        failReason: null,
      },
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const, data: { retriedCount: result.count } };
  } catch (error) {
    console.error("[RETRY_FAILED_REMINDERS_ERROR]", error);
    return { success: false as const, error: "Failed to retry reminders" };
  }
}

// ============================================================
// Skip a Reminder
// ============================================================

export async function skipReminder(reminderId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const reminder = await prisma.guestReminder.update({
      where: { id: reminderId },
      data: { status: "REMINDER_SKIPPED" },
    });

    revalidatePath(`/bookings/${reminder.bookingId}/guests`);
    return { success: true as const, data: serialize(reminder) };
  } catch (error) {
    console.error("[SKIP_REMINDER_ERROR]", error);
    return { success: false as const, error: "Failed to skip reminder" };
  }
}

// ============================================================
// Preview Reminder Message
// ============================================================

export async function previewReminderMessage(
  bookingId: string,
  stage: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "reminders:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Check for custom template
    const customTemplate = await prisma.reminderTemplate.findUnique({
      where: {
        bookingId_stage: { bookingId, stage: stage as any },
      },
    });

    const template =
      customTemplate?.messageTemplate ||
      getDefaultTemplate(stage).messageTemplate;

    // Get booking details for preview
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        venue: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    const eventDate = new Date(booking.date);
    const now = new Date();
    const daysUntil = Math.max(
      0,
      Math.ceil(
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const preview = buildReminderMessage(template, {
      guestName: "John Doe",
      eventName: booking.eventName,
      eventDate: eventDate.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      eventTime: booking.startTime
        ? new Date(booking.startTime).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD",
      venueName: booking.venue.name,
      hostName: `${booking.contact.firstName} ${booking.contact.lastName}`,
      daysUntil: String(daysUntil),
      dressCode: "Smart Casual",
      parkingInfo: "Complimentary valet parking available",
    });

    return {
      success: true as const,
      data: {
        template,
        preview,
        isCustom: !!customTemplate,
      },
    };
  } catch (error) {
    console.error("[PREVIEW_REMINDER_MESSAGE_ERROR]", error);
    return { success: false as const, error: "Failed to preview message" };
  }
}
