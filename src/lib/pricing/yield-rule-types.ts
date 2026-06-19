// ============================================================
// Yield Pricing — shared label/color constants for the 3 new rule types.
// ------------------------------------------------------------
// Kept in this dedicated file (rather than the shared src/lib/constants.ts) to
// avoid edit conflicts with concurrent features. Mirrors the style of
// PRICING_RULE_TYPE_LABELS / PRICING_RULE_TYPE_COLORS in src/lib/constants.ts.
// ============================================================

export const YIELD_RULE_TYPE_LABELS: Record<string, string> = {
  OCCUPANCY: "Occupancy",
  DEMAND: "Demand",
  LEAD_TIME: "Lead Time",
} as const;

export const YIELD_RULE_TYPE_COLORS: Record<string, string> = {
  OCCUPANCY:
    "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  DEMAND:
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800/40",
  LEAD_TIME:
    "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
} as const;

// ------------------------------------------------------------
// Defensive readers for the conditions Json (treat missing as fully-open).
// ------------------------------------------------------------

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Human-readable summary of a yield rule's conditions + multiplier, for tables.
 * e.g. "70-100% occupancy → 1.25x", "0-7 days ahead → 0.85x".
 */
export function describeYieldConditions(
  ruleType: string,
  conditions: unknown,
  multiplier?: number
): string {
  const c =
    conditions && typeof conditions === "object"
      ? (conditions as Record<string, unknown>)
      : {};
  const mult =
    multiplier !== undefined && multiplier !== null
      ? ` → ${multiplier}x`
      : "";

  switch (ruleType) {
    case "OCCUPANCY": {
      const min = num(c.minOccupancyPct) ?? 0;
      const max = num(c.maxOccupancyPct) ?? 100;
      return `${min}-${max}% occupancy${mult}`;
    }
    case "DEMAND": {
      const min = num(c.minDemandScore) ?? 0;
      const max = num(c.maxDemandScore) ?? 100;
      return `${min}-${max} demand${mult}`;
    }
    case "LEAD_TIME": {
      const min = num(c.minLeadDays);
      const max = num(c.maxLeadDays);
      if (min !== null && max !== null) return `${min}-${max} days ahead${mult}`;
      if (min !== null) return `${min}+ days ahead${mult}`;
      if (max !== null) return `Within ${max} days${mult}`;
      return `Any lead time${mult}`;
    }
    default:
      return "--";
  }
}
