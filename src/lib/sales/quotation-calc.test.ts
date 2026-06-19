import { describe, it, expect } from "vitest";
import {
  computeQuotation,
  buildPaymentSchedule,
  validateQuotationInput,
  QUOTE_CATALOG,
  type QuotationInput,
} from "./quotation-calc";

// ============================================================
// Oracle = "Veloria Grand Quotation Planner.xlsx" worked example:
//   Guests 120 · Veg Gold (699) · Baby shower premium decor (35000)
//   · Photography B'day (15000) · no drinks/rooms
//   → Food 83,880 + Decor 35,000 + Photo 15,000 = 133,880
//   → Tax 5% = 6,694 → Grand Total = 140,574
// ============================================================

describe("computeQuotation — planner oracle", () => {
  const input: QuotationInput = {
    guestCount: 120,
    foodPackageId: "veg_gold",
    decorId: "babyshower_premium",
    photographyId: "bday",
  };

  it("food line = per-plate × guests", () => {
    const r = computeQuotation(input);
    const food = r.lines.find((l) => l.particulars === "Food Plan");
    expect(food?.amount).toBe(83880);
  });

  it("decor + photography are fixed", () => {
    const r = computeQuotation(input);
    expect(r.lines.find((l) => l.particulars === "Decor Plan")?.amount).toBe(35000);
    expect(r.lines.find((l) => l.particulars === "Photography / Videography")?.amount).toBe(15000);
  });

  it("subtotal, tax and grand total match the planner to the rupee", () => {
    const r = computeQuotation(input);
    expect(r.subtotal).toBe(133880);
    expect(r.tax).toBe(6694);
    expect(r.grandTotal).toBe(140574);
  });
});

describe("computeQuotation — line engines", () => {
  it("cake = rate/kg × kg", () => {
    const r = computeQuotation({ guestCount: 100, cakeId: "premium", cakeKg: 3 });
    expect(r.lines.find((l) => l.particulars === "Cake Plan")?.amount).toBe(6000);
  });

  it("drinks = per-person × guests", () => {
    const r = computeQuotation({ guestCount: 80, drinksPerPerson: 150 });
    expect(r.lines.find((l) => l.particulars === "Drinks Plan")?.amount).toBe(12000);
  });

  it("accommodation = rooms × charge (default 2500)", () => {
    const r = computeQuotation({ guestCount: 50, rooms: 4 });
    expect(r.lines.find((l) => l.particulars.startsWith("Accommodation"))?.amount).toBe(10000);
  });

  it("activities sum the selected fixed items", () => {
    const r = computeQuotation({ guestCount: 50, activityIds: ["balloon", "caricature"] });
    expect(r.lines.find((l) => l.particulars === "Activity Plan")?.amount).toBe(5000);
  });

  it("photography 'other' uses the custom amount", () => {
    const r = computeQuotation({
      guestCount: 50,
      photographyId: "other",
      photographyCustomAmount: 22000,
    });
    expect(r.lines.find((l) => l.particulars === "Photography / Videography")?.amount).toBe(22000);
  });

  it("per-plate override beats the catalog rate", () => {
    const r = computeQuotation({
      guestCount: 100,
      foodPackageId: "veg_gold",
      foodPerPlateOverride: 650,
    });
    expect(r.lines.find((l) => l.particulars === "Food Plan")?.amount).toBe(65000);
  });
});

describe("computeQuotation — discount", () => {
  it("applies discount to the subtotal before tax", () => {
    // subtotal 100000, 10% off → 90000, +5% tax → 94500
    const r = computeQuotation({
      guestCount: 100,
      foodPackageId: "veg_silver", // 599 × 100 = 59900
      customLines: [{ label: "Misc", amount: 40100 }],
      discountPct: 10,
    });
    expect(r.subtotal).toBe(100000);
    expect(r.discountAmount).toBe(10000);
    expect(r.taxableAmount).toBe(90000);
    expect(r.tax).toBe(4500);
    expect(r.grandTotal).toBe(94500);
  });

  it("clamps discount into 0..100", () => {
    expect(computeQuotation({ guestCount: 1, customLines: [{ label: "x", amount: 100 }], discountPct: 200 }).discountPct).toBe(100);
    expect(computeQuotation({ guestCount: 1, customLines: [{ label: "x", amount: 100 }], discountPct: -5 }).discountPct).toBe(0);
  });
});

describe("buildPaymentSchedule", () => {
  it("splits 20/60/20 and always sums to the grand total", () => {
    const sched = buildPaymentSchedule(130074);
    expect(sched.map((s) => s.pct)).toEqual([20, 60, 20]);
    expect(sched[0].amount).toBe(26015); // round(130074 × 0.20)
    expect(sched[1].amount).toBe(78044); // round(130074 × 0.60)
    expect(sched[2].amount).toBe(26015); // remainder
    expect(sched.reduce((s, i) => s + i.amount, 0)).toBe(130074); // no drift
  });
});

describe("validateQuotationInput", () => {
  it("rejects empty / zero-guest / line-less quotes", () => {
    expect(validateQuotationInput({})).toContain("Guest count must be at least 1.");
    expect(validateQuotationInput({ guestCount: 10 })).toContain(
      "Add at least one line item to the quotation."
    );
  });

  it("accepts a valid quote", () => {
    expect(validateQuotationInput({ guestCount: 10, foodPackageId: "veg_gold" })).toEqual([]);
  });

  it("rejects negative money inputs (override, rates, custom lines)", () => {
    expect(
      validateQuotationInput({ guestCount: 10, foodPackageId: "veg_gold", foodPerPlateOverride: -50 })
    ).toContain("Per-plate price cannot be negative.");
    expect(
      validateQuotationInput({ guestCount: 10, drinksPerPerson: -5 })
    ).toContain("Drinks per-person rate cannot be negative.");
    expect(
      validateQuotationInput({ guestCount: 10, customLines: [{ label: "Credit", amount: -1000 }] })
    ).toContain('Line "Credit" amount cannot be negative.');
  });
});

describe("catalog integrity", () => {
  it("ids are unique within each category", () => {
    for (const cat of [QUOTE_CATALOG.food, QUOTE_CATALOG.decor, QUOTE_CATALOG.activity, QUOTE_CATALOG.cake, QUOTE_CATALOG.photography]) {
      const ids = cat.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// ============================================================
// Hall-only model (no food) — hall charged per hour, min 4 hrs
// ============================================================
describe("computeQuotation — hall-only (no food)", () => {
  it("hall line = rate × hours, replaces food", () => {
    const r = computeQuotation({ guestCount: 100, foodMode: "HALL_ONLY", hallRate: 5999, hallHours: 4 });
    const hall = r.lines.find((l) => l.particulars === "Hall Charges");
    expect(hall?.amount).toBe(23996); // 5999 × 4
    expect(r.lines.find((l) => l.particulars === "Food Plan")).toBeUndefined();
  });

  it("enforces a 4-hour minimum even if fewer entered", () => {
    const r = computeQuotation({ guestCount: 50, foodMode: "HALL_ONLY", hallRate: 9999, hallHours: 2 });
    expect(r.lines.find((l) => l.particulars === "Hall Charges")?.amount).toBe(39996); // 9999 × 4
  });

  it("scales above the minimum", () => {
    const r = computeQuotation({ guestCount: 50, foodMode: "HALL_ONLY", hallRate: 12999, hallHours: 8 });
    expect(r.lines.find((l) => l.particulars === "Hall Charges")?.amount).toBe(103992); // 12999 × 8
  });

  it("WITH_FOOD (default) keeps food and has no hall line", () => {
    const r = computeQuotation({ guestCount: 100, foodPackageId: "veg_gold" });
    expect(r.lines.find((l) => l.particulars === "Food Plan")?.amount).toBe(69900);
    expect(r.lines.find((l) => l.particulars === "Hall Charges")).toBeUndefined();
  });

  it("validation requires a hall rate in hall-only mode", () => {
    expect(validateQuotationInput({ guestCount: 50, foodMode: "HALL_ONLY" })).toContain(
      "Select a hall charge (per hour)."
    );
    expect(validateQuotationInput({ guestCount: 50, foodMode: "HALL_ONLY", hallRate: 6999 })).toEqual([]);
  });
});
