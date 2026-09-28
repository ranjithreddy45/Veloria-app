import { describe, expect, it } from "vitest";
import { hasPermission, routePermission } from "./permissions";
import { BOOKING_ADVANCE_PCT, bookingAdvanceMet, PAYMENT_TERMS } from "./sales/quotation-calc";

// Blocking a venue slot commits inventory. Collecting the booking advance is
// Sales's job, so Sales must never be able to block without it — the override
// belongs to Finance, who sees the money actually land (cheque in hand, a
// corporate PO). Before this, the override was hardcoded to SUPER_ADMIN and
// Finance could not block a slot at all.
describe("who can block a venue slot without the booking advance", () => {
  const CAN = ["SUPER_ADMIN", "FINANCE"];
  const CANNOT = ["SALES_EXEC", "SALES_HEAD", "ADMIN", "EVENT_COORDINATOR", "OPERATIONS", "STAFF", "CLIENT", "BD_EXECUTIVE"];

  for (const role of CAN) {
    it(`${role} may block before the advance is received`, () => {
      expect(hasPermission(role, "bookings:block-without-advance")).toBe(true);
    });
  }

  for (const role of CANNOT) {
    it(`${role} may NOT block before the advance is received`, () => {
      expect(hasPermission(role, "bookings:block-without-advance")).toBe(false);
    });
  }

  it("keeps sales able to block once the advance HAS been paid", () => {
    // The action accepts bookings:create OR the override, so sales retains the
    // normal, paid-for path — only the unpaid exception moved to Finance.
    for (const role of ["SALES_EXEC", "SALES_HEAD"]) {
      expect(hasPermission(role, "bookings:create")).toBe(true);
    }
  });

  it("lets Finance actually REACH the page the button lives on", () => {
    // The override is worthless if the route gate turns Finance away at
    // /quotations/[id] — that is where the Block-the-slot card renders.
    expect(routePermission("/quotations/abc123")).toBe("quotes:read");
    expect(hasPermission("FINANCE", "quotes:read")).toBe(true);
  });

  it("does not put bookings:create on the Finance role itself", () => {
    expect(hasPermission("FINANCE", "bookings:create")).toBe(false);
  });

  it("but DOES let Finance through createBooking, because that is the same act", () => {
    // Honest about the consequence: blockSlotFromQuotation delegates to
    // createBooking, which accepts bookings:create OR the override. So Finance
    // can also reach the Bookings form. That is coherent — holding a date for
    // an unpaid customer is the capability we just granted — but it is a real
    // widening, not a no-op, and it is asserted here rather than left implied.
    const mayCreateBooking = (role: string) =>
      hasPermission(role, "bookings:create") || hasPermission(role, "bookings:block-without-advance");
    expect(mayCreateBooking("FINANCE")).toBe(true);
    expect(mayCreateBooking("STAFF")).toBe(false);
    expect(mayCreateBooking("CLIENT")).toBe(false);
  });
});

describe("the booking-advance threshold", () => {
  it("is the first PAYMENT_TERMS installment, not a separate hardcoded number", () => {
    expect(BOOKING_ADVANCE_PCT).toBe(PAYMENT_TERMS[0].pct);
    expect(BOOKING_ADVANCE_PCT).toBe(30);
  });

  it("clears on an exact first-installment payment", () => {
    const total = 140574;
    const advance = Math.round(total * (BOOKING_ADVANCE_PCT / 100));
    expect(bookingAdvanceMet(advance, total)).toBe(true);
  });

  it("tolerates a rupee of rounding, but not a real shortfall", () => {
    const total = 100000;
    expect(bookingAdvanceMet(29999, total)).toBe(true); // ₹1 GST-rounding tolerance
    expect(bookingAdvanceMet(29000, total)).toBe(false); // genuinely short
  });

  it("no longer lets a 20% payment hold the slot", () => {
    // The regression this fixes: the gate said 20% while the quote printed 30%.
    const total = 100000;
    expect(bookingAdvanceMet(20000, total)).toBe(false);
  });

  it("treats an over-payment as met", () => {
    expect(bookingAdvanceMet(100000, 100000)).toBe(true);
  });
});
