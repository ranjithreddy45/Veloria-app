// ============================================================
// KRA scoring engine — pure. Turns auto metrics + manual entries into a
// scored monthly scorecard: per-KPI points, section totals, gate, band,
// and (BDM) the deal-quality multiplier. No DB, no side effects.
// ============================================================

import type { KraTemplate, KraKpi, KraScoreSpec, KraBand } from "./templates";
import { allKpis } from "./templates";

export type KraMetricValue = number | string | null | undefined;

// Score one KPI from a raw value (number for tiers/manual-counts, band string
// for manualBands). Returns 0 when the value is missing.
export function scoreKpi(spec: KraScoreSpec, value: KraMetricValue): number {
  if (value === null || value === undefined || value === "") return 0;
  if (spec.kind === "numericTiers") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    // tiers are authored descending; first satisfied wins.
    for (const t of spec.tiers) if (n >= t.gte) return t.points;
    return 0;
  }
  // manualBands
  const band = spec.bands.find((b) => b.value === value);
  return band ? band.points : 0;
}

export type KraLineItem = {
  sectionRef: string;
  ref: string;
  name: string;
  source: "AUTO" | "MANUAL";
  maxPoints: number;
  value: KraMetricValue;
  points: number;
};

export type KraGateRequirement = {
  key: string;
  label: string;
  unit: "INR" | "COUNT" | "PCT";
  threshold: number;
  value: number;
  met: boolean;
};

export type KraScorecardResult = {
  lineItems: KraLineItem[];
  sectionTotals: { ref: string; title: string; points: number; max: number }[];
  totalScore: number;
  totalMax: number;
  gate: { passed: boolean; description: string; requirements: KraGateRequirement[] };
  band: KraBand;
  multiplier: { factor: number; label: string } | null;
  // Final payout fraction of the incentive pool = basePct × multiplier, ONLY if
  // the gate passed (else 0). Expressed 0–1.1+.
  finalPayoutPct: number;
  rampMonth: number; // 1, 2, or 3 (3 = full / steady-state)
};

export function bandForScore(score: number, bands: KraBand[]): KraBand {
  // bands authored high→low; first whose minScore is met wins.
  for (const b of bands) if (score >= b.minScore) return b;
  return bands[bands.length - 1];
}

function gateThreshold(req: KraTemplate["gate"]["requires"][number], rampMonth: number): number {
  if (rampMonth <= 1) return req.ramp[0];
  if (rampMonth === 2) return req.ramp[1];
  return req.full;
}

// metrics: merged map of auto + manual values keyed by autoKey (auto) and by
// KPI ref (manual). Gate keys are looked up in the same merged map.
export function computeScorecard(
  template: KraTemplate,
  metrics: Record<string, KraMetricValue>,
  rampMonth = 3
): KraScorecardResult {
  const ramp = rampMonth < 1 ? 1 : rampMonth > 3 ? 3 : Math.round(rampMonth);

  const valueForKpi = (kpi: KraKpi): KraMetricValue => {
    if (kpi.source === "AUTO" && kpi.autoKey) return metrics[kpi.autoKey];
    return metrics[kpi.ref]; // manual entries keyed by ref
  };

  const lineItems: KraLineItem[] = [];
  for (const section of template.sections) {
    for (const kpi of section.kpis) {
      const value = valueForKpi(kpi);
      lineItems.push({
        sectionRef: section.ref,
        ref: kpi.ref,
        name: kpi.name,
        source: kpi.source,
        maxPoints: kpi.maxPoints,
        value: value ?? null,
        points: scoreKpi(kpi.score, value),
      });
    }
  }

  const sectionTotals = template.sections.map((s) => ({
    ref: s.ref,
    title: s.title,
    points: lineItems.filter((l) => l.sectionRef === s.ref).reduce((a, l) => a + l.points, 0),
    max: s.maxPoints,
  }));

  const totalScore = sectionTotals.reduce((a, s) => a + s.points, 0);
  const totalMax = template.sections.reduce((a, s) => a + s.maxPoints, 0);

  const requirements: KraGateRequirement[] = template.gate.requires.map((req) => {
    const threshold = gateThreshold(req, ramp);
    const raw = metrics[req.key];
    const value = typeof raw === "number" ? raw : Number(raw ?? 0);
    const v = Number.isFinite(value) ? value : 0;
    return { key: req.key, label: req.label, unit: req.unit, threshold, value: v, met: v >= threshold };
  });
  const gatePassed = requirements.every((r) => r.met);

  const band = bandForScore(totalScore, template.bands);

  let multiplier: { factor: number; label: string } | null = null;
  if (template.multiplier) {
    const sel = metrics[template.multiplier.manualKey];
    const opt = template.multiplier.options.find((o) => o.value === sel);
    multiplier = opt ? { factor: opt.factor, label: opt.label } : { factor: 1, label: "At benchmark (default)" };
  }

  const finalPayoutPct = gatePassed ? (band.basePct / 100) * (multiplier?.factor ?? 1) : 0;

  return {
    lineItems,
    sectionTotals,
    totalScore,
    totalMax,
    gate: { passed: gatePassed, description: template.gate.description, requirements },
    band,
    multiplier,
    finalPayoutPct,
    rampMonth: ramp,
  };
}

// Convenience: how many KPIs still need a manual entry (for the UI "X to fill").
export function pendingManualCount(template: KraTemplate, metrics: Record<string, KraMetricValue>): number {
  return allKpis(template).filter((k) => k.source === "MANUAL" && (metrics[k.ref] === undefined || metrics[k.ref] === null || metrics[k.ref] === "")).length;
}
