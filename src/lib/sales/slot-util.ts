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
  // Derive the window from the date's UTC calendar day (not local components),
  // so it agrees with how @db.Date persists the day and with getAvailabilityGrid
  // on ANY server timezone — not just UTC. Mixing local + UTC here causes an
  // off-by-one day on non-UTC hosts (missed conflicts / wrong-day storage).
  const gte = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt, utcDay: gte.getUTCDate() };
}
