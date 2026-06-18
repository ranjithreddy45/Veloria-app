import { describe, it, expect } from "vitest";
import {
  computeQuotation,
  computeCatalogQuote,
  nightsBetween,
  buildPaymentSchedule,
  validateQuotationInput,
  QUOTE_CATALOG,
  type QuotationInput,
  type CatalogPackage,
} from "./quotation-calc";

// ============================================================
// Oracle = "Veloria Grand Quotation Planner.xlsx" worked example:
//   Guests 120 · Veg Gold (699) · Baby shower premium decor (25000)
//   · Photography B'day (15000) · no drinks/rooms
//   → Food 83,880 + Decor 25,000 + Photo 15,000 = 123,880
//   → Tax 5% = 6,194 → Grand Total = 130,074
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
    expect(r.lines.find((l) => l.particulars === "Decor Plan")?.amount).toBe(25000);
    expect(r.lines.find((l) => l.particulars === "Photography / Videography")?.amount).toBe(15000);
  });

  it("subtotal, tax and grand total match the planner to the rupee", () => {
    const r = computeQuotation(input);
    expect(r.subtotal).toBe(123880);
    expect(r.tax).toBe(6194);
    expect(r.grandTotal).toBe(130074);
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
// Catalog-driven quotation (DB packages + menu locking + rooms + custom items)
// ============================================================
describe("computeCatalogQuote", () => {
  const pkgs = new Map<string, CatalogPackage>([
    ["hall", { id: "hall", category: "HALL", name: "Grand Hall", pricingType: "FLAT", price: 150000, menuItems: [] }],
    ["food", { id: "food", category: "FOOD", name: "Veg Gold", pricingType: "PER_PLATE", price: 700, menuItems: [] }],
    ["drinks", { id: "drinks", category: "DRINKS", name: "Mocktail Bar", pricingType: "PER_PERSON", price: 200, menuItems: [
      { id: "wd1", name: "Virgin Mojito", extraCost: 0 },
      { id: "wd2", name: "Blue Lagoon", extraCost: 5000 },
    ] }],
    ["room", { id: "room", category: "ROOM", name: "Deluxe Room", pricingType: "PER_NIGHT", price: 2500, menuItems: [] }],
    ["cake", { id: "cake", category: "CAKE", name: "Premium", pricingType: "PER_KG", price: 2000, menuItems: [] }],
  ]);

  it("computes per-plate, per-person+locked-extra, per-night, per-kg, flat, and custom", () => {
    const r = computeCatalogQuote(
      {
        guestCount: 100,
        rooms: 3,
        nights: 2,
        discountPct: 0,
        selections: [
          { packageId: "hall", lockedMenuItemIds: [] },         // flat 150000
          { packageId: "food", lockedMenuItemIds: [] },         // 700 × 100 = 70000
          { packageId: "drinks", lockedMenuItemIds: ["wd1", "wd2"] }, // 200×100 + 5000 = 25000
          { packageId: "room", lockedMenuItemIds: [] },         // 2500 × 3 × 2 = 15000
          { packageId: "cake", lockedMenuItemIds: [], kg: 4 },  // 2000 × 4 = 8000
        ],
        customItems: [{ label: "DJ", amount: 12000 }],
      },
      pkgs
    );
    const byCat = Object.fromEntries(r.lines.map((l) => [l.particulars, l.amount]));
    expect(byCat["Hall / Venue"]).toBe(150000);
    expect(byCat["Food Plan"]).toBe(70000);
    expect(byCat["Drinks Plan"]).toBe(25000);
    expect(byCat["Accommodation (Hotel Rooms)"]).toBe(15000);
    expect(byCat["Cake Plan"]).toBe(8000);
    expect(byCat["DJ"]).toBe(12000);
    // subtotal 280000; 5% tax → grand 294000
    expect(r.subtotal).toBe(280000);
    expect(r.grandTotal).toBe(294000);
    // payment schedule still 20/60/20 sums to grand
    expect(r.paymentSchedule.reduce((s, p) => s + p.amount, 0)).toBe(294000);
  });

  it("skips unknown package ids and applies discount", () => {
    const r = computeCatalogQuote(
      { guestCount: 50, discountPct: 10, selections: [{ packageId: "missing", lockedMenuItemIds: [] }, { packageId: "food", lockedMenuItemIds: [] }] },
      pkgs
    );
    expect(r.subtotal).toBe(35000); // only food: 700×50
    expect(r.discountAmount).toBe(3500);
  });

  it("nightsBetween computes whole nights", () => {
    expect(nightsBetween("2026-08-01", "2026-08-03")).toBe(2);
    expect(nightsBetween("2026-08-03", "2026-08-01")).toBe(0);
    expect(nightsBetween(null, "2026-08-03")).toBe(0);
  });
});
