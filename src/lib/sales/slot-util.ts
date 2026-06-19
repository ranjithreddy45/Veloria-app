// ============================================================
// Slot date math shared by the booking slot engine.
// Lives in a plain lib (NOT a "use server" module) so both
// booking.actions.ts and the public hold action can reuse the
// IDENTICAL UTC-day bucketing for slot-conflict checks.
// ============================================================

/**
 * UTC day range for a given local date — the half-open [gte, lt) window and the
 * UTC day-of-month — used to bucket bookings into a single calendar day for
 * slot-conflict detection regardless of the stored timezone.
 */
export function utcDayRange(date: Date): { gte: Date; lt: Date; utcDay: number } {
  const gte = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  );
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt, utcDay: gte.getUTCDate() };
}
