import { computeYieldPrice, type YieldDemandSignalInput, type YieldRuleInput } from "@/lib/pricing/yield-engine";

// ============================================================
// A hall's customer-facing "from" price, produced by the team's own hall
// pricing engine.
//
// The staff price simulator (/pricing/yield → calculateYieldPrice) prices a
// hall for a date and slot with computeYieldPrice(): Venue.pricePerSlot, times
// every active PricingRule that applies (and any demand-signal override), plus
// the default RatePlan's per-guest rate. Customer screens used to print the raw
// pricePerSlot, which ignores all of that: a surcharge on every evening slot
// or an early-bird discount never reached the customer.
//
// "From" is the lowest slot price that same engine produces for the hall on
// any date a customer can pick (the next twelve months) and any slot. Pure:
// the action layer loads the rows calculateYieldPrice loads and passes them
// in. Only the resulting figure leaves the server — rules and multipliers are
// internal pricing levers.
// ============================================================

/** The bookable slots (TimeSlot enum). */
export const HALL_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;

/** Days scanned from today; the customer availability calendar reaches twelve months ahead. */
export const FROM_PRICE_WINDOW_DAYS = 366;

export interface HallDemandSignal extends YieldDemandSignalInput {
  /** Calendar day of the VenueDemandSignal row (a @db.Date, so its UTC date). */
  dateISO: string;
  /** null = a whole-day signal. */
  timeSlot: string | null;
}

export interface HallPricingInputs {
  venueId: string;
  venueName: string;
  /** Venue.pricePerSlot. */
  basePrice: number;
  /** The hall's active PricingRules, priority ascending (the order calculateYieldPrice uses). */
  rules: YieldRuleInput[];
  /** VenueDemandSignals inside the window. */
  signals: HallDemandSignal[];
  /** The default RatePlan calculateYieldPrice picks for this hall. */
  ratePlan: { name: string; perGuestRate: number } | null;
}

export interface HallFromPrice {
  /** Lowest slot price the engine gives in the window; null when the hall has no usable price. */
  fromSlotPrice: number | null;
  /** Per-guest rate the engine adds on top of the slot price (0 when there is none). */
  perGuestRate: number;
  /** First date and slot where the lowest price occurs. */
  lowestAt: { dateISO: string; timeSlot: string } | null;
}

/** Today's calendar date in Asia/Kolkata, as YYYY-MM-DD. */
export function istTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** YYYY-MM-DD plus n calendar days (UTC arithmetic, so no DST drift). */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function hallFromPrice(input: HallPricingInputs, opts: { startISO?: string; days?: number } = {}): HallFromPrice {
  const rate = input.ratePlan ? Number(input.ratePlan.perGuestRate) : 0;
  const perGuestRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const basePrice = Number(input.basePrice);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return { fromSlotPrice: null, perGuestRate, lowestAt: null };

  const startISO = opts.startISO ?? istTodayISO();
  // Nothing can move the price: every date and slot is the base price.
  if (input.rules.length === 0 && input.signals.length === 0) {
    return { fromSlotPrice: Math.round(basePrice), perGuestRate, lowestAt: { dateISO: startISO, timeSlot: HALL_SLOTS[0] } };
  }

  const signalAt = new Map<string, HallDemandSignal>();
  for (const s of input.signals) signalAt.set(`${s.dateISO}|${s.timeSlot ?? ""}`, s);

  const days = Math.max(1, Math.floor(opts.days ?? FROM_PRICE_WINDOW_DAYS));
  let lowest: number | null = null;
  let lowestAt: HallFromPrice["lowestAt"] = null;
  for (let i = 0; i < days; i++) {
    const dateISO = addDaysISO(startISO, i);
    // The staff simulator passes the chosen day as UTC midnight; do the same.
    const date = new Date(`${dateISO}T00:00:00.000Z`);
    for (const timeSlot of HALL_SLOTS) {
      // Slot-specific signal first, whole-day signal as the fallback — the order calculateYieldPrice uses.
      const demandSignal = signalAt.get(`${dateISO}|${timeSlot}`) ?? signalAt.get(`${dateISO}|`) ?? null;
      const { calculatedSlotPrice } = computeYieldPrice({
        venueId: input.venueId,
        venueName: input.venueName,
        basePrice,
        date,
        timeSlot,
        guestCount: 0,
        rules: input.rules,
        demandSignal,
        ratePlan: input.ratePlan,
      });
      if (lowest === null || calculatedSlotPrice < lowest) {
        lowest = calculatedSlotPrice;
        lowestAt = { dateISO, timeSlot };
      }
    }
  }
  if (lowest === null || lowest <= 0) return { fromSlotPrice: null, perGuestRate, lowestAt: null };
  return { fromSlotPrice: lowest, perGuestRate, lowestAt };
}
