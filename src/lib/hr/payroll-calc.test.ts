import { describe, it, expect } from "vitest";
import {
  newRegimeAnnualTax,
  computePayslip,
  gratuityPayout,
  type StructureLine,
} from "./payroll-calc";

const earn = (code: string, monthly: number, taxable = true): StructureLine => ({
  code,
  name: code,
  kind: "EARNING",
  monthly,
  taxable,
  statutory: "NONE",
});

describe("newRegimeAnnualTax (FY 2026-27 New Regime)", () => {
  it("is zero at/below the 87A rebate ceiling (₹12L taxable)", () => {
    // 4-8L @5% = 20000, 8-12L @10% = 40000 => 60000, fully rebated.
    expect(newRegimeAnnualTax(1_200_000)).toBe(0);
  });
  it("taxes ₹16L taxable at 124800 (incl 4% cess, no rebate)", () => {
    // 20000 + 40000 + 60000 = 120000; +4% cess = 124800.
    expect(newRegimeAnnualTax(1_600_000)).toBe(124800);
  });
  it("taxes ₹23.25L taxable at 292500", () => {
    // 20000+40000+60000+80000 + 325000@25%=81250 => 281250; +4% = 292500.
    expect(newRegimeAnnualTax(2_325_000)).toBe(292500);
  });
});

describe("computePayslip statutory", () => {
  it("caps PF at the wage ceiling, charges PT above threshold, no ESI/TDS for a ₹50k gross", () => {
    const lines = [earn("BASIC", 30000), earn("HRA", 12000), earn("SPECIAL", 8000)];
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    expect(p.gross).toBe(50000);
    expect(p.pf).toBe(1800); // 12% of min(30000, 15000)
    expect(p.esi).toBe(0); // gross > 21000
    expect(p.pt).toBe(200); // gross > 25000
    expect(p.tds).toBe(0); // annual taxable 525000 -> rebated
    expect(p.net).toBe(48000);
  });

  it("charges ESI when gross is within the ceiling", () => {
    const lines = [earn("BASIC", 12000), earn("SPECIAL", 6000)]; // gross 18000
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    expect(p.esi).toBe(135); // 0.75% of 18000
    expect(p.pt).toBe(0); // gross <= 25000
  });

  it("projects monthly TDS from the new-regime annual tax", () => {
    const lines = [earn("BASIC", 100000), earn("SPECIAL", 100000)]; // gross 200000/mo
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    // annual taxable = 2,400,000 - 75,000 std ded = 2,325,000 -> tax 292500 -> /12
    expect(p.tds).toBe(24375);
  });

  it("pro-rates for loss-of-pay days (calendar fallback)", () => {
    const lines = [earn("BASIC", 30000), earn("SPECIAL", 30000)]; // 60000 full
    const p = computePayslip({ lines, lopDays: 3, monthDays: 30 });
    expect(p.paidDays).toBe(27);
    expect(p.gross).toBe(54000); // 60000 * 27/30
  });

  it("pro-rates LOP over WORKING days when payableDays is given", () => {
    const lines = [earn("BASIC", 30000), earn("SPECIAL", 30000)]; // 60000 full
    // July: 31 calendar, 23 working days, 5 unpaid working-day absences.
    const p = computePayslip({ lines, lopDays: 5, payableDays: 23, monthDays: 31 });
    expect(p.paidDays).toBe(18);
    expect(p.gross).toBe(46956.52); // 60000 * 18/23, not 60000*26/31
  });

  it("pays ZERO for a full-month absence (LOP == working days)", () => {
    const lines = [earn("BASIC", 30000), earn("SPECIAL", 30000)];
    const p = computePayslip({ lines, lopDays: 23, payableDays: 23, monthDays: 31 });
    expect(p.gross).toBe(0);
    expect(p.net).toBe(0);
  });

  it("decides PT/ESI eligibility on FULL gross, not the LOP-reduced gross", () => {
    const lines = [earn("BASIC", 12500), earn("SPECIAL", 12500)]; // full gross 25000
    // Heavy LOP pulls paid gross well below thresholds, but eligibility holds.
    const p = computePayslip({ lines, lopDays: 15, payableDays: 23, monthDays: 31 });
    expect(p.pt).toBe(200); // full gross 25000 >= 25000 threshold
  });
});

describe("gratuityPayout", () => {
  it("pays (15/26)*basic*years at/above 5 years", () => {
    expect(gratuityPayout(30000, 6)).toBe(103846); // 30000*15*6/26
  });
  it("is zero below the eligibility threshold", () => {
    expect(gratuityPayout(30000, 4)).toBe(0);
  });
  it("rounds the final year UP when >6 months served (Gratuity Act)", () => {
    // 6.83 yrs → 7; 15/26 × 40000 × 7 = 161538.
    expect(gratuityPayout(40000, 6.83)).toBe(161538);
    // 6.4 yrs → 6 (<=6 months); 15/26 × 40000 × 6 = 138462.
    expect(gratuityPayout(40000, 6.4)).toBe(138462);
  });
});
