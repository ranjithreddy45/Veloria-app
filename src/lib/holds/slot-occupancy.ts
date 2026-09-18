import { isHoldLapsed, type HoldFacts } from "./lapsed-hold";

// ============================================================
// Slot occupancy for ONE venue on ONE UTC day — pure.
// ------------------------------------------------------------
// The same conflict rules as the booking engine (booking.actions createBooking
// and the public hold transaction):
//   - FULL_DAY clashes with any booking on the day, and with a whole-day
//     (null) or partial-slot blackout;
//   - a partial slot clashes with its own slot or a FULL_DAY booking, and with
//     a whole-day blackout or its own slot's blackout.
// Callers pass rows already narrowed to the venue and the UTC day, with lapsed
// holds removed (see withoutLapsedHolds), so a lapsed hold never blocks.
// ============================================================

export type SlotName = "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY";

const PARTIAL_SLOTS: readonly string[] = ["MORNING", "AFTERNOON", "EVENING"];

export function slotIsFree(
  slot: SlotName | (string & {}),
  bookings: readonly { timeSlot: string }[],
  blackouts: readonly { timeSlot: string | null }[]
): boolean {
  const bookingBlocks =
    slot === "FULL_DAY"
      ? bookings.some((b) => b.timeSlot === "FULL_DAY" || PARTIAL_SLOTS.includes(b.timeSlot))
      : bookings.some((b) => b.timeSlot === slot || b.timeSlot === "FULL_DAY");
  if (bookingBlocks) return false;

  const blackoutBlocks =
    slot === "FULL_DAY"
      ? blackouts.some((x) => x.timeSlot === null || PARTIAL_SLOTS.includes(x.timeSlot))
      : blackouts.some((x) => x.timeSlot === null || x.timeSlot === slot);
  return !blackoutBlocks;
}

/** Drop bookings whose ids are known lapsed holds. */
export function withoutLapsedHolds<T extends { id: string }>(rows: readonly T[], lapsedIds: ReadonlySet<string>): T[] {
  return rows.filter((r) => !lapsedIds.has(r.id));
}

/** Pure variant for rows that already carry their money facts. */
export function occupyingBookings<T extends HoldFacts>(rows: readonly T[], now: Date): T[] {
  return rows.filter((r) => !isHoldLapsed(r, now));
}
