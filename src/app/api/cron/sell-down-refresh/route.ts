import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeSellDownDrafts,
  utcDateFromKey,
  utcDayKey,
  SELL_DOWN_WINDOW_DAYS,
  type SellDownBooking,
  type SellDownBlackout,
  type SellDownLead,
  type SellDownVenue,
} from "@/lib/sales/sell-down";

export const maxDuration = 300; // forward-window scan across all active venues

// ============================================================
// Cron · Sell-Down refresh
// ------------------------------------------------------------
// Scans a forward UTC window (today .. +SELL_DOWN_WINDOW_DAYS) of non-CANCELLED
// bookings + whole/partial blackouts + OPEN leads in window across active
// venues, runs the pure sell-down engine, then UPSERTs SellDownTarget per
// (venueId, date, timeSlot) — refreshing occupancyPct / isPeakDate /
// matchedLeadIds / matchedLeadCount / computedAt.
//
// Idempotent: re-running recomputes the same rows. It NEVER clobbers the
// `status` of a row already WORKING/FILLED (those are rep work-claims), but it
// DOES expire stale OPEN rows whose date is now in the past or that are no
// longer low-occupancy (a booking landed). Runs AFTER yield-demand-refresh in
// the daily lane so VenueDemandSignal occupancy is fresh if ever joined.
//
// Same UTC @db.Date bucketing as getAvailabilityGrid / yield-demand-refresh.
// CRON_SECRET Bearer + timingSafeEqual (fail-closed) — not public, no session.
// ============================================================

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ranAt = new Date();
  const todayKey = ranAt.toISOString().slice(0, 10);
  const windowStart = utcDateFromKey(todayKey);
  const windowEnd = new Date(
    windowStart.getTime() + SELL_DOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const venueRows = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, capacity: true },
  });

  if (venueRows.length === 0) {
    return NextResponse.json({
      success: true,
      ranAt: ranAt.toISOString(),
      venues: 0,
      upserts: 0,
      expired: 0,
    });
  }

  const venueIds = venueRows.map((v) => v.id);

  const [bookings, blackouts, leads, peakDates] = await Promise.all([
    prisma.booking.findMany({
      where: {
        venueId: { in: venueIds },
        status: { not: "CANCELLED" },
        date: { gte: windowStart, lt: windowEnd },
      },
      select: { venueId: true, date: true, timeSlot: true },
    }),
    prisma.blackoutDate.findMany({
      where: {
        venueId: { in: venueIds },
        date: { gte: windowStart, lt: windowEnd },
      },
      select: { venueId: true, date: true, timeSlot: true },
    }),
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED"] },
        eventDate: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        eventDate: true,
        eventType: true,
        guestCount: true,
        preferredVenueId: true,
        score: true,
      },
    }),
    // Active date-demand peak dates in-window — NEVER offered as discount targets.
    prisma.peakDate.findMany({
      where: { isActive: true, date: { gte: windowStart, lt: windowEnd } },
      select: { date: true, venueId: true },
    }),
  ]);

  // Peak-date exclusion keys: all-venues rows as "YYYY-MM-DD", venue-scoped
  // rows as "venueId|YYYY-MM-DD". Weekends are excluded inside the engine.
  const peakDateKeys = new Set<string>();
  for (const p of peakDates) {
    const key = utcDayKey(p.date);
    peakDateKeys.add(p.venueId ? `${p.venueId}|${key}` : key);
  }

  const venues: SellDownVenue[] = venueRows;
  const drafts = computeSellDownDrafts({
    venues,
    bookings: bookings as SellDownBooking[],
    blackouts: blackouts as SellDownBlackout[],
    leads: leads as SellDownLead[],
    windowStartKey: todayKey,
    windowDays: SELL_DOWN_WINDOW_DAYS,
    peakDateKeys,
  });

  let upserts = 0;
  const liveKeys = new Set<string>(); // "venueId|dateKey|slot" computed this run

  for (const d of drafts) {
    const date = utcDateFromKey(d.dateKey);
    liveKeys.add(`${d.venueId}|${d.dateKey}|${d.timeSlot}`);
    await prisma.sellDownTarget.upsert({
      where: {
        venueId_date_timeSlot: {
          venueId: d.venueId,
          date,
          timeSlot: d.timeSlot,
        },
      },
      create: {
        venueId: d.venueId,
        date,
        timeSlot: d.timeSlot,
        occupancyPct: new Prisma.Decimal(d.occupancyPct),
        isPeakDate: d.isPeakDate,
        matchedLeadIds: d.matchedLeadIds,
        matchedLeadCount: d.matchedLeadCount,
        status: "OPEN",
        computedAt: ranAt,
      },
      update: {
        // Refresh the analytical fields every run. `status` is deliberately
        // omitted so a rep's WORKING/FILLED work-claim is preserved.
        occupancyPct: new Prisma.Decimal(d.occupancyPct),
        isPeakDate: d.isPeakDate,
        matchedLeadIds: d.matchedLeadIds,
        matchedLeadCount: d.matchedLeadCount,
        computedAt: ranAt,
      },
    });
    upserts++;
  }

  // Expire stale rows: any OPEN/WORKING target whose date is now in the past,
  // OR an OPEN row in-window that is no longer low-occupancy (a booking landed,
  // so it's no longer perishable and dropped out of `drafts`). FILLED rows and
  // WORKING rows still in-window-and-perishable are left untouched.
  let expired = 0;

  // 1) Past-date rows that are still actionable → EXPIRED.
  const pastUpdate = await prisma.sellDownTarget.updateMany({
    where: {
      date: { lt: windowStart },
      status: { in: ["OPEN", "WORKING"] },
    },
    data: { status: "EXPIRED" },
  });
  expired += pastUpdate.count;

  // 2) In-window OPEN rows that are no longer perishable (not recomputed).
  const inWindowOpen = await prisma.sellDownTarget.findMany({
    where: {
      venueId: { in: venueIds },
      date: { gte: windowStart, lt: windowEnd },
      status: "OPEN",
    },
    select: { id: true, venueId: true, date: true, timeSlot: true },
  });
  const staleIds = inWindowOpen
    .filter(
      (r) => !liveKeys.has(`${r.venueId}|${utcDayKey(r.date)}|${r.timeSlot}`)
    )
    .map((r) => r.id);
  if (staleIds.length > 0) {
    const staleUpdate = await prisma.sellDownTarget.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "EXPIRED" },
    });
    expired += staleUpdate.count;
  }

  return NextResponse.json({
    success: true,
    ranAt: ranAt.toISOString(),
    venues: venueIds.length,
    windowDays: SELL_DOWN_WINDOW_DAYS,
    upserts,
    expired,
  });
}
