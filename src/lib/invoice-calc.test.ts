import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals } from "./invoice-calc";

describe("calculateInvoiceTotals", () => {
  it("sums line items into the subtotal", () => {
    const r = calculateInvoiceTotals({
      lineItems: [
        { description: "Hall rental", quantity: 1, unitPrice: 100000 },
        { description: "Catering", quantity: 200, unitPrice: 500 },
      ],
    });
    // 100000 + (200 * 500 = 100000) = 200000
    expect(r.subtotal).toBe(200000);
    expect(r.lineItems[0].amount).toBe(100000);
    expect(r.lineItems[1].amount).toBe(100000);
  });

  it("applies intra-state GST (CGST 9% + SGST 9% = 18%) by default", () => {
    const r = calculateInvoiceTotals({
      lineItems: [{ description: "Hall", quantity: 1, unitPrice: 100000 }],
    });
    expect(r.cgstRate).toBe(9);
    expect(r.sgstRate).toBe(9);
    expect(r.igstRate).toBe(0);
    expect(r.cgstAmount).toBe(9000);
    expect(r.sgstAmount).toBe(9000);
    expect(r.igstAmount).toBe(0);
    expect(r.totalAmount).toBe(118000);
  });

  it("uses IGST (and zeroes CGST/SGST) for inter-state sales", () => {
    const r = calculateInvoiceTotals({
      lineItems: [{ description: "Hall", quantity: 1, unitPrice: 100000 }],
      igstRate: 18,
    });
    expect(r.igstAmount).toBe(18000);
    expect(r.cgstAmount).toBe(0);
    expect(r.sgstAmount).toBe(0);
    expect(r.cgstRate).toBe(0);
    expect(r.sgstRate).toBe(0);
    expect(r.totalAmount).toBe(118000);
  });

  it("applies discount BEFORE tax", () => {
    const r = calculateInvoiceTotals({
      lineItems: [{ description: "Hall", quantity: 1, unitPrice: 100000 }],
      discountPercent: 10,
    });
    // 100000 - 10% = 90000 taxable
    expect(r.discountAmount).toBe(10000);
    expect(r.afterDiscount).toBe(90000);
    // tax on 90000: 9% + 9% = 16200
    expect(r.cgstAmount).toBe(8100);
    expect(r.sgstAmount).toBe(8100);
    expect(r.totalAmount).toBe(106200);
  });

  it("handles a zero / empty invoice without NaN", () => {
    const r = calculateInvoiceTotals({ lineItems: [] });
    expect(r.subtotal).toBe(0);
    expect(r.totalAmount).toBe(0);
    expect(Number.isNaN(r.totalAmount)).toBe(false);
  });

  it("rounds money to 2 decimals (no floating-point drift)", () => {
    // 3 items of 33.33 → 99.99, tax should stay clean to paise
    const r = calculateInvoiceTotals({
      lineItems: [{ description: "x", quantity: 3, unitPrice: 33.33 }],
      cgstRate: 2.5,
      sgstRate: 2.5,
    });
    expect(r.subtotal).toBe(99.99);
    // 2.5% of 99.99 = 2.49975 → 2.5
    expect(r.cgstAmount).toBe(2.5);
    expect(r.sgstAmount).toBe(2.5);
    // total has at most 2 decimal places
    expect(Number(r.totalAmount.toFixed(2))).toBe(r.totalAmount);
  });

  it("preserves line item order", () => {
    const r = calculateInvoiceTotals({
      lineItems: [
        { description: "A", quantity: 1, unitPrice: 10 },
        { description: "B", quantity: 1, unitPrice: 20 },
        { description: "C", quantity: 1, unitPrice: 30 },
      ],
    });
    expect(r.lineItems.map((l) => l.order)).toEqual([0, 1, 2]);
    expect(r.lineItems.map((l) => l.description)).toEqual(["A", "B", "C"]);
  });

  it("treats a 100% discount as fully discounted, zero tax, zero total", () => {
    const r = calculateInvoiceTotals({
      lineItems: [{ description: "x", quantity: 1, unitPrice: 50000 }],
      discountPercent: 100,
    });
    expect(r.afterDiscount).toBe(0);
    expect(r.cgstAmount).toBe(0);
    expect(r.totalAmount).toBe(0);
  });
});
