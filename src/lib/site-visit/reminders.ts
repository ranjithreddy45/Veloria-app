// ============================================================
// Site-visit reminders + no-show sweep — plain library (cron-callable).
// ------------------------------------------------------------
// processDueSiteVisitReminders():
//   (a) sends a day-before reminder (WhatsApp + best-effort email mirror) to
//       prospects whose visit is inside the reminder window and that hasn't
//       been reminded yet — one-shot via reminderSentAt (dedupe, like
//       guest-reminders / slaEscalatedAt) so it never re-sends per tick.
//   (b) auto-marks NO_SHOW for REQUESTED/CONFIRMED visits whose scheduledAt is
//       well in the past — never touching COMPLETED/CANCELLED/RESCHEDULED so a
//       real outcome is never clobbered.
// Batched, best-effort, never throws. Reuses sendWhatsApp + event_reminder
// template. Customer-facing copy carries NO internal notes / rep identity.
// ============================================================

import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import {
  formatVisitDateLabel,
  formatVisitTimeLabel,
} from "@/lib/site-visit/slots";

/** Send the reminder when a visit is within this many hours from now. */
const REMINDER_WINDOW_HOURS = 26; // ~day-before, with slack for a daily lane
/** Don't remind for visits less than this far out (already imminent / passed). */
const REMINDER_MIN_LEAD_MIN = 30;
/** Mark NO_SHOW once a visit is this many hours past its scheduled time. */
const NO_SHOW_AFTER_HOURS = 4;
/** Safety cap so one tick can't fan out unbounded sends. */
const BATCH_LIMIT = 200;

export interface SiteVisitReminderResult {
  remindersSent: number;
  remindersFailed: number;
  noShowMarked: number;
}

export async function processDueSiteVisitReminders(): Promise<SiteVisitReminderResult> {
  const now = Date.now();
  let remindersSent = 0;
  let remindersFailed = 0;
  let noShowMarked = 0;

  // ---------- (a) Day-before reminders ----------
  try {
    const windowStart = new Date(now + REMINDER_MIN_LEAD_MIN * 60 * 1000);
    const windowEnd = new Date(now + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    const due = await prisma.siteVisitBooking.findMany({
      where: {
        status: { in: ["REQUESTED", "CONFIRMED"] },
        reminderSentAt: null,
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        scheduledAt: true,
        contactId: true,
        venue: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: BATCH_LIMIT,
    });

    for (const v of due) {
      // One-shot stamp FIRST (atomic guard): only the tick that flips
      // reminderSentAt from null proceeds, so concurrent ticks never double-send.
      const claimed = await prisma.siteVisitBooking.updateMany({
        where: { id: v.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const firstName = v.customerName.split(/\s+/)[0] || "there";
      const dateLabel = formatVisitDateLabel(v.scheduledAt);
      const timeLabel = formatVisitTimeLabel(v.scheduledAt);
      const venueName = v.venue?.name || "Veloria Grand";
      const text =
        `Hi ${firstName}, a quick reminder of your visit to ${venueName} on ` +
        `${dateLabel} at ${timeLabel}. We look forward to seeing you! ` +
        `Reply here if anything changes.`;

      try {
        const result = await sendWhatsApp({
          to: v.customerPhone,
          template: "event_reminder",
          params: {
            customerName: firstName,
            eventDate: dateLabel,
            eventTime: timeLabel,
          },
          message: text,
        });
        if (result.success) remindersSent++;
        else remindersFailed++;

        // Mirror to the inbox when we know the contact.
        if (v.contactId) {
          await prisma.whatsAppMessage
            .create({
              data: {
                direction: "OUTBOUND",
                content: text,
                status: result.success ? "SENT" : "FAILED",
                whatsappId: result.messageId || null,
                contactId: v.contactId,
              },
            })
            .catch(() => {});
        }
      } catch (e) {
        remindersFailed++;
        console.error("[SITE_VISIT_REMINDER_SEND_ERROR]", v.id, e);
      }
    }
  } catch (e) {
    console.error("[SITE_VISIT_REMINDER_SCAN_ERROR]", e);
  }

  // ---------- (b) No-show auto-marking ----------
  try {
    const cutoff = new Date(now - NO_SHOW_AFTER_HOURS * 60 * 60 * 1000);
    // Only flip still-open visits; COMPLETED/CANCELLED/RESCHEDULED are left as-is
    // so a real outcome is never clobbered.
    const marked = await prisma.siteVisitBooking.updateMany({
      where: {
        status: { in: ["REQUESTED", "CONFIRMED"] },
        scheduledAt: { lt: cutoff },
      },
      data: { status: "NO_SHOW" },
    });
    noShowMarked = marked.count;
  } catch (e) {
    console.error("[SITE_VISIT_NO_SHOW_ERROR]", e);
  }

  return { remindersSent, remindersFailed, noShowMarked };
}
