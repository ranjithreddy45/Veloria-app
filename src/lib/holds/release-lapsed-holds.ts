import type { TimeSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcDayRange } from "@/lib/sales/slot-util";
import {
  HOLD_FACTS_SELECT,
  isHoldLapsed,
  isHoldPastExpiry,
  lapsedHoldWhere,
  moneyInvoiceWhere,
} from "./lapsed-hold";

// ============================================================
// Releasing lapsed holds — the database side of lapsed-hold.ts.
// ------------------------------------------------------------
// Every cancel here is a guarded updateMany whose WHERE is lapsedHoldWhere():
// the money check runs inside the same UPDATE, so a payment that lands a
// millisecond earlier turns the release into a no-op. Rows are also re-judged
// with isHoldLapsed() before any write; if the filter and the function ever
// disagree, the hold is kept.
//
// A released booking's PublicHold goes INITIATED/SLOT_CLAIMED → EXPIRED
// (unpaid rows only), so the customer's hold link and the team's booking say
// the same thing.
// ============================================================

type HoldRow = { id: string; status: string; holdExpiresAt: Date | null };

/**
 * Which of these bookings are lapsed holds? Loads money facts only for HOLDs
 * already past their window. On a database error returns an empty set, so
 * holds keep blocking (the old, safe behaviour) rather than being shown free.
 */
export async function findLapsedHoldIds(rows: readonly HoldRow[], now: Date = new Date()): Promise<Set<string>> {
  const candidates = rows.filter((r) => isHoldPastExpiry(r, now));
  if (candidates.length === 0) return new Set();
  try {
    const facts = await prisma.booking.findMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      select: HOLD_FACTS_SELECT,
    });
    return new Set(facts.filter((f) => isHoldLapsed(f, now)).map((f) => f.id));
  } catch (e) {
    console.error("[LAPSED_HOLD_LOOKUP_ERROR]", e);
    return new Set();
  }
}

/** Expire the unpaid PublicHold rows of released bookings. Never throws. */
async function expirePublicHolds(bookingIds: readonly string[]): Promise<number> {
  if (bookingIds.length === 0) return 0;
  try {
    const res = await prisma.publicHold.updateMany({
      where: { bookingId: { in: [...bookingIds] }, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "EXPIRED" },
    });
    return res.count;
  } catch (e) {
    console.error("[LAPSED_HOLD_PUBLIC_EXPIRE_ERROR]", e);
    return 0;
  }
}

/** The guarded cancel. true only when THIS call moved the booking HOLD → CANCELLED. */
async function cancelIfLapsed(bookingId: string, now: Date): Promise<boolean> {
  const res = await prisma.booking.updateMany({
    where: { id: bookingId, ...lapsedHoldWhere(now) },
    data: { status: "CANCELLED" },
  });
  return res.count === 1;
}

/** Release one lapsed hold (and expire its PublicHold). true when released. */
export async function releaseLapsedHold(bookingId: string, now: Date = new Date()): Promise<boolean> {
  if (!(await cancelIfLapsed(bookingId, now))) return false;
  await expirePublicHolds([bookingId]);
  return true;
}

function conflictingSlots(slot: TimeSlot): TimeSlot[] {
  return slot === "FULL_DAY" ? ["FULL_DAY", "MORNING", "AFTERNOON", "EVENING"] : [slot, "FULL_DAY"];
}

/**
 * Before placing, or moving, a hold or booking: release the lapsed holds that
 * would clash with it (same venue, same UTC day, conflicting slot). The
 * caller's own clash check still runs afterwards, so a hold that gained money
 * in the meantime simply keeps the slot taken.
 *
 * `excludeBookingId` is the booking being moved into the slot (updateBooking):
 * its own move never releases it.
 */
export async function releaseLapsedHoldsForSlot(
  venueId: string,
  date: Date,
  timeSlot: TimeSlot,
  now: Date = new Date(),
  excludeBookingId?: string
): Promise<number> {
  const { gte, lt, utcDay } = utcDayRange(date);
  const rows = await prisma.booking.findMany({
    where: {
      ...lapsedHoldWhere(now),
      venueId,
      date: { gte, lt },
      timeSlot: { in: conflictingSlots(timeSlot) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { ...HOLD_FACTS_SELECT, date: true },
  });
  let released = 0;
  for (const r of rows) {
    if (excludeBookingId && r.id === excludeBookingId) continue;
    if (new Date(r.date).getUTCDate() !== utcDay) continue;
    if (!isHoldLapsed(r, now)) continue;
    if (await releaseLapsedHold(r.id, now)) released++;
  }
  return released;
}

export interface LapsedHoldSweep {
  scanned: number;
  released: number;
  /** Expired HOLDs left in place because money has arrived or may be arriving. */
  skippedWithMoney: number;
  /** Rows the filter matched but the pure decision refused. Always 0 unless the two drift apart. */
  disagreements: number;
  /** PublicHold rows moved to EXPIRED (for this run's releases, or catching up with bookings already cancelled). */
  publicHoldsExpired: number;
}

/** The frequent-lane sweep. Idempotent; safe to run as often as you like. */
export async function releaseLapsedHolds(now: Date = new Date(), limit = 500): Promise<LapsedHoldSweep> {
  const [candidates, skippedWithMoney] = await Promise.all([
    prisma.booking.findMany({
      where: lapsedHoldWhere(now),
      select: HOLD_FACTS_SELECT,
      orderBy: { holdExpiresAt: "asc" },
      take: limit,
    }),
    prisma.booking.count({
      where: { status: "HOLD", holdExpiresAt: { not: null, lt: now }, invoices: { some: moneyInvoiceWhere(now) } },
    }),
  ]);

  let disagreements = 0;
  const releasedIds: string[] = [];
  for (const b of candidates) {
    if (!isHoldLapsed(b, now)) {
      disagreements++;
      continue;
    }
    if (await cancelIfLapsed(b.id, now)) releasedIds.push(b.id);
  }
  if (disagreements > 0) {
    console.error(`[LAPSED_HOLD_DISAGREEMENT] ${disagreements} hold(s) matched lapsedHoldWhere but not isHoldLapsed; kept.`);
  }
  let publicHoldsExpired = await expirePublicHolds(releasedIds);

  // Catch up: an unpaid PublicHold whose window passed but whose booking was
  // already cancelled elsewhere (the daily hold-expiry job, or a release whose
  // PublicHold update failed) still reads "held" until it is expired here.
  const stale = await prisma.publicHold.findMany({
    where: {
      status: { in: ["INITIATED", "SLOT_CLAIMED"] },
      paidAt: null,
      expiresAt: { not: null, lt: now },
      bookingId: { not: null },
    },
    select: { bookingId: true },
    orderBy: { expiresAt: "desc" },
    take: limit,
  });
  const staleBookingIds = [...new Set(stale.map((s) => s.bookingId).filter((id): id is string => !!id))];
  if (staleBookingIds.length > 0) {
    const cancelled = await prisma.booking.findMany({
      where: { id: { in: staleBookingIds }, status: "CANCELLED", invoices: { none: moneyInvoiceWhere(now) } },
      select: { id: true },
    });
    publicHoldsExpired += await expirePublicHolds(cancelled.map((c) => c.id));
  }

  return {
    scanned: candidates.length,
    released: releasedIds.length,
    skippedWithMoney,
    disagreements,
    publicHoldsExpired,
  };
}
