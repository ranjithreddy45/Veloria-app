import { describe, it, expect } from "vitest";

// ============================================================
// The rule the hold-expiry sweep must never break again.
//
// It used to cancel EVERY expired HOLD. A customer paid, the booking stayed on
// HOLD (maybeConfirmBookingOnPayment only flips at >=20% of the invoice), the
// sweep cancelled it, and the bookings calendar — which excludes CANCELLED —
// stopped showing a booking that had been paid for.
//
// These tests pin the predicate itself rather than reaching for a database, so
// they run in CI without one. `paidGuard` below mirrors the `where` in
// src/app/api/cron/hold-expiry/route.ts; if that clause changes shape, this
// file should be updated in the same commit and the reasoning re-checked.
// ============================================================

interface FakeBooking {
  status: string;
  holdExpiresAt: Date | null;
  invoices: { paidAmount: number }[];
}

/** Mirrors the cron's `where`: expired HOLD **and** no money received. */
function wouldBeCancelled(b: FakeBooking, now: Date): boolean {
  const expired =
    b.status === "HOLD" && b.holdExpiresAt !== null && b.holdExpiresAt < now;
  const untouched = b.invoices.every((i) => !(i.paidAmount > 0)); // invoices: { none: { paidAmount: { gt: 0 } } }
  return expired && untouched;
}

const NOW = new Date("2026-08-10T00:00:00.000Z");
const YESTERDAY = new Date("2026-08-09T00:00:00.000Z");
const TOMORROW = new Date("2026-08-11T00:00:00.000Z");

describe("hold-expiry sweep", () => {
  it("cancels an expired hold nobody has paid for (the job's actual purpose)", () => {
    expect(
      wouldBeCancelled(
        { status: "HOLD", holdExpiresAt: YESTERDAY, invoices: [] },
        NOW
      )
    ).toBe(true);
  });

  it("cancels an expired hold whose invoice was raised but never paid", () => {
    expect(
      wouldBeCancelled(
        { status: "HOLD", holdExpiresAt: YESTERDAY, invoices: [{ paidAmount: 0 }] },
        NOW
      )
    ).toBe(true);
  });

  // ---- the regression ----

  it("SPARES an expired hold with a part payment — the reported bug", () => {
    // Below the 20% auto-confirm threshold, so it legitimately sits on HOLD.
    // The old sweep cancelled it and the booking vanished from the calendar.
    expect(
      wouldBeCancelled(
        {
          status: "HOLD",
          holdExpiresAt: YESTERDAY,
          invoices: [{ paidAmount: 5000 }],
        },
        NOW
      )
    ).toBe(false);
  });

  it("SPARES a hold paid on any one of several invoices", () => {
    expect(
      wouldBeCancelled(
        {
          status: "HOLD",
          holdExpiresAt: YESTERDAY,
          invoices: [{ paidAmount: 0 }, { paidAmount: 1 }],
        },
        NOW
      )
    ).toBe(false);
  });

  it("leaves a hold that has not expired yet alone", () => {
    expect(
      wouldBeCancelled(
        { status: "HOLD", holdExpiresAt: TOMORROW, invoices: [] },
        NOW
      )
    ).toBe(false);
  });

  it("never touches a booking that is no longer on HOLD", () => {
    for (const status of ["CONFIRMED", "COMPLETED", "CANCELLED", "TENTATIVE"]) {
      expect(
        wouldBeCancelled({ status, holdExpiresAt: YESTERDAY, invoices: [] }, NOW)
      ).toBe(false);
    }
  });

  it("leaves a hold with no expiry set alone (null is not 'in the past')", () => {
    expect(
      wouldBeCancelled(
        { status: "HOLD", holdExpiresAt: null, invoices: [] },
        NOW
      )
    ).toBe(false);
  });
});

// ============================================================
// The calendar month window. Booking.date is `@db.Date`, so rows come back as
// UTC midnight and the window has to be built in UTC to match them.
// ============================================================

function inCalendarWindow(storedUTCDate: Date, year: number, month: number): boolean {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1) - 1);
  return storedUTCDate >= start && storedUTCDate <= end;
}

describe("bookings calendar month window", () => {
  it("includes the first and last day of the month", () => {
    // The last day is the one the old local-time window dropped on any server
    // east of Greenwich.
    expect(inCalendarWindow(new Date(Date.UTC(2026, 7, 1)), 2026, 8)).toBe(true);
    expect(inCalendarWindow(new Date(Date.UTC(2026, 7, 31)), 2026, 8)).toBe(true);
  });

  it("excludes the neighbouring months", () => {
    expect(inCalendarWindow(new Date(Date.UTC(2026, 6, 31)), 2026, 8)).toBe(false);
    expect(inCalendarWindow(new Date(Date.UTC(2026, 8, 1)), 2026, 8)).toBe(false);
  });

  it("handles February in a leap year", () => {
    expect(inCalendarWindow(new Date(Date.UTC(2028, 1, 29)), 2028, 2)).toBe(true);
    expect(inCalendarWindow(new Date(Date.UTC(2028, 2, 1)), 2028, 2)).toBe(false);
  });

  it("handles the December→January rollover", () => {
    expect(inCalendarWindow(new Date(Date.UTC(2026, 11, 31)), 2026, 12)).toBe(true);
    expect(inCalendarWindow(new Date(Date.UTC(2027, 0, 1)), 2026, 12)).toBe(false);
  });
});
