// ============================================================
// Date-demand pricing engine — how much to charge on a given date.
// ------------------------------------------------------------
// Classifies an event date into a demand TIER (Muhurtham / festival / weekend /
// regular), derives the recommended PREMIUM % (a % uplift on the whole quote),
// and bumps it by SCARCITY (how booked the date already is). Pure + deterministic
// so it's testable; the server action feeds it config + peak-date + booking data.
// Premiums are advisory (warn-loudly, allow) — they tell reps the floor, they
// don't silently change the maths.
// ============================================================

export type DemandTier = "MUHURTHAM" | "FESTIVAL" | "WEEKEND" | "REGULAR";

export interface DemandConfig {
  enabled: boolean;
  muhurthamPct: number;
  festivalPct: number;
  saturdayPct: number;
  sundayPct: number;
  scarcityStepPct: number;
  scarcityCapPct: number;
}

export const DEFAULT_DEMAND_CONFIG: DemandConfig = {
  enabled: true,
  muhurthamPct: 20,
  festivalPct: 15,
  saturdayPct: 12,
  sundayPct: 8,
  scarcityStepPct: 5,
  scarcityCapPct: 30,
};

export interface DateDemand {
  tier: DemandTier;
  label: string;
  basePremiumPct: number; // from tier (Muhurtham/festival/weekend)
  scarcityBumpPct: number; // from how booked the date is
  premiumPct: number; // total recommended premium %
  bookedSlotsOnDate: number;
  /** Peak dates should NOT be discounted / early-birded away. */
  noDiscount: boolean;
  advice: string;
}

export interface PeakDateInfo {
  type: "MUHURTHAM" | "FESTIVAL" | "CUSTOM";
  label: string;
  premiumPct: number | null; // per-date override
}

/**
 * Classify a date. `weekdayUtc` is getUTCDay() of the @db.Date (0=Sun..6=Sat) —
 * which is the venue's local weekday since dates are stored at UTC midnight of
 * the local calendar day. `peak` is the matching PeakDate row (if any).
 */
export function classifyDateDemand(
  config: DemandConfig,
  weekdayUtc: number,
  peak: PeakDateInfo | null,
  bookedSlotsOnDate: number
): DateDemand {
  if (!config.enabled) {
    return { tier: "REGULAR", label: "Standard date", basePremiumPct: 0, scarcityBumpPct: 0, premiumPct: 0, bookedSlotsOnDate, noDiscount: false, advice: "Standard pricing." };
  }

  let tier: DemandTier = "REGULAR";
  let basePremiumPct = 0;
  let label = "Standard date";

  if (peak) {
    if (peak.type === "MUHURTHAM") {
      tier = "MUHURTHAM";
      basePremiumPct = peak.premiumPct ?? config.muhurthamPct;
      label = peak.label || "Muhurtham date";
    } else if (peak.type === "FESTIVAL") {
      tier = "FESTIVAL";
      basePremiumPct = peak.premiumPct ?? config.festivalPct;
      label = peak.label || "Festival date";
    } else {
      // CUSTOM peak date — only premium if an explicit override is set.
      basePremiumPct = peak.premiumPct ?? 0;
      if (basePremiumPct > 0) { tier = "FESTIVAL"; label = peak.label || "Peak date"; }
    }
  }

  // Weekend (only if not already a higher-tier peak date — take the stronger base).
  if (weekdayUtc === 6 && config.saturdayPct > basePremiumPct) {
    tier = tier === "REGULAR" ? "WEEKEND" : tier;
    if (config.saturdayPct > basePremiumPct) basePremiumPct = config.saturdayPct;
    if (tier === "WEEKEND") label = "Saturday (weekend)";
  } else if (weekdayUtc === 0 && config.sundayPct > basePremiumPct) {
    tier = tier === "REGULAR" ? "WEEKEND" : tier;
    if (config.sundayPct > basePremiumPct) basePremiumPct = config.sundayPct;
    if (tier === "WEEKEND") label = "Sunday (weekend)";
  } else if (peak == null && (weekdayUtc === 6 || weekdayUtc === 0)) {
    // Weekend but its pct didn't beat 0 (config 0) — still mark as weekend, 0%.
    tier = "WEEKEND";
    label = weekdayUtc === 6 ? "Saturday (weekend)" : "Sunday (weekend)";
  }

  const scarcityBumpPct = Math.min(config.scarcityCapPct, Math.max(0, bookedSlotsOnDate) * config.scarcityStepPct);
  const premiumPct = basePremiumPct + scarcityBumpPct;
  const noDiscount = tier !== "REGULAR";

  const parts: string[] = [];
  if (tier === "MUHURTHAM") parts.push("Muhurtham — high-demand wedding date");
  else if (tier === "FESTIVAL") parts.push("Festival / peak date");
  else if (tier === "WEEKEND") parts.push("Weekend date");
  if (scarcityBumpPct > 0) parts.push(`this date is filling up (${bookedSlotsOnDate} slot${bookedSlotsOnDate > 1 ? "s" : ""} booked)`);
  let advice = premiumPct > 0
    ? `${parts.join(" · ")}. Charge a +${premiumPct}% premium. Hold firm — do not apply early-bird or sell-down discounts on this date.`
    : "Standard date — price normally; you can be flexible to win the booking.";

  return { tier, label, basePremiumPct, scarcityBumpPct, premiumPct, bookedSlotsOnDate, noDiscount, advice };
}

/** Recommended minimum pre-tax value: the un-discounted subtotal, plus the premium. */
export function recommendedFloorPreTax(subtotal: number, premiumPct: number): number {
  return Math.round(subtotal * (1 + premiumPct / 100));
}
