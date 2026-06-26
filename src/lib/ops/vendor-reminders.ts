// ============================================================
// Vendor assignment reminders — best-effort nudge sweep + single-send helper.
// ------------------------------------------------------------
// When a booking is confirmed, provision.ts mints an OperationVendorAssignment
// (NOTIFIED + respondToken) per vendor. This module re-pings vendors who haven't
// responded for an UPCOMING event, with their /vendor-confirm/<token> link, via
// WhatsApp (falling back to SMS). Each row is handled in its own try so one bad
// phone never sinks the sweep, and remindedAt is stamped so we never spam a
// vendor more than once per 24h.
//
//   sendVendorAssignmentNotification(id) — send ONE row's link now (used by the
//     internal "Remind" action too); returns whether a channel accepted it.
//   sendVendorAssignmentReminders()      — the cron sweep over due rows.
// ============================================================

import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/sms";
import { SLOT_LABEL } from "@/lib/sales/slot";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.theveloriagrand.com"
  );
}

/** Format a @db.Date (UTC-midnight) without TZ drift. */
function eventDateLabel(d: Date | null | undefined): string {
  if (!d) return "your upcoming event";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function buildMessage(opts: {
  vendorName: string;
  eventName: string;
  dateLabel: string;
  slotLabel: string;
  role: string | null;
  link: string;
}): string {
  const roleLine = opts.role ? `\nYour role: ${opts.role}` : "";
  return (
    `Hi ${opts.vendorName}, Veloria Grand needs your confirmation for:\n` +
    `${opts.eventName} — ${opts.dateLabel} (${opts.slotLabel})${roleLine}\n\n` +
    `Please confirm or decline here:\n${opts.link}`
  );
}

interface AssignmentForSend {
  id: string;
  respondToken: string | null;
  bookingVendor: {
    role: string | null;
    vendor: { name: string; phone: string | null };
    booking: { eventName: string; date: Date; timeSlot: "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY" };
  };
}

async function dispatch(a: AssignmentForSend): Promise<boolean> {
  const phone = a.bookingVendor.vendor.phone;
  if (!phone || !a.respondToken) return false;

  const link = `${baseUrl()}/vendor-confirm/${a.respondToken}`;
  const message = buildMessage({
    vendorName: a.bookingVendor.vendor.name,
    eventName: a.bookingVendor.booking.eventName,
    dateLabel: eventDateLabel(a.bookingVendor.booking.date),
    slotLabel: SLOT_LABEL[a.bookingVendor.booking.timeSlot] ?? a.bookingVendor.booking.timeSlot,
    role: a.bookingVendor.role,
    link,
  });

  // Prefer WhatsApp; fall back to SMS. Both are no-ops when unconfigured.
  const wa = await sendWhatsApp({ to: phone, message }).catch(() => ({ success: false }));
  if (wa.success) return true;

  const sms = await sendSms(phone, message).catch(() => ({ success: false }));
  return !!sms.success;
}

const SEND_INCLUDE = {
  bookingVendor: {
    select: {
      role: true,
      vendor: { select: { name: true, phone: true } },
      booking: { select: { eventName: true, date: true, timeSlot: true } },
    },
  },
} as const;

/**
 * Send (or re-send) the confirm/decline link for a SINGLE assignment now.
 * Returns true when a channel accepted the message. Does NOT stamp remindedAt —
 * the caller decides (the internal action stamps it; the sweep stamps it).
 */
export async function sendVendorAssignmentNotification(id: string): Promise<boolean> {
  const row = await prisma.operationVendorAssignment.findUnique({
    where: { id },
    select: { id: true, respondToken: true, ...SEND_INCLUDE },
  });
  if (!row) return false;
  return dispatch(row as AssignmentForSend);
}

export interface VendorReminderResult {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Cron sweep: find still-NOTIFIED assignments for FUTURE events that were not
 * reminded in the last 24h, re-send the vendor's link, and stamp remindedAt.
 * Best-effort per row — a single failure never throws the whole sweep.
 */
export async function sendVendorAssignmentReminders(): Promise<VendorReminderResult> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // Compare against UTC-midnight today so same-day events still count as upcoming.
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const rows = await prisma.operationVendorAssignment.findMany({
    where: {
      status: "NOTIFIED",
      respondToken: { not: null },
      OR: [{ remindedAt: null }, { remindedAt: { lt: dayAgo } }],
      bookingVendor: {
        vendor: { phone: { not: null } },
        booking: { date: { gte: todayUTC } },
      },
    },
    select: { id: true, respondToken: true, ...SEND_INCLUDE },
    take: 200,
  });

  const result: VendorReminderResult = {
    scanned: rows.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const ok = await dispatch(row as AssignmentForSend);
      if (ok) {
        result.sent++;
        // Only stamp on a successful send so an unconfigured channel keeps retrying.
        await prisma.operationVendorAssignment
          .update({ where: { id: row.id }, data: { remindedAt: new Date() } })
          .catch(() => {});
      } else {
        result.skipped++;
      }
    } catch (e) {
      result.failed++;
      console.error("[VENDOR_REMINDER_ROW_ERROR]", row.id, e);
    }
  }

  return result;
}
