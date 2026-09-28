import { describe, expect, it } from "vitest";
import { advanceRefusal, checkAdvance } from "./advance-gate";
import { BOOKING_ADVANCE_PCT } from "./quotation-calc";

// These used to hardcode 20% while PAYMENT_TERMS said the booking advance was
// 30%, which is exactly how the two drifted apart. Everything here is now
// derived from BOOKING_ADVANCE_PCT, so the suite follows the terms.
const pct = BOOKING_ADVANCE_PCT / 100;
/** What checkAdvance requires, including its ₹1 rounding tolerance. */
const required = (base: number) => Math.max(0, base * pct - 1);

describe("checkAdvance", () => {
  it(`confirms once ${BOOKING_ADVANCE_PCT}% is in`, () => {
    const total = 500000;
    const advance = total * pct;
    expect(checkAdvance({ bookingTotal: total, paid: advance }).ok).toBe(true);
    expect(checkAdvance({ bookingTotal: total, paid: advance - 2 }).ok).toBe(false);
  });

  it("forgives one rupee of rounding, like the automatic path", () => {
    const total = 500000;
    expect(checkAdvance({ bookingTotal: total, paid: total * pct - 1 }).ok).toBe(true);
  });

  it("measures against the invoice total when there is one", () => {
    const invoiceTotal = 400000;
    expect(
      checkAdvance({ bookingTotal: 500000, invoiceTotal, paid: invoiceTotal * pct }).ok
    ).toBe(true);
    expect(
      checkAdvance({ bookingTotal: 500000, invoiceTotal, paid: invoiceTotal * pct - 1000 }).ok
    ).toBe(false);
  });

  it("treats nothing paid as nothing", () => {
    const c = checkAdvance({ bookingTotal: 100000, paid: Number.NaN });
    expect(c.ok).toBe(false);
    expect(c.shortfall).toBe(required(100000));
  });

  it("never blocks a zero-value booking", () => {
    expect(checkAdvance({ bookingTotal: 0, paid: 0 }).ok).toBe(true);
  });

  it("no longer accepts a 20% payment, which the terms never promised", () => {
    // The regression this guards: 20% cleared the gate while the quote, the
    // invoice and the installment plan all printed 30%.
    expect(checkAdvance({ bookingTotal: 500000, paid: 100000 }).ok).toBe(false);
  });
});

describe("advanceRefusal", () => {
  it("names the gap and the percentage actually required", () => {
    const msg = advanceRefusal(checkAdvance({ bookingTotal: 500000, paid: 40000 }));
    expect(msg).toContain(`(${BOOKING_ADVANCE_PCT}%)`);
    expect(msg).toContain("₹40,000 received");
    expect(msg).toContain("more confirms this slot.");
  });
});
