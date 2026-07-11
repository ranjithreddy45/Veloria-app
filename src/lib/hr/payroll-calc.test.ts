import { describe, it, expect } from "vitest";
import {
  newRegimeAnnualTax,
  computePayslip,
  gratuityPayout,
  DEFAULT_STAT_CONFIG,
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

// ============================================================
// EMPLOYER contributions (cost to company). These were absent entirely, so CTC
// understated true employer cost. Each statutory boundary gets a test.
// ============================================================
describe("computePayslip — employer PF split (EPS / EPF / EDLI / admin)", () => {
  it("caps EPS at ₹1,250 when basic is at/above the ₹15,000 ceiling", () => {
    const lines = [earn("BASIC", 30000), earn("HRA", 12000), earn("SPECIAL", 8000)];
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    // PF wages capped at 15,000.
    expect(p.pf).toBe(1800);            // employee 12% of 15,000
    expect(p.employerPf).toBe(1800);    // employer 12% of 15,000
    expect(p.employerEps).toBe(1250);   // 8.33% of 15,000, capped
    expect(p.employerEpf).toBe(550);    // 1800 − 1250
    expect(p.employerEps + p.employerEpf).toBe(p.employerPf);
  });

  it("splits EPS/EPF proportionally below the ceiling", () => {
    const lines = [earn("BASIC", 10000), earn("SPECIAL", 5000)]; // basic 10k
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    expect(p.employerPf).toBe(1200);  // 12% of 10,000
    expect(p.employerEps).toBe(833);  // 8.33% of 10,000
    expect(p.employerEpf).toBe(367);  // 1200 − 833
  });

  it("caps EDLI at ₹75 and never exceeds the ceiling", () => {
    const high = computePayslip({ lines: [earn("BASIC", 30000)], lopDays: 0, monthDays: 30 });
    expect(high.employerEdli).toBe(75); // 0.5% of 15,000
    const low = computePayslip({ lines: [earn("BASIC", 10000)], lopDays: 0, monthDays: 30 });
    expect(low.employerEdli).toBe(50); // 0.5% of 10,000
  });

  it("routes the whole employer 12% to EPF when EPS is not applicable", () => {
    const lines = [earn("BASIC", 30000)];
    const p = computePayslip({
      lines, lopDays: 0, monthDays: 30,
      cfg: { ...DEFAULT_STAT_CONFIG, epsApplicable: false },
    });
    expect(p.employerEps).toBe(0);
    expect(p.employerEpf).toBe(1800);
    expect(p.employerPf).toBe(1800);
  });

  it("never produces a negative EPF leg if EPS is misconfigured above the employer rate", () => {
    const p = computePayslip({
      lines: [earn("BASIC", 10000)], lopDays: 0, monthDays: 30,
      cfg: { ...DEFAULT_STAT_CONFIG, epsRatePct: 20 }, // > employerPfRatePct
    });
    expect(p.employerEpf).toBe(0);
    expect(p.employerEps).toBe(p.employerPf);
    expect(p.employerEpf).toBeGreaterThanOrEqual(0);
  });
});

describe("computePayslip — employer ESI", () => {
  it("charges 3.25% when the full gross is within the ESI ceiling", () => {
    const lines = [earn("BASIC", 12000), earn("SPECIAL", 6000)]; // gross 18000
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    expect(p.esi).toBe(135);          // employee 0.75%
    expect(p.employerEsi).toBe(585);  // employer 3.25% of 18,000
  });
  it("charges no employer ESI above the ceiling", () => {
    const p = computePayslip({ lines: [earn("BASIC", 30000), earn("HRA", 12000)], lopDays: 0, monthDays: 30 });
    expect(p.employerEsi).toBe(0);
  });
});

describe("computePayslip — CTC and a fully-absent month", () => {
  it("CTC = gross + employer cost (PF + EDLI + admin + ESI + gratuity accrual)", () => {
    const lines = [earn("BASIC", 12000), earn("SPECIAL", 6000)];
    const p = computePayslip({ lines, lopDays: 0, monthDays: 30 });
    const expectedCost = p.employerPf + p.employerEdli + p.employerPfAdmin + p.employerEsi + p.gratuityAccrued;
    expect(p.employerCost).toBeCloseTo(expectedCost, 2);
    expect(p.ctc).toBeCloseTo(p.gross + p.employerCost, 2);
    expect(p.ctc).toBeGreaterThan(p.gross); // the whole point: CTC > gross
  });

  it("a fully-absent month pays nothing and costs no employer ESI", () => {
    const lines = [earn("BASIC", 12000), earn("SPECIAL", 6000)];
    const p = computePayslip({ lines, lopDays: 30, monthDays: 30 });
    expect(p.gross).toBe(0);
    expect(p.employerEsi).toBe(0); // contribution follows wages PAID
    expect(p.employerPf).toBe(0);  // no paid basic → no PF wages
    expect(p.net).toBe(0);
  });
});

// ============================================================
// Arrears folded into a payslip. Statutory treatment is per-arrear and
// interacts with the PF ceiling, so every boundary is tested — a wrong rule
// here silently corrupts PF/ESI contributions.
// ============================================================
describe("computePayslip — arrears", () => {
  const base = [earn("BASIC", 12000), earn("SPECIAL", 6000)]; // gross 18000, within ESI ceiling

  it("adds the arrear to gross and to the bank net", () => {
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 5000 }] });
    expect(p.arrears).toBe(5000);
    expect(p.gross).toBe(23000); // 18000 + 5000
    expect(p.earnings.some((e) => e.code === "ARREAR" && e.amount === 5000)).toBe(true);
  });

  it("a PF-applicable arrear folds into the PF base under the ceiling", () => {
    // basic 12000 + arrear PF-wages 2000 = 14000 (< 15000 ceiling) → PF on 14000.
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 2000, pfApplicable: true }] });
    expect(p.pf).toBe(1680);         // 12% of 14000
    expect(p.employerPf).toBe(1680); // employer 12% of 14000
  });

  it("PF-applicable arrear is capped at the ₹15,000 ceiling, never charged past it", () => {
    // basic 12000 + arrear 10000 = 22000 → capped at 15000 → PF on 15000.
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 10000, pfApplicable: true }] });
    expect(p.pf).toBe(1800); // 12% of 15000, not of 22000
  });

  it("a non-PF arrear does NOT change PF", () => {
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 5000, pfApplicable: false }] });
    expect(p.pf).toBe(1440); // 12% of 12000 basic only
  });

  it("an ESI-applicable arrear raises the ESI contribution base", () => {
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 2000, esiApplicable: true }] });
    expect(p.esi).toBe(150);        // 0.75% of (18000 + 2000)
    expect(p.employerEsi).toBe(650); // 3.25% of 20000
  });

  it("PT is charged at most once even with a PT-applicable arrear", () => {
    // regular gross 18000 (< 25000 threshold), arrear 10000 pushes ptGross to 28000.
    const p = computePayslip({ lines: base, lopDays: 0, monthDays: 30, arrears: [{ amount: 10000, ptApplicable: true }] });
    expect(p.pt).toBe(200); // charged once, never doubled
  });

  it("a taxable arrear adds incremental tax charged fully this month (not spread)", () => {
    // A high salary already in the taxed band; a 100000 arrear adds annual tax.
    const hi = [earn("BASIC", 100000), earn("HRA", 40000)]; // 140000/mo → clearly taxable
    const withArr = computePayslip({ lines: hi, lopDays: 0, monthDays: 30, arrears: [{ amount: 100000, taxable: true }] });
    const without = computePayslip({ lines: hi, lopDays: 0, monthDays: 30 });
    expect(withArr.tds).toBeGreaterThan(without.tds);
  });

  it("a fully-absent month still pays and taxes an arrear", () => {
    const p = computePayslip({ lines: base, lopDays: 30, monthDays: 30, arrears: [{ amount: 5000, pfApplicable: true, esiApplicable: true }] });
    expect(p.gross).toBe(5000);       // regular 0 + arrear 5000
    expect(p.pf).toBe(600);           // 12% of 5000 (arrear PF-wages, basic paid = 0)
    expect(p.esi).toBe(38);           // 0.75% of 5000 = 37.5, ESI rounds UP to the rupee
    expect(p.net).toBeGreaterThan(0);
  });
})
