import { describe, it, expect } from "vitest";
import { MONEY_METRIC, bookedValue, cashCollected, collectionRate } from "./revenue";

describe("money vocabulary", () => {
  it("never labels either number just 'Revenue'", () => {
    // The whole point: one word for two different quantities is what made two
    // screens disagree with no visible explanation.
    for (const m of Object.values(MONEY_METRIC)) {
      expect(m.label.trim().toLowerCase()).not.toBe("revenue");
      expect(m.sub.length).toBeGreaterThan(0);
      expect(m.definition.length).toBeGreaterThan(20);
    }
  });

  it("gives the two metrics distinct labels", () => {
    expect(MONEY_METRIC.BOOKED_VALUE.label).not.toBe(MONEY_METRIC.CASH_COLLECTED.label);
  });

  it("says plainly that booked value is not cash", () => {
    expect(MONEY_METRIC.BOOKED_VALUE.sub.toLowerCase()).toContain("not yet collected");
  });
});

describe("the two sums are genuinely different numbers", () => {
  // The exact case behind the confusion: one ₹5,00,000 booking, ₹1,50,000 paid.
  const bookings = [{ totalAmount: 500000 }];
  const payments = [{ amount: 150000 }];

  it("booked value counts what was sold", () => {
    expect(bookedValue(bookings)).toBe(500000);
  });

  it("cash collected counts what arrived", () => {
    expect(cashCollected(payments)).toBe(150000);
  });

  it("they must not be expected to match mid-cycle", () => {
    expect(bookedValue(bookings)).not.toBe(cashCollected(payments));
    expect(collectionRate(bookedValue(bookings), cashCollected(payments))).toBe(30);
  });

  it("handles Prisma Decimals and nulls without producing NaN", () => {
    // Decimal columns arrive as objects with toString(); a bare Number() on a
    // missing field would silently poison a money total with NaN.
    const decimalish = [{ totalAmount: { toString: () => "1250.50" } }];
    expect(bookedValue(decimalish)).toBe(1250.5);
    expect(bookedValue([{ totalAmount: null }])).toBe(0);
    expect(cashCollected([{ amount: undefined }])).toBe(0);
  });
});

describe("collectionRate", () => {
  it("returns null, not 0, when nothing has been booked", () => {
    // 0% would read as "we collected none of what we sold" — a much worse
    // statement than "we have not sold anything yet".
    expect(collectionRate(0, 0)).toBeNull();
  });

  it("reports a full collection as 100", () => {
    expect(collectionRate(200000, 200000)).toBe(100);
  });
});
