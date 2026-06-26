// ============================================================
// Sales — session-free slot availability pre-check (server-lib / cron).
// ------------------------------------------------------------
// Mirrors the EXACT bookings+blackouts OR-logic + utcDayRange() UTC-day
// bucketing used by the auth-gated checkAvailability (booking.actions.ts)
// and the un-exported publicSlotIsFree (public-hold.actions.ts), but:
//   - WITHOUT auth (callable from runSpeedToLead / cron / lib context where
//     there is no session), and
//   - WITHOUT leaking any internal data — it returns ONLY booleans, never
//     blackout reasons, booking numbers, customer labels, or identities.
//
// This is a NEW file (not an edit of public-hold.actions.ts) so that the
// session-free check lives in src/lib — never re-exported from a "use server"
// file and never wired to a route — making it the single source of truth for
// non-auth availability checks going forward.
//
// SECURITY (see spec risks): an advisory, best-effort read. The authoritative
// no-double-book guarantee still comes from the Serializable $transaction in
// createBooking/createPublicHold; this pre-check only powers soft, never-promise
// copy ("looks open, our team will confirm").
// ============================================================

import { prisma } from "@/lib/prisma";
import { utcDayRange } from "@/lib/sales/slot-util";
import type { TimeSlotEnum } from "@/lib/sales/slot";

const PARTIAL_SLOTS: TimeSlotEnum[] = ["MORNING", "AFTERNOON", "EVENING"];

/**
 * Is the given slot likely free on the given day for the venue?
 *
 * Replicates publicSlotIsFree's OR-logic exactly:
 *  - a FULL_DAY request clashes with ANY booking/partial blackout on the day;
 *  - a partial request clashes with its own slot or a FULL_DAY booking / a
 *    whole-day blackout.
 *
 * Returns true only when nothing blocks the slot. Best-effort: any DB error
 * resolves to `false` (conservative — never over-promise availability).
 */
export async function slotLikelyFree(
  venueId: string,
  date: Date,
  timeSlot: TimeSlotEnum
): Promise<boolean> {
  try {
    const { gte, lt, utcDay } = utcDayRange(date);

    const bookingOr =
      timeSlot === "FULL_DAY"
        ? [
            { timeSlot: "FULL_DAY" as TimeSlotEnum },
            ...PARTIAL_SLOTS.map((s) => ({ timeSlot: s })),
          ]
        : [{ timeSlot }, { timeSlot: "FULL_DAY" as TimeSlotEnum }];

    const bookings = await prisma.booking.findMany({
      where: {
        venueId,
        date: { gte, lt },
        status: { notIn: ["CANCELLED"] },
        OR: bookingOr,
      },
      select: { date: true },
    });
    if (bookings.some((b) => new Date(b.date).getUTCDate() === utcDay)) {
      return false;
    }

    const blackoutOr =
      timeSlot === "FULL_DAY"
        ? [{ timeSlot: null }, ...PARTIAL_SLOTS.map((s) => ({ timeSlot: s }))]
        : [{ timeSlot: null }, { timeSlot }];

    const blackouts = await prisma.blackoutDate.findMany({
      where: { venueId, date: { gte, lt }, OR: blackoutOr },
      select: { date: true },
    });
    if (blackouts.some((b) => new Date(b.date).getUTCDate() === utcDay)) {
      return false;
    }

    return true;
  } catch (e) {
    console.error("[slotLikelyFree] error:", e);
    // Conservative: when we can't verify, never claim the date is open.
    return false;
  }
}

/**
 * Per-slot FREE/BUSY for a whole day at a venue. Returns only `{ slot, free }`
 * booleans — never reasons/labels. Useful for "any slot free today?" copy.
 * Best-effort: on error every slot resolves to `free: false`.
 */
export async function anySlotFreeOnDay(
  venueId: string,
  date: Date
): Promise<{ slot: TimeSlotEnum; free: boolean }[]> {
  const slots: TimeSlotEnum[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];
  const out: { slot: TimeSlotEnum; free: boolean }[] = [];
  for (const slot of slots) {
    // Re-use the single-slot check so the OR-logic stays in one place.
    out.push({ slot, free: await slotLikelyFree(venueId, date, slot) });
  }
  return out;
}
