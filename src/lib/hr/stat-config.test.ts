import { describe, it, expect } from "vitest";
import { ptFromSlabs, lwfDueThisMonth } from "./stat-config";

// ============================================================
// Professional-tax slab resolution + LWF month schedule.
// PT is state-legislated and slab-driven; a wrong band is a wrong deduction on
// every payslip, so every boundary is tested.
// ============================================================

const KA_SLABS = [
  { fromSalary: 0, toSalary: 24999, ptAmount: 0, additionalAmount: 0 },
  { fromSalary: 25000, toSalary: null, ptAmount: 200, additionalAmount: 0 },
];

describe("ptFromSlabs", () => {
  it("returns null when no slabs are configured, so the caller falls back to the flat rule", () => {
    expect(ptFromSlabs(50000, [])).toBeNull();
  });

  it("resolves the band a gross falls in", () => {
    expect(ptFromSlabs(20000, KA_SLABS)).toBe(0);
    expect(ptFromSlabs(30000, KA_SLABS)).toBe(200);
  });

  it("is inclusive of fromSalary and toSalary at the boundaries", () => {
    expect(ptFromSlabs(24999, KA_SLABS)).toBe(0);   // top of band 1
    expect(ptFromSlabs(25000, KA_SLABS)).toBe(200); // bottom of band 2
  });

  it("treats toSalary=null as 'and above'", () => {
    expect(ptFromSlabs(10_000_000, KA_SLABS)).toBe(200);
  });

  it("adds the additional amount for the band (e.g. the Feb top-up some states levy)", () => {
    const slabs = [{ fromSalary: 0, toSalary: null, ptAmount: 200, additionalAmount: 100 }];
    expect(ptFromSlabs(30000, slabs)).toBe(300);
  });

  it("returns 0 — never undefined/NaN — when a gross matches no band (gap in the table)", () => {
    const gapped = [{ fromSalary: 10000, toSalary: 20000, ptAmount: 150, additionalAmount: 0 }];
    expect(ptFromSlabs(5000, gapped)).toBe(0);
    expect(ptFromSlabs(30000, gapped)).toBe(0);
  });
});

describe("lwfDueThisMonth", () => {
  const lwf = { state: "KA", employee: 20, employer: 40, months: [6, 12] };
  it("is due only in the configured months", () => {
    expect(lwfDueThisMonth(lwf, 6)).toBe(true);
    expect(lwfDueThisMonth(lwf, 12)).toBe(true);
    expect(lwfDueThisMonth(lwf, 7)).toBe(false);
  });
  it("is never due when no months are configured", () => {
    expect(lwfDueThisMonth({ ...lwf, months: [] }, 6)).toBe(false);
  });
});
