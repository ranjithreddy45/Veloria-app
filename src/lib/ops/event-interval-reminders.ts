import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendSMSFireAndForget } from "@/lib/sms";
import { notifyAwait } from "@/lib/notify";

// ============================================================
// Pre-event interval reminders — fire once each at ~48h / 24h / 12h / 4h before an
// event to the VENDOR(s), the GUEST, and the PROPERTY team. Idempotent per
// (booking, offsetHours, audience) via EventReminderLog. Also runs a T-1h property
// readiness check: if no PRE_READINESS photo is uploaded ~1h out, it alerts ops.
// Best-effort — never throws (runs in the frequent cron lane).
// ============================================================

const OFFSETS = [48, 24, 12, 4] as const;

// Approx IST start hour per slot (event start used to compute hours-to-event).
const SLOT_START_IST: Record<string, number> = { MORNING: 9, AFTERNOON: 11, EVENING: 17, FULL_DAY: 9 };

function eventStartUtc(date: Date, slot: string): Date {
  const startIst = SLOT_START_IST[slot] ?? 10;
  // booking.date is UTC-midnight for the calendar day; IST = UTC + 5.5h.
  return new Date(new Date(date).getTime() + (startIst - 5.5) * 3600_000);
}

async function already(bookingId: string, offsetHours: number, audience: string): Promise<boolean> {
  const row = await prisma.eventReminderLog.findUnique({
    where: { bookingId_offsetHours_audience: { bookingId, offsetHours, audience } },
    select: { id: true },
  });
  return !!row;
}
async function mark(bookingId: string, offsetHours: number, audience: string): Promise<void> {
  await prisma.eventReminderLog.create({ data: { bookingId, offsetHours, audience } }).catch(() => {});
}

export async function runEventIntervalReminders(): Promise<{ fired: number; readinessAlerts: number }> {
  let fired = 0;
  let readinessAlerts = 0;
  const now = new Date();
  try {
    // Upcoming, live bookings within the next ~50h.
    const horizon = new Date(now.getTime() + 50 * 3600_000);
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        date: { gte: new Date(now.getTime() - 24 * 3600_000), lte: horizon },
      },
      select: {
        id: true, bookingNumber: true, eventName: true, date: true, timeSlot: true, eventStartAt: true,
        contact: { select: { phone: true, firstName: true } },
        venue: { select: { name: true } },
        createdById: true,
      },
      take: 500,
    });

    for (const b of bookings) {
      try {
        // Precise start when set; else the IST slot approximation.
        const startUtc = b.eventStartAt ? new Date(b.eventStartAt) : eventStartUtc(b.date, b.timeSlot);
        const hoursTo = (startUtc.getTime() - now.getTime()) / 3600_000;
        if (hoursTo <= 0) continue; // event started/past

        const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(startUtc);
        const label = `${b.eventName} (${b.bookingNumber}) at ${b.venue?.name ?? "the venue"} — ${when}`;

        // Buckets we're now inside (hoursTo ≤ off), smallest → largest. OFFSETS is
        // descending, so eligible[last] is the smallest. Only the SMALLEST unlogged
        // bucket actually SENDS — the label (~Xh) then matches the real time-to-event.
        // Larger buckets are backfill-marked silently so a late first observation
        // (e.g. 5h out) doesn't blast the 48h/24h/12h messages all at once.
        const eligible = OFFSETS.filter((off) => hoursTo <= off);
        const sendOff = eligible.length ? eligible[eligible.length - 1] : null; // smallest eligible
        const backfill = eligible.filter((off) => off !== sendOff); // larger, mark-only

        // Silently mark the larger buckets as handled (all audiences), no messages.
        for (const off of backfill) {
          for (const audience of ["GUEST", "VENDOR", "PROPERTY"]) {
            if (!(await already(b.id, off, audience))) await mark(b.id, off, audience);
          }
        }

        for (const off of sendOff === null ? [] : [sendOff]) {
          // GUEST
          if (b.contact?.phone && !(await already(b.id, off, "GUEST"))) {
            const msg = `Reminder: your event ${label} is coming up in ~${off}h. Our team will be in touch. — Veloria Grand`;
            sendWhatsApp({ to: b.contact.phone, message: msg }).catch(() => {});
            sendSMSFireAndForget({ to: b.contact.phone, message: msg });
            await mark(b.id, off, "GUEST");
            fired++;
          }

          // VENDORS (confirmed assignments for this booking's event operation)
          if (!(await already(b.id, off, "VENDOR"))) {
            const vendors = await prisma.operationVendorAssignment.findMany({
              where: { status: "CONFIRMED", bookingVendor: { bookingId: b.id } },
              select: { bookingVendor: { select: { vendor: { select: { phone: true } } } } },
            });
            const phones = Array.from(new Set(vendors.map((v) => v.bookingVendor.vendor.phone).filter((p): p is string => !!p)));
            if (phones.length) {
              const msg = `Reminder: ${label} is in ~${off}h. Please arrive on time as agreed. — Veloria Grand`;
              for (const p of phones) {
                sendWhatsApp({ to: p, message: msg }).catch(() => {});
                sendSMSFireAndForget({ to: p, message: msg });
              }
              await mark(b.id, off, "VENDOR");
              fired++;
            } else {
              await mark(b.id, off, "VENDOR"); // nothing to send; don't retry every run
            }
          }

          // PROPERTY team (in-app)
          if (!(await already(b.id, off, "PROPERTY"))) {
            const ops = await prisma.user.findMany({
              where: { isActive: true, role: { in: ["OPERATIONS", "EVENT_COORDINATOR", "PROPERTY_MANAGER", "OPERATIONS_HEAD", "ADMIN", "SUPER_ADMIN"] } },
              select: { id: true },
            });
            for (const o of ops) {
              await notifyAwait({ userId: o.id, type: "SYSTEM", title: `Event in ~${off}h`, message: label, actionUrl: `/bookings/${b.id}` }).catch(() => {});
            }
            await mark(b.id, off, "PROPERTY");
            fired++;
          }
        }

        // T-1h property readiness check: pre-readiness photos must be up ~1h out.
        if (hoursTo <= 1 && !(await already(b.id, 1, "READINESS"))) {
          const pre = await prisma.galleryItem.count({ where: { bookingId: b.id, kind: "PRE_READINESS" } });
          if (pre === 0) {
            const ops = await prisma.user.findMany({
              where: { isActive: true, role: { in: ["OPERATIONS", "EVENT_COORDINATOR", "PROPERTY_MANAGER", "OPERATIONS_HEAD", "ADMIN", "SUPER_ADMIN"] } },
              select: { id: true },
            });
            for (const o of ops) {
              await notifyAwait({ userId: o.id, type: "SYSTEM", title: "Property readiness photos missing (T-1h)", message: `No pre-readiness photos uploaded for ${label}. Upload them now.`, actionUrl: `/bookings/${b.id}` }).catch(() => {});
            }
            readinessAlerts++;
          }
          await mark(b.id, 1, "READINESS");
        }
      } catch (e) {
        console.error("[EVENT_INTERVAL_REMINDER_ROW_ERR]", b.id, e);
      }
    }
  } catch (e) {
    console.error("[EVENT_INTERVAL_REMINDER_ERR]", e);
  }
  return { fired, readinessAlerts };
}
