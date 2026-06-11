import { describe, it, expect } from "vitest";
import {
  computeProjection,
  withoutFoodOpexY1,
  withFoodOpexY1,
  validateProjectionInputs,
  type ProjectionInputs,
} from "./projection-calc";

// ============================================================
// Oracle: VG_Projection_WITHOUT_FOOD.xlsx (§5)
// cap 100, 1500 sft, hall 6999 × 4h, 20 events base.
// Y1 revenue ₹559,920; GOP ₹450,920; net owner ₹332,740; 59.4%.
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

  it("opex Y1 = ₹109,000", () => {
    expect(withoutFoodOpexY1(100, 1500)).toBe(109000);
  });

  it("reproduces the Y1 base-case oracle to the rupee", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    const y1 = g.base[0];
    expect(y1.revPerEvent).toBe(27996);
    expect(y1.totalRevenue).toBe(559920);
    expect(y1.opex).toBe(109000);
    expect(y1.gop).toBe(450920);
    expect(y1.baseFee).toBeCloseTo(27996, 4);
    expect(y1.incentiveFee).toBeCloseTo(90184, 4);
    expect(y1.netOwnerReturn).toBe(332740);
    expect(y1.ownerReturnPct).toBeCloseTo(0.5943, 3);
  });

  it("ramps events and escalates rev/event + opex correctly (Y2)", () => {
    const g = computeProjection("WITHOUT_FOOD", inputs);
    const y2 = g.base[1];
    expect(y2.events).toBeCloseTo(26, 6); // 20 * 1.30
    expect(y2.revPerEvent).toBeCloseTo(27996 * 1.05, 4);
    expect(y2.opex).toBeCloseTo(109000 * 1.3, 4);
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

  it("validation requires the model-appropriate fields", () => {
    expect(validateProjectionInputs("WITHOUT_FOOD", { seatingCapacity: 100, banquetSizeSft: 1500, eventsBaseCase: 20, eventsBestCase: 25, hourlyHallCharge: 6999, hoursPerEvent: 4 })).toEqual([]);
    expect(validateProjectionInputs("WITH_FOOD", { seatingCapacity: 150, banquetSizeSft: 2500, eventsBaseCase: 25, eventsBestCase: 25, perPlateCharge: 699 })).toEqual([]);
    expect(validateProjectionInputs("WITH_FOOD", { seatingCapacity: 0 }).length).toBeGreaterThan(0);
  });
});
