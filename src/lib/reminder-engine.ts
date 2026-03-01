import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { getDefaultTemplate, buildReminderMessage } from "@/lib/reminder-templates";

const STAGE_DAYS: Record<string, number> = {
  SAVE_THE_DATE: 30,
  EXCITEMENT_BUILDER: 7,
  FINAL_COUNTDOWN: 3,
  TOMORROW_REMINDER: 1,
  DAY_OF_WELCOME: 0,
};

const STAGES = [
  "SAVE_THE_DATE",
  "EXCITEMENT_BUILDER",
  "FINAL_COUNTDOWN",
  "TOMORROW_REMINDER",
  "DAY_OF_WELCOME",
] as const;

/**
 * Schedule all 5 reminder stages for a guest.
 * Skips stages where the scheduledFor date is already in the past.
 */
export async function scheduleReminders(
  guestId: string,
  bookingId: string,
  eventDate: Date | string
): Promise<void> {
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const now = new Date();

  const reminders = STAGES.map((stage) => {
    const daysBeforeEvent = STAGE_DAYS[stage];
    const scheduledFor = new Date(event);

    if (daysBeforeEvent === 0) {
      // DAY_OF_WELCOME: morning of event at 8:00 AM
      scheduledFor.setHours(8, 0, 0, 0);
    } else {
      scheduledFor.setDate(scheduledFor.getDate() - daysBeforeEvent);
      scheduledFor.setHours(10, 0, 0, 0); // Send at 10:00 AM
    }

    const isPast = scheduledFor <= now;

    return {
      guestId,
      bookingId,
      stage: stage as any,
      status: isPast ? ("REMINDER_SKIPPED" as const) : ("REMINDER_PENDING" as const),
      scheduledFor,
    };
  });

  // Upsert each reminder (in case some already exist from a re-invite)
  for (const reminder of reminders) {
    await prisma.guestReminder.upsert({
      where: {
        guestId_bookingId_stage: {
          guestId: reminder.guestId,
          bookingId: reminder.bookingId,
          stage: reminder.stage,
        },
      },
      create: reminder,
      update: {
        scheduledFor: reminder.scheduledFor,
        status: reminder.status,
      },
    });
  }
}

/**
 * Process a single reminder: build message, send via WhatsApp, update status.
 */
export async function processReminder(reminderId: string): Promise<boolean> {
  const reminder = await prisma.guestReminder.findUnique({
    where: { id: reminderId },
    include: {
      guest: true,
      booking: {
        include: {
          venue: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!reminder || !reminder.guest.phone) {
    // Mark as failed if no phone
    if (reminder) {
      await prisma.guestReminder.update({
        where: { id: reminderId },
        data: { status: "REMINDER_FAILED", failReason: "Guest has no phone number" },
      });
    }
    return false;
  }

  // Check for custom template override
  const customTemplate = await prisma.reminderTemplate.findUnique({
    where: {
      bookingId_stage: {
        bookingId: reminder.bookingId,
        stage: reminder.stage,
      },
    },
  });

  const template = customTemplate?.messageTemplate
    || getDefaultTemplate(reminder.stage).messageTemplate;

  // Calculate daysUntil
  const eventDate = new Date(reminder.booking.date);
  const now = new Date();
  const daysUntil = Math.max(0, Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Build message with params
  const message = buildReminderMessage(template, {
    guestName: reminder.guest.name,
    eventName: reminder.booking.eventName,
    eventDate: eventDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    eventTime: reminder.booking.startTime
      ? new Date(reminder.booking.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "TBD",
    venueName: reminder.booking.venue.name,
    hostName: `${reminder.booking.contact.firstName} ${reminder.booking.contact.lastName}`,
    daysUntil: String(daysUntil),
    dressCode: "",
    parkingInfo: "",
  });

  try {
    const result = await sendWhatsApp({
      to: reminder.guest.phone,
      template: reminder.stage.toLowerCase(),
      message,
    });

    await prisma.guestReminder.update({
      where: { id: reminderId },
      data: {
        status: result.success ? "REMINDER_SENT" : "REMINDER_FAILED",
        sentAt: result.success ? new Date() : undefined,
        whatsappMessageId: result.messageId || null,
        failReason: result.success ? null : "WhatsApp send failed",
      },
    });

    return result.success;
  } catch (error) {
    await prisma.guestReminder.update({
      where: { id: reminderId },
      data: {
        status: "REMINDER_FAILED",
        failReason: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return false;
  }
}

/**
 * Process all due reminders (called by cron job).
 * Finds PENDING reminders where scheduledFor <= now and processes them.
 */
export async function processDueReminders(): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();

  const dueReminders = await prisma.guestReminder.findMany({
    where: {
      status: "REMINDER_PENDING",
      scheduledFor: { lte: now },
    },
    select: { id: true },
    take: 100, // Process in batches of 100
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    const success = await processReminder(reminder.id);
    if (success) sent++;
    else failed++;
  }

  return { processed: dueReminders.length, sent, failed };
}
