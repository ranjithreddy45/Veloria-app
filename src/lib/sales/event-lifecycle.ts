import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { utcDayRange } from "@/lib/sales/slot-util";

// ============================================================
// Event lifecycle automation. Bookings should not sit CONFIRMED forever after
// the event happens — the whole post-event flow (review/feedback requests) is
// gated on COMPLETED. This sweep, run daily:
//   1. flips CONFIRMED → IN_PROGRESS on the event day (safe, no gate);
//   2. auto-COMPLETES past events that pass the same quality gate as the manual
//      completeBooking (final payment cleared, BEO published, guest count set) —
//      so clean events close themselves and reviews go out automatically;
//   3. NUDGES the owning rep for past events that can't auto-complete, listing
//      exactly what's unmet — so nothing stalls silently.
//
// Bounded to the last 90 days so ancient unclosed bookings don't get
// re-nudged forever or auto-completed long after the fact.
// ============================================================

const LOOKBACK_DAYS = 90;

export interface EventLifecycleResult {
  startedToday: number;
  autoCompleted: number;
  nudged: number;
}

export async function sweepEventLifecycle(): Promise<EventLifecycleResult> {
  const { gte: todayGte, lt: todayLt } = utcDayRange(new Date());
  const lowerBound = new Date(todayGte.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // 1) Event day: CONFIRMED → IN_PROGRESS (atomic, idempotent).
  const started = await prisma.booking.updateMany({
    where: { status: "CONFIRMED", date: { gte: todayGte, lt: todayLt } },
    data: { status: "IN_PROGRESS" },
  });

  // 2) Past events still open within the lookback window.
  const past = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      date: { gte: lowerBound, lt: todayGte },
    },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      guestCount: true,
      createdById: true,
      invoices: { select: { balanceDue: true } },
    },
  });

  let autoCompleted = 0;
  let nudged = 0;

  for (const b of past) {
    // Same quality gate as completeBooking (no session in a cron context).
    const beo = await prisma.beo.findFirst({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    const gate: string[] = [];
    if (b.invoices.some((i) => Number(i.balanceDue) > 0)) gate.push("final payment not cleared");
    if (!(beo && ["PUBLISHED", "LOCKED"].includes(beo.status)))
      gate.push("function sheet (BEO) not published");
    if (!b.guestCount || b.guestCount <= 0) gate.push("guest count not set");

    if (gate.length === 0) {
      const done = await prisma.booking.updateMany({
        where: { id: b.id, status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
        data: { status: "COMPLETED" },
      });
      if (done.count > 0) {
        autoCompleted++;
        await notifyAwait({
          userId: b.createdById,
          type: "BOOKING_UPDATED",
          title: `Event auto-completed — ${b.bookingNumber}`,
          message: `${b.eventName} has passed and is fully settled — marked COMPLETED. The review request goes out automatically.`,
          actionUrl: `/bookings/${b.id}`,
        });
      }
    } else {
      nudged++;
      await notifyAwait({
        userId: b.createdById,
        type: "TASK_OVERDUE",
        title: `Event needs closeout — ${b.bookingNumber}`,
        message: `${b.eventName} has passed but can't auto-complete: ${gate.join("; ")}. Resolve these and close it out.`,
        actionUrl: `/bookings/${b.id}`,
      });
    }
  }

  return { startedToday: started.count, autoCompleted, nudged };
}
