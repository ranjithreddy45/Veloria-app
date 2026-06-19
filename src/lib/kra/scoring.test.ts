import { describe, it, expect } from "vitest";
import { computeScorecard, scoreKpi, bandForScore } from "./scoring";
import { KRA_TEMPLATES, getKraTemplate, allKpis, type KraScoreSpec } from "./templates";

const L = (n: number) => n * 100000;

describe("scoreKpi", () => {
  it("numericTiers picks the first satisfied descending tier", () => {
    const spec: KraScoreSpec = { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 3, points: 20 }, { gte: 2, points: 13 }, { gte: 1, points: 6 }, { gte: 0, points: 0 }] };
    expect(scoreKpi(spec, 3)).toBe(20);
    expect(scoreKpi(spec, 2)).toBe(13);
    expect(scoreKpi(spec, 0)).toBe(0);
    expect(scoreKpi(spec, null)).toBe(0);
  });
  it("manualBands matches by value", () => {
    const spec: KraScoreSpec = { kind: "manualBands", bands: [{ value: "FULL", label: "x", points: 10 }, { value: "MIXED", label: "y", points: 4 }] };
    expect(scoreKpi(spec, "FULL")).toBe(10);
    expect(scoreKpi(spec, "MIXED")).toBe(4);
    expect(scoreKpi(spec, "NOPE")).toBe(0);
    expect(scoreKpi(spec, undefined)).toBe(0);
  });
});

describe("template integrity", () => {
  it("every template's section maxPoints sum to 100", () => {
    for (const t of Object.values(KRA_TEMPLATES)) {
      const sum = t.sections.reduce((a, s) => a + s.maxPoints, 0);
      expect(sum, t.role).toBe(100);
    }
  });
  it("each section's KPI maxPoints sum to the section max", () => {
    for (const t of Object.values(KRA_TEMPLATES)) {
      for (const s of t.sections) {
        const sum = s.kpis.reduce((a, k) => a + k.maxPoints, 0);
        expect(sum, `${t.role} ${s.ref}`).toBe(s.maxPoints);
      }
    }
  });
  it("AUTO kpis declare an autoKey", () => {
    for (const t of Object.values(KRA_TEMPLATES)) {
      for (const k of allKpis(t)) {
        if (k.source === "AUTO") expect(k.autoKey, `${t.role} ${k.ref}`).toBeTruthy();
      }
    }
  });
});

describe("bandForScore", () => {
  const bands = KRA_TEMPLATES.BDM.bands;
  it("maps scores to grades", () => {
    expect(bandForScore(95, bands).grade).toBe("A+");
    expect(bandForScore(82, bands).grade).toBe("A");
    expect(bandForScore(60, bands).grade).toBe("B");
    expect(bandForScore(50, bands).grade).toBe("C");
    expect(bandForScore(10, bands).grade).toBe("D");
  });
});

describe("BDM worked example from the KRA doc", () => {
  // Gate passed (3 signings) → score 82 → Band A (85%) → all deals above
  // benchmark (×1.10) → final payout = 93.5% of pool.
  it("reproduces gate pass + Band A + ×1.10 = 93.5%", () => {
    const t = getKraTemplate("BDM")!;
    const metrics = {
      bdm_signings: 3,            // A1 = 20, gate met
      A2: "ABOVE",                // deal quality = 10, multiplier ×1.10
      bdm_owner_calls: 260,       // B1 = 9
      B2: 12,                     // B2 = 7
      bdm_site_visits: 12,        // B3 = 6
      bdm_qualified_pipeline: 5,  // C1 = 7
      C2: 2,                      // C2 = 4
      D1: "FULL",                 // 8
      D2: "ONE_MINOR",            // 5
      D3: "ON_TIME",              // 4
      E1: "W72",                  // 4
      E2: "ONE_RESOLVED",         // 3 -> total so far 20+10+9+7+6+7+4+8+5+4+4+3 = 87... tune below
      E3: "BDM_DELAY",            // 2
    };
    const r = computeScorecard(t, metrics, 3);
    expect(r.gate.passed).toBe(true);
    // Adjust one manual band so the total lands at 82 to mirror the doc example.
    // base set scores 89; trim 7 pts via three weaker manual bands → 82.
    const tuned = computeScorecard(t, { ...metrics, E1: "LATE_FLAGGED", D2: "TWO_REWORK", E3: "BDM_INACTION" }, 3);
    expect(tuned.totalScore).toBe(82);
    expect(tuned.band.grade).toBe("A");
    expect(tuned.band.basePct).toBe(85);
    expect(tuned.multiplier?.factor).toBe(1.1);
    expect(Math.round(tuned.finalPayoutPct * 1000) / 10).toBe(93.5);
  });

  it("gate fails below 3 signings → finalPayoutPct 0 even with a high score", () => {
    const t = getKraTemplate("BDM")!;
    const r = computeScorecard(t, { bdm_signings: 2, A2: "ABOVE", bdm_owner_calls: 260, B2: 12, bdm_site_visits: 12, bdm_qualified_pipeline: 5, C2: 3, D1: "FULL", D2: "CLEAN", D3: "ON_TIME", E1: "CLEAN", E2: "NO_DISPUTE", E3: "ON_TIME" }, 3);
    expect(r.gate.passed).toBe(false);
    expect(r.finalPayoutPct).toBe(0);
  });

  it("new-hire ramp: month 1 gate passes at 1 signing", () => {
    const t = getKraTemplate("BDM")!;
    const r = computeScorecard(t, { bdm_signings: 1 }, 1);
    expect(r.gate.requirements[0].threshold).toBe(1);
    expect(r.gate.passed).toBe(true);
  });
});

describe("Corporate Sales gate", () => {
  it("requires revenue AND bookings AND payment", () => {
    const t = getKraTemplate("CORPORATE_SALES")!;
    const pass = computeScorecard(t, { revenue: L(30), bookings_count: 15, payment_full_pct: 100, quality_defect_free_pct: 100 }, 3);
    expect(pass.gate.passed).toBe(true);
    const missPay = computeScorecard(t, { revenue: L(30), bookings_count: 15, payment_full_pct: 80 }, 3);
    expect(missPay.gate.passed).toBe(false);
    const missRev = computeScorecard(t, { revenue: L(20), bookings_count: 15, payment_full_pct: 100 }, 3);
    expect(missRev.gate.passed).toBe(false);
  });
  it("quality gate: defect-free below 85% blocks payout even when revenue/bookings/payment pass", () => {
    const t = getKraTemplate("CORPORATE_SALES")!;
    const base = { revenue: L(30), bookings_count: 15, payment_full_pct: 100 };
    expect(computeScorecard(t, { ...base, quality_defect_free_pct: 84 }, 3).gate.passed).toBe(false);
    expect(computeScorecard(t, { ...base, quality_defect_free_pct: 85 }, 3).gate.passed).toBe(true);
  });
  it("month-1 ramp lowers revenue+booking thresholds", () => {
    const t = getKraTemplate("CORPORATE_SALES")!;
    const r = computeScorecard(t, { revenue: L(15), bookings_count: 8, payment_full_pct: 100, quality_defect_free_pct: 100 }, 1);
    expect(r.gate.passed).toBe(true);
  });
  it("revenue tier scores A1 correctly", () => {
    const t = getKraTemplate("CORPORATE_SALES")!;
    const r = computeScorecard(t, { revenue: L(24), bookings_count: 15, payment_full_pct: 100 }, 3);
    const a1 = r.lineItems.find((l) => l.ref === "A1")!;
    expect(a1.points).toBe(20); // ₹24L tier
  });
});

describe("Inside Sales gate", () => {
  it("needs 22 bookings at full ramp", () => {
    const t = getKraTemplate("INSIDE_SALES")!;
    expect(computeScorecard(t, { revenue: L(30), bookings_count: 22, payment_full_pct: 100, quality_defect_free_pct: 100 }, 3).gate.passed).toBe(true);
    expect(computeScorecard(t, { revenue: L(30), bookings_count: 18, payment_full_pct: 100 }, 3).gate.passed).toBe(false);
  });
});
