import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { TimeSlot } from "@prisma/client";

export const maxDuration = 300; // 90-day forward window across all venues

// ============================================================
// Cron · Yield demand refresh
// ------------------------------------------------------------
// Computes occupancyPct + a composite demandScore per active venue / forward
// date / BOOKABLE slot from real bookings and lead inquiry volume, then upserts
// VenueDemandSignal (source="CRON"). The yield engine reads these signals so
// OCCUPANCY/DEMAND rules fire on real demand.
//
// IMPORTANT (UTC trap): Booking.date and VenueDemandSignal.date are @db.Date,
// read back as UTC-midnight. We scan a 90-day UTC range and bucket by
// getUTCDate()/toISOString() day key — same approach as availability.actions
// getAvailabilityGrid — so the signal date matches the booking date the engine
// later looks up.
//
// Occupancy bucketing mirrors availability: a FULL_DAY booking blocks ALL slots
// for that day (100% occupancy); partial bookings each occupy their own slot.
//
// Idempotent: re-running recomputes from the same source. NEVER clobbers a
// MANUAL row — those are skipped entirely (read-then-conditional-write).
// ============================================================

const PARTIAL_SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING"];
const ALL_SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];
const WINDOW_DAYS = 90;

// Day key from a @db.Date (UTC) — "YYYY-MM-DD".
function utcDayKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

// UTC-midnight Date for a given day key, used as the @db.Date value to upsert.
function utcDateFromKey(key: string): Date {
  return new Date(key + "T00:00:00.000Z");
}

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

  // Forward window: today (UTC) .. +90 days.
  const todayKey = ranAt.toISOString().slice(0, 10);
  const windowStart = utcDateFromKey(todayKey);
  const windowEnd = new Date(
    windowStart.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (venues.length === 0) {
    return NextResponse.json({
      success: true,
      ranAt: ranAt.toISOString(),
      venues: 0,
      upserts: 0,
      skippedManual: 0,
    });
  }

  const venueIds = venues.map((v) => v.id);

  // Pull all non-cancelled bookings in the window once.
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      status: { not: "CANCELLED" },
      date: { gte: windowStart, lt: windowEnd },
    },
    select: { venueId: true, date: true, timeSlot: true },
  });

  // Recent inquiry/lead volume per venue/date (event-date demand interest).
  // Lead links a venue via preferredVenueId; eventDate is a plain DateTime.
  const leads = await prisma.lead.findMany({
    where: {
      preferredVenueId: { in: venueIds },
      eventDate: { gte: windowStart, lt: windowEnd },
      deletedAt: null,
    },
    select: { preferredVenueId: true, eventDate: true },
  });

  // Index leads by venue+day for inquiry counts.
  const inquiryByKey = new Map<string, number>();
  for (const l of leads) {
    if (!l.eventDate || !l.preferredVenueId) continue;
    const key = `${l.preferredVenueId}|${utcDayKey(l.eventDate)}`;
    inquiryByKey.set(key, (inquiryByKey.get(key) ?? 0) + 1);
  }

  // Index bookings by venue+day -> set of occupied slots.
  type DayState = { fullDay: boolean; partials: Set<TimeSlot> };
  const stateByKey = new Map<string, DayState>();
  function dayState(venueId: string, dayKey: string): DayState {
    const key = `${venueId}|${dayKey}`;
    let s = stateByKey.get(key);
    if (!s) {
      s = { fullDay: false, partials: new Set<TimeSlot>() };
      stateByKey.set(key, s);
    }
    return s;
  }
  for (const b of bookings) {
    const s = dayState(b.venueId, utcDayKey(b.date));
    if (b.timeSlot === "FULL_DAY") s.fullDay = true;
    else if (b.timeSlot) s.partials.add(b.timeSlot);
  }

  // Existing rows in the window — to skip MANUAL overrides.
  const existing = await prisma.venueDemandSignal.findMany({
    where: {
      venueId: { in: venueIds },
      date: { gte: windowStart, lt: windowEnd },
    },
    select: { venueId: true, date: true, timeSlot: true, source: true },
  });
  const manualKeys = new Set<string>();
  for (const e of existing) {
    if (e.source === "MANUAL") {
      manualKeys.add(`${e.venueId}|${utcDayKey(e.date)}|${e.timeSlot ?? "NULL"}`);
    }
  }

  let upserts = 0;
  let skippedManual = 0;

  // Iterate every venue × every day in the window × every slot.
  for (const venueId of venueIds) {
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const dayDate = new Date(windowStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayKey = utcDayKey(dayDate);
      const s = dayState(venueId, dayKey);
      const inquiryCount = inquiryByKey.get(`${venueId}|${dayKey}`) ?? 0;

      for (const slot of ALL_SLOTS) {
        const manualKey = `${venueId}|${dayKey}|${slot}`;
        if (manualKeys.has(manualKey)) {
          skippedManual++;
          continue; // never clobber a manual override
        }

        // Occupancy for this slot/window.
        let occupancyPct: number;
        if (slot === "FULL_DAY") {
          // Whole-day occupancy: full-day booking => 100, else share of the 3
          // partial slots that are occupied.
          if (s.fullDay) occupancyPct = 100;
          else
            occupancyPct = Math.round(
              (s.partials.size / PARTIAL_SLOTS.length) * 100
            );
        } else {
          // Partial slot occupied if full-day blocks it OR that slot is booked.
          occupancyPct = s.fullDay || s.partials.has(slot) ? 100 : 0;
        }

        // Composite demand: occupancy plus inquiry pressure (each inquiry adds
        // ~8 points), capped at 100. Mirrors a simple yield demand index.
        const demandScore = Math.min(
          100,
          Math.round(occupancyPct + inquiryCount * 8)
        );

        await prisma.venueDemandSignal.upsert({
          where: {
            venueId_date_timeSlot: {
              venueId,
              date: utcDateFromKey(dayKey),
              timeSlot: slot,
            },
          },
          create: {
            venueId,
            date: utcDateFromKey(dayKey),
            timeSlot: slot,
            occupancyPct,
            demandScore,
            inquiryCount,
            source: "CRON",
          },
          update: {
            occupancyPct,
            demandScore,
            inquiryCount,
            source: "CRON",
            // manualMultiplier intentionally left untouched on CRON rows.
          },
        });
        upserts++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    ranAt: ranAt.toISOString(),
    venues: venueIds.length,
    windowDays: WINDOW_DAYS,
    upserts,
    skippedManual,
  });
}
