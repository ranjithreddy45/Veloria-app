import { describe, it, expect } from "vitest";
import {
  computeProjection,
  withoutFoodOpexY1,
  withFoodOpexY1,
  validateProjectionInputs,
  computeRevenueMarginProjection,
  validateRevenueMarginInputs,
  effectiveRmPax,
  computeAnyProjection,
  validateAnyProjectionInputs,
  asRevenueMarginInputs,
  asProjectionInputs,
  isRevenueMarginGrid,
  PROJECTION_MODEL_LABEL,
  PROJECTION_CONST,
  type ProjectionInputs,
  type RevenueMarginInputs,
} from "./projection-calc";

// ============================================================
// Oracle: VG_Projection_WITHOUT_FOOD.xlsx (§5)
// cap 100, 1500 sft, hall 6999 × 4h, 20 events base.
// Opex now includes marketing (₹20,000 per 100 seats): Y1 opex ₹129,000.
// Y1 revenue ₹559,920; GOP ₹430,920; net owner ₹316,740; 56.6%.
// ============================================================
describe("WITHOUT-FOOD model (oracle §5)", () => {
  const inputs: ProjectionInputs = {
    banquetSizeSft: 1500,
    seatingCapacity: 100,
    eventsBaseCase: 20,
    eventsBestCase: 25,
    hourlyHallCharge: 6999,
    hoursPerEvent: 4,
  };

  it("opex Y1 = ₹129,000 (109k base lines + ₹20k marketing at 100 seats)", () => {
    expect(withoutFoodOpexY1(100, 1500)).toBe(129000);
  });

  it("marketing scales ₹20,000 per 100 seats of capacity (ceil)", () => {
    // 100 seats → 1×₹20k marketing; base lines ₹109k → ₹129k total.
    expect(withoutFoodOpexY1(100, 1500)).toBe(129000);
    // 200 seats → 2×₹20k marketing; base lines ₹155k → ₹195k total.
    expect(withoutFoodOpexY1(200, 1500)).toBe(195000);
  });

  it("reproduces the Y1 base-case oracle to the rupee", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    const y1 = g.base[0];
    expect(y1.revPerEvent).toBe(27996);
    expect(y1.totalRevenue).toBe(559920);
    expect(y1.opex).toBe(129000);
    expect(y1.gop).toBe(430920);
    expect(y1.baseFee).toBeCloseTo(27996, 4);
    expect(y1.incentiveFee).toBeCloseTo(86184, 4);
    expect(y1.netOwnerReturn).toBe(316740);
    expect(y1.ownerReturnPct).toBeCloseTo(0.5657, 3);
  });

  it("produces exactly 3 years (Years 4 & 5 removed)", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    expect(g.base).toHaveLength(3);
    expect(g.best).toHaveLength(3);
    expect(g.base[g.base.length - 1].year).toBe(3);
  });

  it("caps Year 3 events at 40 (base) and 45 (best); leaves uncapped when below", () => {
    // base 25 → Y3 = 42.25 → 40; best 30 → Y3 = 50.7 → 45.
    const capped = computeProjection("WITHOUT_FOOD", { ...inputs, eventsBaseCase: 25, eventsBestCase: 30 });
    expect(capped.base[2].events).toBe(40);
    expect(capped.best[2].events).toBe(45);
    // Year-3 revenue uses the capped events.
    expect(capped.base[2].totalRevenue).toBeCloseTo(40 * capped.base[2].revPerEvent, 4);
    expect(capped.best[2].totalRevenue).toBeCloseTo(45 * capped.best[2].revPerEvent, 4);
    // best 26 → Y3 = 43.94 (< 45) stays uncapped.
    const belowBest = computeProjection("WITHOUT_FOOD", { ...inputs, eventsBestCase: 26 });
    expect(belowBest.best[2].events).toBeCloseTo(43.94, 2);
    // base 20 → Y3 = 33.8 (< 40) stays uncapped.
    expect(belowBest.base[2].events).toBeCloseTo(33.8, 6);
  });

  it("ramps events and escalates rev/event + opex correctly (Y2)", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    const y2 = g.base[1];
    expect(y2.events).toBeCloseTo(26, 6); // 20 * 1.30
    expect(y2.revPerEvent).toBeCloseTo(27996 * 1.05, 4);
    expect(y2.opex).toBeCloseTo(129000 * 1.3, 4);
  });

  it("never references food/marketing (structural: no perPlate field)", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    expect(g.base[0].perPlate).toBeUndefined();
  });
});

// ============================================================
// Oracle: VG_Projection_WITH_FOOD.xlsx (§6)
// cap 150, 2500 sft, plate ₹699, 25 events base (best 25).
// Base Y1 rev ₹2,621,250; GOP ₹1,502,750; net ₹1,071,137 (raw .5).
// Best Y1 rev ₹2,996,250; net ₹1,352,387 (raw .5).
// ============================================================
describe("WITH-FOOD model (oracle §6)", () => {
  const inputs: ProjectionInputs = {
    banquetSizeSft: 2500,
    seatingCapacity: 150,
    eventsBaseCase: 25,
    eventsBestCase: 25,
    perPlateCharge: 699,
    bestCasePlateUplift: 100,
  };

  it("opex Y1 = ₹1,118,500 (8 lines + marketing + food cost)", () => {
    expect(withFoodOpexY1(150, 2500, 25)).toBe(1118500);
  });

  it("reproduces the BASE-case Y1 oracle to the rupee", () => {
    const g = computeProjection("WITH_FOOD", inputs);
    const y1 = g.base[0];
    expect(y1.perPlate).toBe(699);
    expect(y1.revPerEvent).toBe(104850);
    expect(y1.totalRevenue).toBe(2621250);
    expect(y1.opex).toBe(1118500);
    expect(y1.gop).toBe(1502750);
    expect(y1.netOwnerReturn).toBeCloseTo(1071137.5, 4);
    expect(Math.floor(y1.netOwnerReturn)).toBe(1071137);
    expect(y1.ownerReturnPct).toBeCloseTo(0.409, 3);
  });

  it("reproduces the BEST-case Y1 oracle (plate +100 uplift, food cost still uses base events)", () => {
    const g = computeProjection("WITH_FOOD", inputs);
    const y1 = g.best[0];
    expect(y1.perPlate).toBe(799); // 699 + 100
    expect(y1.revPerEvent).toBe(119850);
    expect(y1.totalRevenue).toBe(2996250);
    expect(y1.opex).toBe(1118500); // food cost uses events_base_case (25) even in best block
    expect(Math.floor(y1.netOwnerReturn)).toBe(1352387);
  });

  it("grows per-plate 10%/yr and recomputes rev/event from plate*seats", () => {
    const g = computeProjection("WITH_FOOD", inputs);
    const y2 = g.base[1];
    expect(y2.perPlate).toBeCloseTo(699 * 1.1, 4);
    expect(y2.revPerEvent).toBeCloseTo(699 * 1.1 * 150, 4);
    expect(y2.opex).toBeCloseTo(1118500 * 1.3, 4);
  });
});

// ============================================================
// Guards & validation
// ============================================================
describe("guards", () => {
  it("owner_return_pct is 0 when revenue is 0 (no div-by-zero)", () => {
    const g = computeProjection("WITHOUT_FOOD", {
      banquetSizeSft: 1000, seatingCapacity: 50, eventsBaseCase: 0, eventsBestCase: 0,
      hourlyHallCharge: 5000, hoursPerEvent: 4,
    });
    expect(g.base[0].totalRevenue).toBe(0);
    expect(g.base[0].ownerReturnPct).toBe(0);
    expect(Number.isFinite(g.base[0].ownerReturnPct)).toBe(true);
  });

  it("a tunable config actually changes the output (and defaults match oracle)", () => {
    const inputs: ProjectionInputs = {
      banquetSizeSft: 1500, seatingCapacity: 100, eventsBaseCase: 20, eventsBestCase: 25,
      hourlyHallCharge: 6999, hoursPerEvent: 4,
    };
    const dflt = computeProjection("WITHOUT_FOOD", inputs);
    expect(dflt.base[0].netOwnerReturn).toBe(316740); // marketing-inclusive opex
    // Double the base fee % → management fee rises, net return falls.
    const tweaked = computeProjection("WITHOUT_FOOD", inputs, { ...PROJECTION_CONST, BASE_FEE_PCT: 0.1 });
    expect(tweaked.base[0].baseFee).toBeCloseTo(55992, 4); // 559920 * 0.10
    expect(tweaked.base[0].netOwnerReturn).toBeLessThan(dflt.base[0].netOwnerReturn);
  });

  it("validation requires the model-appropriate fields", () => {
    expect(validateProjectionInputs("WITHOUT_FOOD", { seatingCapacity: 100, banquetSizeSft: 1500, eventsBaseCase: 20, eventsBestCase: 25, hourlyHallCharge: 6999, hoursPerEvent: 4 })).toEqual([]);
    expect(validateProjectionInputs("WITH_FOOD", { seatingCapacity: 150, banquetSizeSft: 2500, eventsBaseCase: 25, eventsBestCase: 25, perPlateCharge: 699 })).toEqual([]);
    expect(validateProjectionInputs("WITH_FOOD", { seatingCapacity: 0 }).length).toBeGreaterThan(0);
  });
});

// ============================================================
// REVENUE MARGIN model — headline gross + separate margin line, no opex.
// ============================================================
describe("REVENUE_MARGIN — per-event basis", () => {
  const i: RevenueMarginInputs = {
    basePrice: 100000,
    bestPrice: 130000,
    priceBasis: "PER_EVENT",
    eventsPerMonth: 10,
  };

  it("pax is NOT a multiplier: gross = price × events × 12", () => {
    const g = computeRevenueMarginProjection(i);
    expect(g.effectivePax).toBe(1);
    expect(g.paxBinding).toBe("PER_EVENT");
    expect(g.base.revenuePerEvent).toBe(100000);
    expect(g.base.monthlyRevenue).toBe(1000000); // 100000 × 10
    expect(g.base.annualRevenue).toBe(12000000); // × 12
    expect(g.best.annualRevenue).toBe(15600000); // 130000 × 10 × 12
  });

  it("ignores hall capacity / minimum pax on a per-event basis", () => {
    const withPaxNoise = computeRevenueMarginProjection({
      ...i, hallCapacity: 200, minimumPax: 150, actualPax: 400,
    });
    expect(withPaxNoise.effectivePax).toBe(1);
    expect(withPaxNoise.base.annualRevenue).toBe(12000000);
  });

  it("margin is the spread only, never the gross", () => {
    const g = computeRevenueMarginProjection(i);
    expect(g.margin.spreadPerUnit).toBe(30000);
    expect(g.margin.perEvent).toBe(30000);
    expect(g.margin.monthly).toBe(300000);
    expect(g.margin.annual).toBe(3600000); // (130000 − 100000) × 1 × 10 × 12
    // The two headline cases differ by exactly the annual margin.
    expect(g.best.annualRevenue - g.base.annualRevenue).toBe(g.margin.annual);
  });
});

describe("REVENUE_MARGIN — per-pax basis", () => {
  const i: RevenueMarginInputs = {
    basePrice: 900,
    bestPrice: 1200,
    priceBasis: "PER_PAX",
    hallCapacity: 500,
    minimumPax: 100,
    actualPax: 300,
    eventsPerMonth: 12,
  };

  it("gross = price × pax × events × 12 with pax as a real multiplier", () => {
    const g = computeRevenueMarginProjection(i);
    expect(g.effectivePax).toBe(300);
    expect(g.paxBinding).toBe("ACTUAL");
    expect(g.base.revenuePerEvent).toBe(270000); // 900 × 300
    expect(g.base.annualRevenue).toBe(38880000); // 900 × 300 × 12 × 12
    expect(g.best.annualRevenue).toBe(51840000); // 1200 × 300 × 12 × 12
  });

  it("minimum-pax floor binds when actual pax is below it", () => {
    const g = computeRevenueMarginProjection({ ...i, actualPax: 60 });
    expect(g.effectivePax).toBe(100); // floored up to the minimum
    expect(g.paxBinding).toBe("MINIMUM");
    expect(g.base.revenuePerEvent).toBe(90000); // 900 × 100
    expect(g.base.annualRevenue).toBe(12960000);
  });

  it("hall-capacity cap binds when actual pax exceeds it", () => {
    const g = computeRevenueMarginProjection({ ...i, actualPax: 900 });
    expect(g.effectivePax).toBe(500); // capped at capacity
    expect(g.paxBinding).toBe("CAPACITY");
    expect(g.base.revenuePerEvent).toBe(450000); // 900 × 500
    expect(g.base.annualRevenue).toBe(64800000);
  });

  it("applies the minimum BEFORE the cap; capacity is the binding limit when minimum > capacity", () => {
    // minimum 400 floors an actual of 50, then the cap of 200 binds.
    const g = computeRevenueMarginProjection({
      ...i, hallCapacity: 200, minimumPax: 400, actualPax: 50,
    });
    expect(g.effectivePax).toBe(200);
    expect(g.paxBinding).toBe("CAPACITY");
    // effectiveRmPax is the single source of that ordering.
    expect(effectiveRmPax({ priceBasis: "PER_PAX", actualPax: 50, minimumPax: 400, hallCapacity: 200 }))
      .toEqual({ pax: 200, binding: "CAPACITY" });
  });

  it("margin = spread × pax × events × 12 (and equals best − base gross)", () => {
    const g = computeRevenueMarginProjection(i);
    expect(g.margin.spreadPerUnit).toBe(300); // 1200 − 900
    expect(g.margin.perEvent).toBe(90000); // 300 × 300 pax
    expect(g.margin.annual).toBe(12960000); // 300 × 300 × 12 × 12
    expect(g.best.annualRevenue - g.base.annualRevenue).toBe(g.margin.annual);
  });

  it("a capped pax feeds the margin line too (no stale uncapped pax)", () => {
    const g = computeRevenueMarginProjection({ ...i, actualPax: 900 });
    expect(g.margin.perEvent).toBe(300 * 500);
    expect(g.margin.annual).toBe(300 * 500 * 12 * 12);
  });
});

describe("REVENUE_MARGIN — no opex participates", () => {
  it("the output carries no opex / GOP / management-fee term at all", () => {
    const g = computeRevenueMarginProjection({
      basePrice: 900, bestPrice: 1200, priceBasis: "PER_PAX",
      hallCapacity: 500, minimumPax: 100, actualPax: 300, eventsPerMonth: 12,
    });
    const blob = JSON.stringify(g).toLowerCase();
    for (const term of ["opex", "gop", "mgmtfee", "basefee", "incentivefee", "netownerreturn"]) {
      expect(blob).not.toContain(term);
    }
    // Structurally: the only money lines are gross revenue + the spread.
    expect(Object.keys(g.base).sort()).toEqual(
      ["annualRevenue", "eventsPerMonth", "kind", "monthlyRevenue", "pax", "price", "revenuePerEvent"]
    );
    expect(Object.keys(g.margin).sort()).toEqual(["annual", "monthly", "perEvent", "spreadPerUnit"]);
  });
});

describe("REVENUE_MARGIN — validation", () => {
  const ok: RevenueMarginInputs = {
    basePrice: 900, bestPrice: 1200, priceBasis: "PER_PAX",
    hallCapacity: 500, minimumPax: 100, actualPax: 300, eventsPerMonth: 12,
  };

  it("accepts a complete per-pax and a complete per-event input", () => {
    expect(validateRevenueMarginInputs(ok)).toEqual([]);
    expect(validateRevenueMarginInputs({
      basePrice: 100000, bestPrice: 100000, priceBasis: "PER_EVENT", eventsPerMonth: 8,
    })).toEqual([]);
  });

  it("rejects a best price below the base price", () => {
    const errs = validateRevenueMarginInputs({ ...ok, bestPrice: 800 });
    expect(errs.join(" ")).toMatch(/negative margin/i);
  });

  it("rejects negative prices, a bad basis, non-integer capacity/minimum and minimum > capacity", () => {
    expect(validateRevenueMarginInputs({ ...ok, basePrice: -1 }).length).toBeGreaterThan(0);
    expect(validateRevenueMarginInputs({ ...ok, priceBasis: "PER_HEAD" as never }).length).toBeGreaterThan(0);
    expect(validateRevenueMarginInputs({ ...ok, hallCapacity: 12.5 }).length).toBeGreaterThan(0);
    expect(validateRevenueMarginInputs({ ...ok, minimumPax: 0 }).length).toBeGreaterThan(0);
    expect(validateRevenueMarginInputs({ ...ok, minimumPax: 600 }).join(" ")).toMatch(/exceed the hall capacity/i);
  });

  it("requires capacity, minimum pax and expected pax only on a per-pax basis", () => {
    const perPax = validateRevenueMarginInputs({
      basePrice: 900, bestPrice: 1200, priceBasis: "PER_PAX", eventsPerMonth: 12,
    });
    expect(perPax.length).toBe(3);
    expect(validateRevenueMarginInputs({
      basePrice: 900, bestPrice: 1200, priceBasis: "PER_EVENT", eventsPerMonth: 12,
    })).toEqual([]);
  });

  it("never assumes an events/month volume", () => {
    const errs = validateRevenueMarginInputs({ ...ok, eventsPerMonth: undefined });
    expect(errs.join(" ")).toMatch(/events per month is required/i);
  });
});

// ============================================================
// Cross-model dispatch + the frozen-snapshot round trip.
//
// An AcqProjection stores inputsJson at save time and freezes outputsJson at
// approval. The regression that matters is DRIFT: the frozen grid must be
// byte-identical to what the engine still produces from the same stored inputs,
// otherwise the PDF the owner received and the on-screen re-render disagree.
// ============================================================
describe("projection dispatch (AcqProjectionModel enum)", () => {
  const rmInputs: RevenueMarginInputs = {
    basePrice: 900, bestPrice: 1200, priceBasis: "PER_PAX",
    hallCapacity: 500, minimumPax: 100, actualPax: 300, eventsPerMonth: 12,
  };
  const feeInputs: ProjectionInputs = {
    banquetSizeSft: 1500, seatingCapacity: 100,
    eventsBaseCase: 20, eventsBestCase: 25,
    hourlyHallCharge: 6999, hoursPerEvent: 4,
  };

  it("labels every enum value (a new model can't ship unlabelled)", () => {
    expect(Object.keys(PROJECTION_MODEL_LABEL).sort()).toEqual(
      ["REVENUE_MARGIN", "WITHOUT_FOOD", "WITH_FOOD"] // ASCII: "_" > "O"
    );
  });

  it("routes REVENUE_MARGIN to the RM engine and the food models to the fee grids", () => {
    const rm = computeAnyProjection("REVENUE_MARGIN", rmInputs);
    expect(isRevenueMarginGrid(rm)).toBe(true);
    expect(rm.modelType).toBe("REVENUE_MARGIN");

    const hall = computeAnyProjection("WITHOUT_FOOD", feeInputs);
    expect(isRevenueMarginGrid(hall)).toBe(false);
    // Identical to calling the legacy engine directly — no behaviour change.
    expect(hall).toEqual(computeProjection("WITHOUT_FOOD", feeInputs));
  });

  it("routes validation per model", () => {
    expect(validateAnyProjectionInputs("REVENUE_MARGIN", rmInputs)).toEqual([]);
    expect(validateAnyProjectionInputs("WITHOUT_FOOD", feeInputs)).toEqual([]);
    // RM inputs fed to a fee grid must NOT validate (and vice versa).
    expect(validateAnyProjectionInputs("WITHOUT_FOOD", rmInputs).length).toBeGreaterThan(0);
    expect(validateAnyProjectionInputs("REVENUE_MARGIN", feeInputs).length).toBeGreaterThan(0);
  });

  it("coerces JSON-ish inputs (string numbers, missing optionals)", () => {
    const coerced = asRevenueMarginInputs({
      basePrice: "900", bestPrice: "1200", priceBasis: "PER_PAX",
      hallCapacity: "500", minimumPax: "100", actualPax: "300", eventsPerMonth: "12",
    });
    expect(coerced).toEqual(rmInputs);
    // An unknown basis degrades to PER_EVENT rather than producing NaN pax math.
    expect(asRevenueMarginInputs({ priceBasis: "junk" }).priceBasis).toBe("PER_EVENT");
    expect(asProjectionInputs({ seatingCapacity: "100" }).seatingCapacity).toBe(100);
  });

  it("an approved RM projection's frozen outputsJson round-trips to the same grid", () => {
    // 1. Draft save: inputsJson goes through JSON (Prisma Json column).
    const inputsJson = JSON.parse(JSON.stringify(rmInputs));
    // 2. Approval: the server freezes the computed grid into outputsJson.
    const frozen = JSON.parse(
      JSON.stringify(computeAnyProjection("REVENUE_MARGIN", inputsJson))
    );
    // 3. Any later re-render recomputes from the SAME stored inputs.
    const recomputed = JSON.parse(
      JSON.stringify(computeAnyProjection("REVENUE_MARGIN", inputsJson))
    );
    expect(recomputed).toEqual(frozen);
    // And it equals the engine called directly — no drift via the coercer.
    expect(frozen).toEqual(
      JSON.parse(JSON.stringify(computeRevenueMarginProjection(rmInputs)))
    );
    // The frozen snapshot is self-describing, so the PDF can pick the right body.
    expect(frozen.modelType).toBe("REVENUE_MARGIN");
  });

  it("the frozen snapshot carries the pax + events assumptions, not just prices", () => {
    // This is what makes an approved projection reproducible after the deal
    // moves on: the stored inputs alone regenerate the grid.
    const inputsJson = JSON.parse(JSON.stringify(rmInputs));
    expect(inputsJson.actualPax).toBe(300);
    expect(inputsJson.eventsPerMonth).toBe(12);

    // The deal later changes (fewer events, bigger minimum) — the approved
    // projection must NOT move.
    const frozen = computeAnyProjection("REVENUE_MARGIN", inputsJson);
    const afterDealChanged = computeAnyProjection("REVENUE_MARGIN", {
      ...inputsJson, eventsPerMonth: 4, minimumPax: 400,
    });
    expect(frozen).toEqual(computeAnyProjection("REVENUE_MARGIN", inputsJson));
    expect(afterDealChanged).not.toEqual(frozen);
  });

  it("a frozen fee grid still round-trips too (no regression)", () => {
    const inputsJson = JSON.parse(JSON.stringify(feeInputs));
    const frozen = JSON.parse(JSON.stringify(computeAnyProjection("WITH_FOOD", {
      ...inputsJson, perPlateCharge: 699, bestCasePlateUplift: 100,
    })));
    const again = JSON.parse(JSON.stringify(computeAnyProjection("WITH_FOOD", {
      ...inputsJson, perPlateCharge: 699, bestCasePlateUplift: 100,
    })));
    expect(again).toEqual(frozen);
  });
});
