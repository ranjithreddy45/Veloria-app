// ============================================================
// Yield / Dynamic Pricing Engine (pure — no DB calls)
// ------------------------------------------------------------
// computeYieldPrice() takes the venue base price, the active PricingRules, the
// matching VenueDemandSignal, and the default RatePlan as INPUTS and returns the
// priced result. Keeping it DB-free makes it directly testable; the action layer
// (src/actions/yield-pricing.actions.ts) performs the reads.
//
// It ports the legacy filter + cumulative-multiplier pipeline from
// src/actions/pricing.actions.ts calculatePrice (lines 593-672, copied verbatim
// for the 5 legacy rule types so behavior is identical) and ADDS three new
// yield rule types:
//   OCCUPANCY  — fires when minOccupancyPct <= signal.occupancyPct <= maxOccupancyPct
//   DEMAND     — fires when minDemandScore  <= signal.demandScore  <= maxDemandScore
//   LEAD_TIME  — fires when minLeadDays     <= daysAhead           <= maxLeadDays
// Thresholds live in PricingRule.conditions Json; missing bounds are treated as
// fully open (defensive, since the Json is unvalidated at the DB layer).
//
// If the matching VenueDemandSignal carries a manualMultiplier it is applied
// LAST (after all rules, before guestCharge) as a deliberate override and is
// reported as a synthetic applied entry.
//
// NOTE (drift risk): the legacy 5-type logic below is a verbatim copy of
// calculatePrice. If that action changes, this must be kept in sync. A future
// refactor could have calculatePrice delegate here, but that edits the shared
// action file and is deferred.
// ============================================================

export interface YieldRuleInput {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  conditions: unknown;
  startDate: Date | string | null;
  endDate: Date | string | null;
  dayOfWeek: number | null;
  minDaysAhead: number | null;
}

export interface YieldDemandSignalInput {
  occupancyPct: number;
  demandScore: number;
  manualMultiplier: number | null;
  source: string;
}

export interface YieldRatePlanInput {
  name: string;
  perGuestRate: number;
}

export interface ComputeYieldPriceArgs {
  venueId: string;
  venueName: string;
  basePrice: number;
  date: Date;
  timeSlot: string;
  guestCount: number;
  rules: YieldRuleInput[];
  /** Slot-specific signal preferred; fall back to whole-day (null slot) at the action layer. */
  demandSignal: YieldDemandSignalInput | null;
  ratePlan: YieldRatePlanInput | null;
}

export interface AppliedYieldRule {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  priceAfter: number;
}

export interface YieldPriceResult {
  venueId: string;
  venueName: string;
  basePrice: number;
  calculatedSlotPrice: number;
  guestCharge: number;
  guestCount: number;
  perGuestRate: number;
  ratePlanName: string | null;
  totalPrice: number;
  appliedRules: AppliedYieldRule[];
  rulesEvaluated: number;
  rulesApplied: number;
  demandSignal: {
    occupancyPct: number;
    demandScore: number;
    source: string | null;
    manualMultiplier: number | null;
  } | null;
}

function readNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function withinBand(
  value: number,
  min: number | null,
  max: number | null
): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export function computeYieldPrice(args: ComputeYieldPriceArgs): YieldPriceResult {
  const {
    venueId,
    venueName,
    basePrice,
    date,
    timeSlot,
    guestCount,
    rules,
    demandSignal,
    ratePlan,
  } = args;

  const bookingDate = new Date(date);
  bookingDate.setHours(0, 0, 0, 0);

  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysAhead = Math.floor(
    (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const occupancyPct = demandSignal ? demandSignal.occupancyPct : 0;
  const demandScore = demandSignal ? demandSignal.demandScore : 0;

  // ----------------------------------------------------------
  // Filter rules that apply to this booking.
  // Legacy 5 types: copied verbatim from pricing.actions.ts calculatePrice.
  // New 3 yield types: band checks against the demand signal / lead time.
  // ----------------------------------------------------------
  const applicableRules = rules.filter((rule) => {
    switch (rule.ruleType) {
      case "SEASONAL":
        // Rule applies if booking date falls within start/end range
        if (rule.startDate && bookingDate < new Date(rule.startDate)) return false;
        if (rule.endDate && bookingDate > new Date(rule.endDate)) return false;
        return true;

      case "DAY_OF_WEEK":
        // Rule applies if the booking date is on the specified day
        return rule.dayOfWeek === dayOfWeek;

      case "PEAK_HOUR":
        // Rule applies based on time slot — check conditions or apply to all
        if (rule.conditions && typeof rule.conditions === "object") {
          const conditions = rule.conditions as { timeSlots?: string[] };
          if (conditions.timeSlots) {
            return conditions.timeSlots.includes(timeSlot);
          }
        }
        return true;

      case "EARLY_BIRD":
        // Rule applies if booking is made enough days ahead
        if (rule.minDaysAhead !== null && rule.minDaysAhead !== undefined) {
          return daysAhead >= rule.minDaysAhead;
        }
        return daysAhead >= 30; // Default 30 days

      case "LAST_MINUTE":
        // Rule applies if booking is made within minDaysAhead days
        if (rule.minDaysAhead !== null && rule.minDaysAhead !== undefined) {
          return daysAhead <= rule.minDaysAhead;
        }
        return daysAhead <= 7; // Default 7 days

      // ---- New yield rule types (read the demand signal / lead time) ----
      case "OCCUPANCY": {
        const c =
          rule.conditions && typeof rule.conditions === "object"
            ? (rule.conditions as Record<string, unknown>)
            : {};
        const min = readNum(c.minOccupancyPct) ?? 0;
        const max = readNum(c.maxOccupancyPct) ?? 100;
        return withinBand(occupancyPct, min, max);
      }

      case "DEMAND": {
        const c =
          rule.conditions && typeof rule.conditions === "object"
            ? (rule.conditions as Record<string, unknown>)
            : {};
        const min = readNum(c.minDemandScore) ?? 0;
        const max = readNum(c.maxDemandScore) ?? 100;
        return withinBand(demandScore, min, max);
      }

      case "LEAD_TIME": {
        const c =
          rule.conditions && typeof rule.conditions === "object"
            ? (rule.conditions as Record<string, unknown>)
            : {};
        const min = readNum(c.minLeadDays);
        const max = readNum(c.maxLeadDays);
        // Either bound optional; missing => open on that side.
        return withinBand(daysAhead, min, max);
      }

      default:
        return false;
    }
  });

  // ----------------------------------------------------------
  // Apply multipliers cumulatively (verbatim from calculatePrice).
  // Round only at priceAfter/totalPrice to stay rupee-consistent.
  // ----------------------------------------------------------
  let calculatedPrice = basePrice;
  const appliedRules: AppliedYieldRule[] = [];

  for (const rule of applicableRules) {
    const multiplier = Number(rule.multiplier);
    calculatedPrice = calculatedPrice * multiplier;
    appliedRules.push({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      multiplier,
      priceAfter: Math.round(calculatedPrice),
    });
  }

  // ----------------------------------------------------------
  // Manual override multiplier (applied last, before guestCharge).
  // ----------------------------------------------------------
  if (
    demandSignal &&
    demandSignal.manualMultiplier !== null &&
    demandSignal.manualMultiplier !== undefined &&
    Number.isFinite(demandSignal.manualMultiplier) &&
    demandSignal.manualMultiplier > 0
  ) {
    const multiplier = Number(demandSignal.manualMultiplier);
    calculatedPrice = calculatedPrice * multiplier;
    appliedRules.push({
      id: "__manual_override__",
      name: "Manual Override",
      ruleType: "MANUAL_OVERRIDE",
      multiplier,
      priceAfter: Math.round(calculatedPrice),
    });
  }

  // ----------------------------------------------------------
  // Add per-guest rate from the default RatePlan.
  // ----------------------------------------------------------
  let guestCharge = 0;
  let perGuestRate = 0;
  if (ratePlan) {
    perGuestRate = Number(ratePlan.perGuestRate);
    guestCharge = perGuestRate * guestCount;
  }

  const totalPrice = Math.round(calculatedPrice + guestCharge);

  return {
    venueId,
    venueName,
    basePrice,
    calculatedSlotPrice: Math.round(calculatedPrice),
    guestCharge,
    guestCount,
    perGuestRate,
    ratePlanName: ratePlan?.name ?? null,
    totalPrice,
    appliedRules,
    rulesEvaluated: rules.length,
    rulesApplied: applicableRules.length,
    demandSignal: demandSignal
      ? {
          occupancyPct,
          demandScore,
          source: demandSignal.source ?? null,
          manualMultiplier: demandSignal.manualMultiplier ?? null,
        }
      : null,
  };
}
