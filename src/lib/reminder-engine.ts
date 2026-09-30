import type { BookingStatus, RSVPStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { formatWhatsAppFailure } from "@/lib/whatsapp/failure-reason";
import { sendSms, isSmsConfigured } from "@/lib/integrations/sms";
import { getDefaultTemplate, buildReminderMessage } from "@/lib/reminder-templates";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bookings whose guests still get journey reminders: the statuses that can
 * send the invitations in the first place (INVITE_SENDABLE_STATUSES in
 * guests/invitation-send.ts, which imports this module, hence the copy).
 */
const REMINDER_BOOKING_STATUSES: readonly BookingStatus[] = ["TENTATIVE", "CONFIRMED", "IN_PROGRESS"];

/** Why a due journey reminder must not go out (it is SKIPPED, not FAILED), or null when it may. */
export function reminderSkipReason(bookingStatus: BookingStatus, rsvpStatus: RSVPStatus): string | null {
  if (bookingStatus === "CANCELLED") return "Booking cancelled";
  if (!REMINDER_BOOKING_STATUSES.includes(bookingStatus)) return `Booking not active (${bookingStatus})`;
  if (rsvpStatus === "DECLINED") return "Guest declined the invitation";
  return null;
}

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
export async function processReminder(reminderId: string): Promise<"sent" | "failed" | "skipped"> {
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

  // A cancelled or inactive booking, or a guest who declined, gets no journey
  // message: the reminder is closed as SKIPPED, with why, instead of sent.
  const skipReason = reminder ? reminderSkipReason(reminder.booking.status, reminder.guest.rsvpStatus) : null;
  if (reminder && skipReason) {
    await prisma.guestReminder.update({
      where: { id: reminderId },
      data: { status: "REMINDER_SKIPPED", failReason: skipReason },
    });
    return "skipped";
  }

  if (!reminder || !reminder.guest.phone) {
    // Mark as failed if no phone
    if (reminder) {
      await prisma.guestReminder.update({
        where: { id: reminderId },
        data: { status: "REMINDER_FAILED", failReason: "Guest has no phone number" },
      });
    }
    return "failed";
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

  // Calculate daysUntil in calendar days, on the same server-local clock
  // scheduleReminders uses: the reminder now goes out early on its day, and an
  // hour-based count would say 8 days on the "7 days to go" morning.
  const eventDate = new Date(reminder.booking.date);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.max(0, Math.round((eventDay.getTime() - today.getTime()) / DAY_MS));

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

    // SMS fallback: if WhatsApp didn't go out but an SMS provider is
    // configured, reach the guest over SMS instead. Best-effort and guarded —
    // sendSms never throws and records its own SmsMessage row.
    let smsFellBack = false;
    if (!result.success && isSmsConfigured()) {
      try {
        const smsResult = await sendSms(reminder.guest.phone, message);
        smsFellBack = smsResult.success;
      } catch {
        // Ignore — fall through to the WhatsApp outcome below.
      }
    }

    const delivered = result.success || smsFellBack;

    await prisma.guestReminder.update({
      where: { id: reminderId },
      data: {
        status: delivered ? "REMINDER_SENT" : "REMINDER_FAILED",
        sentAt: delivered ? new Date() : undefined,
        whatsappMessageId: result.messageId || null,
        // The provider's own reason, not a generic "failed".
        failReason: delivered ? null : formatWhatsAppFailure(result.error),
      },
    });

    return delivered ? "sent" : "failed";
  } catch (error) {
    await prisma.guestReminder.update({
      where: { id: reminderId },
      data: {
        status: "REMINDER_FAILED",
        failReason: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return "failed";
  }
}

/**
 * Process all due reminders (called by cron job).
 * Finds PENDING reminders scheduled for any time up to the end of today and
 * processes them.
 */
export async function processDueReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  // Stages are scheduled at 10:00 (DAY_OF_WELCOME 08:00), but this runs once a
  // day from the 02:00 daily lane. Due-by-now made every stage wait for the
  // next run: TOMORROW_REMINDER landed on the event day and DAY_OF_WELCOME the
  // day after. Due-by-end-of-today sends each stage on its own calendar day.
  // Server-local, like the setHours() calls in scheduleReminders and the 02:00
  // crontab, so all three read the same clock. (Were this ever run hourly, the
  // first run after midnight would send the whole day's stages.)
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const dueReminders = await prisma.guestReminder.findMany({
    where: {
      status: "REMINDER_PENDING",
      scheduledFor: { lte: endOfToday },
    },
    select: { id: true },
    take: 100, // Process in batches of 100
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const outcome = await processReminder(reminder.id);
    if (outcome === "sent") sent++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  }

  return { processed: dueReminders.length, sent, failed, skipped };
}
