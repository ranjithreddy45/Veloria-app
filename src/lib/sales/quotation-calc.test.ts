import { describe, it, expect } from "vitest";
import {
  computeQuotation,
  computePackageLine,
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

  it("final balance is due '1 day before the event' (SCRM part 5a)", () => {
    const sched = buildPaymentSchedule(100000);
    expect(sched[2].label).toBe("Final balance");
    expect(sched[2].dueHint).toBe("1 day before the event");
    // The old "2 hours before the event" wording must be gone.
    expect(sched.some((s) => s.dueHint.includes("2 hours"))).toBe(false);
  });
});

// ============================================================
// Vendor-package line items (Vendor Module spec, part 4)
// ============================================================
describe("computeQuotation — vendor-package lines", () => {
  it("empty/undefined packageLines is byte-identical to today", () => {
    const base = computeQuotation({ guestCount: 120, foodPackageId: "veg_gold" });
    const withEmpty = computeQuotation({ guestCount: 120, foodPackageId: "veg_gold", packageLines: [] });
    // Every legacy field is unchanged; lineDiscountsTotal defaults to 0.
    expect(withEmpty.subtotal).toBe(base.subtotal);
    expect(withEmpty.tax).toBe(base.tax);
    expect(withEmpty.grandTotal).toBe(base.grandTotal);
    expect(withEmpty.lines.length).toBe(base.lines.length);
    expect(withEmpty.lineDiscountsTotal).toBe(0);
  });

  it("per-line PERCENT discount nets the line before the global discount + tax", () => {
    // Package: 1000 × 10 = 10,000 gross, 10% off → 9,000 net.
    const r = computeQuotation({
      guestCount: 50,
      packageLines: [
        { vendorPackageId: "pk1", name: "Catering Gold", category: "Catering", unitPrice: 1000, qty: 10, discountType: "PERCENT", discountValue: 10 },
      ],
    });
    const line = r.lines.find((l) => l.particulars.includes("Catering Gold"));
    expect(line?.amount).toBe(9000);
    expect(r.subtotal).toBe(9000);
    expect(r.lineDiscountsTotal).toBe(1000);
    expect(r.tax).toBe(450); // 5% of 9,000
    expect(r.grandTotal).toBe(9450);
  });

  it("per-line AMOUNT discount is capped at the gross and folds into lineDiscountsTotal", () => {
    // Gross 5,000, flat ₹800 off → 4,200 net.
    const r = computeQuotation({
      guestCount: 50,
      packageLines: [
        { vendorPackageId: "pk2", name: "Decor Deluxe", category: "Decor", unitPrice: 2500, qty: 2, discountType: "AMOUNT", discountValue: 800 },
      ],
    });
    const line = r.lines.find((l) => l.particulars.includes("Decor Deluxe"));
    expect(line?.amount).toBe(4200);
    expect(r.lineDiscountsTotal).toBe(800);
    // An AMOUNT discount larger than the gross can never make a line negative.
    const r2 = computeQuotation({
      guestCount: 50,
      packageLines: [
        { vendorPackageId: "pk2", name: "Decor Deluxe", category: "Decor", unitPrice: 1000, qty: 1, discountType: "AMOUNT", discountValue: 9999 },
      ],
    });
    expect(r2.lines.find((l) => l.particulars.includes("Decor Deluxe"))?.amount).toBe(0);
  });

  it("allows multiple packages in the same category and sums them into the subtotal", () => {
    const r = computeQuotation({
      guestCount: 100,
      packageLines: [
        { vendorPackageId: "c1", name: "Veg Counter", category: "Catering", unitPrice: 500, qty: 100 }, // 50,000
        { vendorPackageId: "c2", name: "Live Grill", category: "Catering", unitPrice: 200, qty: 100 }, // 20,000
      ],
    });
    const catering = r.lines.filter((l) => l.particulars.startsWith("Catering:"));
    expect(catering.length).toBe(2);
    expect(r.subtotal).toBe(70000);
    expect(r.lineDiscountsTotal).toBe(0);
  });

  it("combines package lines with catalog lines and the global discount", () => {
    // Food 599×100 = 59,900 + package 40,100 = 100,000 subtotal, 10% global off.
    const r = computeQuotation({
      guestCount: 100,
      foodPackageId: "veg_silver",
      packageLines: [{ vendorPackageId: "p", name: "Photo Cinematic", category: "Photography", unitPrice: 40100, qty: 1 }],
      discountPct: 10,
    });
    expect(r.subtotal).toBe(100000);
    expect(r.discountAmount).toBe(10000);
    expect(r.taxableAmount).toBe(90000);
    expect(r.grandTotal).toBe(94500);
  });
});

describe("validateQuotationInput — vendor-package lines", () => {
  it("a package line alone satisfies the 'at least one line' rule", () => {
    expect(
      validateQuotationInput({
        guestCount: 10,
        packageLines: [{ vendorPackageId: "p", name: "X", category: "C", unitPrice: 100, qty: 5 }],
      })
    ).toEqual([]);
  });

  it("flags a qty below the line's minPax", () => {
    expect(
      validateQuotationInput({
        guestCount: 10,
        packageLines: [{ vendorPackageId: "p", name: "Catering", category: "C", unitPrice: 100, qty: 20, minPax: 50 }],
      })
    ).toContain('Package "Catering" requires a minimum of 50 pax/units.');
  });

  it("rejects a percentage discount over 100%", () => {
    expect(
      validateQuotationInput({
        guestCount: 10,
        packageLines: [{ vendorPackageId: "p", name: "Catering", category: "C", unitPrice: 100, qty: 5, discountType: "PERCENT", discountValue: 150 }],
      })
    ).toContain('Package "Catering" percentage discount cannot exceed 100%.');
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

describe("computePackageLine — revised (negotiated) unit price", () => {
  const base = { vendorPackageId: "p1", name: "Pkg", category: "catering" };

  it("uses the CATALOG unit price when no revised price is set", () => {
    const r = computePackageLine({ ...base, unitPrice: 700, qty: 100 });
    expect(r.gross).toBe(70000);
    expect(r.amount).toBe(70000);
  });

  it("uses the REVISED unit price when set (mark-up)", () => {
    const r = computePackageLine({ ...base, unitPrice: 700, revisedUnitPrice: 800, qty: 100 });
    expect(r.gross).toBe(80000); // 800 × 100, not the catalog 700
    expect(r.amount).toBe(80000);
  });

  it("uses the REVISED unit price when set (mark-down)", () => {
    const r = computePackageLine({ ...base, unitPrice: 700, revisedUnitPrice: 650, qty: 100 });
    expect(r.gross).toBe(65000);
    expect(r.amount).toBe(65000);
  });

  it("ignores a zero/invalid revised price and falls back to catalog", () => {
    const r = computePackageLine({ ...base, unitPrice: 700, revisedUnitPrice: 0, qty: 10 });
    expect(r.amount).toBe(7000);
  });

  it("applies a line discount on top of the revised price", () => {
    const r = computePackageLine({ ...base, unitPrice: 700, revisedUnitPrice: 600, qty: 10, discountType: "PERCENT", discountValue: 10 });
    expect(r.gross).toBe(6000); // 600 × 10
    expect(r.lineDiscount).toBe(600); // 10% of 6000
    expect(r.amount).toBe(5400);
  });
});
