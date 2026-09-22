import { describe, expect, it } from "vitest";
import { advanceRefusal, checkAdvance } from "./advance-gate";

describe("checkAdvance", () => {
  it("confirms once 20% is in", () => {
    expect(checkAdvance({ bookingTotal: 500000, paid: 100000 }).ok).toBe(true);
    expect(checkAdvance({ bookingTotal: 500000, paid: 99998 }).ok).toBe(false);
  });
  it("forgives one rupee of rounding, like the automatic path", () => {
    expect(checkAdvance({ bookingTotal: 500000, paid: 99999 }).ok).toBe(true);
  });
  it("measures against the invoice total when there is one", () => {
    expect(checkAdvance({ bookingTotal: 500000, invoiceTotal: 400000, paid: 80000 }).ok).toBe(true);
    expect(checkAdvance({ bookingTotal: 500000, invoiceTotal: 400000, paid: 79000 }).ok).toBe(false);
  });
  it("treats nothing paid as nothing", () => {
    const c = checkAdvance({ bookingTotal: 100000, paid: Number.NaN });
    expect(c.ok).toBe(false);
    expect(c.shortfall).toBe(19999);
  });
  it("never blocks a zero-value booking", () => {
    expect(checkAdvance({ bookingTotal: 0, paid: 0 }).ok).toBe(true);
  });
});

describe("advanceRefusal", () => {
  it("names the gap", () => {
    expect(advanceRefusal(checkAdvance({ bookingTotal: 500000, paid: 40000 }))).toBe(
      "Collect the advance first: ₹40,000 received of the ₹99,999 needed (20%). ₹59,999 more confirms this slot."
    );
  });
});
