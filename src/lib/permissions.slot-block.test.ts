import { describe, expect, it } from "vitest";
import { hasPermission, routePermission } from "./permissions";
import {
  BOOKING_ADVANCE_PCT,
  REDUCED_ADVANCE_PCT,
  bookingAdvanceMet,
  reducedAdvanceMet,
  PAYMENT_TERMS,
} from "./sales/quotation-calc";

// Blocking a venue slot commits inventory. Collecting the booking advance is
// Sales's job, so Sales must never be able to block without it — the override
// belongs to Finance, who sees the money actually land (cheque in hand, a
// corporate PO). Before this, the override was hardcoded to SUPER_ADMIN and
// Finance could not block a slot at all.
describe("who can block a venue slot on the reduced advance", () => {
  const CAN = ["SUPER_ADMIN", "FINANCE"];
  const CANNOT = ["SALES_EXEC", "SALES_HEAD", "ADMIN", "EVENT_COORDINATOR", "OPERATIONS", "STAFF", "CLIENT", "BD_EXECUTIVE"];

  for (const role of CAN) {
    it(`${role} may block on the reduced advance`, () => {
      expect(hasPermission(role, "bookings:block-reduced-advance")).toBe(true);
    });
  }

  for (const role of CANNOT) {
    it(`${role} may NOT block on the reduced advance`, () => {
      expect(hasPermission(role, "bookings:block-reduced-advance")).toBe(false);
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
      hasPermission(role, "bookings:create") || hasPermission(role, "bookings:block-reduced-advance");
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

describe("the reduced advance Finance may block on", () => {
  it("is lower than the full booking advance, but not zero", () => {
    expect(REDUCED_ADVANCE_PCT).toBe(10);
    expect(REDUCED_ADVANCE_PCT).toBeLessThan(BOOKING_ADVANCE_PCT);
    expect(REDUCED_ADVANCE_PCT).toBeGreaterThan(0);
  });

  it("clears at exactly the reduced percentage", () => {
    const total = 200000;
    expect(reducedAdvanceMet(total * (REDUCED_ADVANCE_PCT / 100), total)).toBe(true);
  });

  it("refuses a slot with nothing paid — a lower bar is still a bar", () => {
    // The point of the revision: Finance blocks on a part payment, never on air.
    expect(reducedAdvanceMet(0, 200000)).toBe(false);
  });

  it("refuses just under the reduced bar", () => {
    const total = 200000;
    expect(reducedAdvanceMet(total * (REDUCED_ADVANCE_PCT / 100) - 1000, total)).toBe(false);
  });

  it("does not let the reduced bar satisfy the full advance", () => {
    // Sales is still held to the full amount; 10% must not confirm a booking.
    const total = 200000;
    const reduced = total * (REDUCED_ADVANCE_PCT / 100);
    expect(reducedAdvanceMet(reduced, total)).toBe(true);
    expect(bookingAdvanceMet(reduced, total)).toBe(false);
  });
});

// The permission was live and correct for a week and still did nothing, because
// the card that carries the button was rendered behind perms.canSend
// (quotes:send) — which Finance does not hold. Server-side rights are useless
// if the UI never draws the control.
describe("Finance can actually SEE the Block-the-slot card", () => {
  // Mirrors the canBlockSlot expression in quotations/[id]/page.tsx.
  const canBlockSlot = (role: string) =>
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    hasPermission(role, "bookings:create") ||
    hasPermission(role, "bookings:block-reduced-advance");

  it("renders for Finance", () => {
    expect(canBlockSlot("FINANCE")).toBe(true);
  });

  it("still renders for the sales roles that always had it", () => {
    expect(canBlockSlot("SALES_EXEC")).toBe(true);
    expect(canBlockSlot("SALES_HEAD")).toBe(true);
  });

  it("does not render for roles with no booking rights", () => {
    expect(canBlockSlot("STAFF")).toBe(false);
    expect(canBlockSlot("CLIENT")).toBe(false);
  });

  it("documents why the old gate failed: Finance has no quotes:send", () => {
    expect(hasPermission("FINANCE", "quotes:send")).toBe(false);
    expect(hasPermission("FINANCE", "quotes:read")).toBe(true); // but can open the page
  });
});
