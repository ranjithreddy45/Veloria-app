import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeYieldPrice, type YieldRuleInput } from "@/lib/pricing/yield-engine";
import {
  addDaysISO,
  FROM_PRICE_WINDOW_DAYS,
  HALL_SLOTS,
  hallFromPrice,
  istTodayISO,
  type HallDemandSignal,
  type HallPricingInputs,
} from "./hall-pricing";

// 12:00 IST on Wednesday 16 Sep 2026.
const NOW = new Date("2026-09-16T06:30:00.000Z");
const TODAY = "2026-09-16";

function rule(r: Pick<YieldRuleInput, "ruleType" | "multiplier"> & Partial<YieldRuleInput>): YieldRuleInput {
  return { id: `rule-${r.ruleType}`, name: r.ruleType, conditions: null, startDate: null, endDate: null, dayOfWeek: null, minDaysAhead: null, ...r };
}

function signal(s: Pick<HallDemandSignal, "dateISO"> & Partial<HallDemandSignal>): HallDemandSignal {
  return { timeSlot: null, occupancyPct: 0, demandScore: 0, manualMultiplier: null, source: "MANUAL", ...s };
}

function hall(h: Partial<HallPricingInputs> = {}): HallPricingInputs {
  return { venueId: "hall-1", venueName: "Crystal Hall", basePrice: 100000, rules: [], signals: [], ratePlan: null, ...h };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("hallFromPrice", () => {
  it("is the hall's price when no rule or signal applies", () => {
    expect(hallFromPrice(hall())).toEqual({ fromSlotPrice: 100000, perGuestRate: 0, lowestAt: { dateISO: TODAY, timeSlot: "MORNING" } });
  });

  it("has no price when the hall's price is not set", () => {
    expect(hallFromPrice(hall({ basePrice: 0 }))).toEqual({ fromSlotPrice: null, perGuestRate: 0, lowestAt: null });
    expect(hallFromPrice(hall({ basePrice: Number.NaN, rules: [rule({ ruleType: "PEAK_HOUR", multiplier: 1.2 })] })).fromSlotPrice).toBeNull();
  });

  it("raises the floor when a rule applies to every date and slot", () => {
    expect(hallFromPrice(hall({ rules: [rule({ ruleType: "PEAK_HOUR", multiplier: 1.2 })] })).fromSlotPrice).toBe(120000);
  });

  it("keeps the floor when a surcharge only applies on some days or slots", () => {
    const saturdays = rule({ ruleType: "DAY_OF_WEEK", dayOfWeek: 6, multiplier: 1.5 });
    const evenings = rule({ ruleType: "PEAK_HOUR", multiplier: 1.4, conditions: { timeSlots: ["EVENING", "FULL_DAY"] } });
    const r = hallFromPrice(hall({ rules: [saturdays, evenings] }));
    expect(r.fromSlotPrice).toBe(100000);
    expect(r.lowestAt?.timeSlot).toBe("MORNING");
  });

  it("lowers the floor to a discount the team's engine would give", () => {
    const r = hallFromPrice(hall({ rules: [rule({ ruleType: "EARLY_BIRD", minDaysAhead: 45, multiplier: 0.9 })] }));
    expect(r.fromSlotPrice).toBe(90000);
    expect(r.lowestAt!.dateISO >= addDaysISO(TODAY, 45)).toBe(true);
  });

  it("finds a weekday discount on that weekday", () => {
    const r = hallFromPrice(hall({ rules: [rule({ ruleType: "DAY_OF_WEEK", dayOfWeek: 2, multiplier: 0.8 })] }));
    expect(r.fromSlotPrice).toBe(80000);
    expect(new Date(`${r.lowestAt!.dateISO}T12:00:00.000Z`).getUTCDay()).toBe(2);
  });

  it("applies a slot-specific demand override on its own date and slot", () => {
    const dateISO = addDaysISO(TODAY, 10);
    const r = hallFromPrice(hall({ signals: [signal({ dateISO, timeSlot: "EVENING", manualMultiplier: 0.75 })] }));
    expect(r).toMatchObject({ fromSlotPrice: 75000, lowestAt: { dateISO, timeSlot: "EVENING" } });
  });

  it("applies a whole-day signal to every slot that day", () => {
    const dateISO = addDaysISO(TODAY, 3);
    const r = hallFromPrice(hall({ signals: [signal({ dateISO, manualMultiplier: 0.7 })] }));
    expect(r).toMatchObject({ fromSlotPrice: 70000, lowestAt: { dateISO, timeSlot: "MORNING" } });
  });

  it("reports the default rate plan's per-guest rate without folding it into the slot price", () => {
    expect(hallFromPrice(hall({ ratePlan: { name: "Standard", perGuestRate: 350 } }))).toMatchObject({ fromSlotPrice: 100000, perGuestRate: 350 });
  });

  it("matches computeYieldPrice's lowest figure across every date and slot", () => {
    const input = hall({
      basePrice: 150000,
      rules: [
        rule({ ruleType: "SEASONAL", multiplier: 1.3, startDate: "2026-12-01T00:00:00.000Z", endDate: "2027-01-31T00:00:00.000Z" }),
        rule({ ruleType: "DAY_OF_WEEK", dayOfWeek: 0, multiplier: 1.1 }),
        rule({ ruleType: "EARLY_BIRD", minDaysAhead: 30, multiplier: 0.95 }),
        rule({ ruleType: "OCCUPANCY", multiplier: 0.9, conditions: { minOccupancyPct: 0, maxOccupancyPct: 20 } }),
      ],
      signals: [signal({ dateISO: addDaysISO(TODAY, 40), occupancyPct: 85 })],
      ratePlan: { name: "Standard", perGuestRate: 200 },
    });
    const priceOn = (dateISO: string, timeSlot: string) =>
      computeYieldPrice({
        venueId: input.venueId,
        venueName: input.venueName,
        basePrice: input.basePrice,
        date: new Date(`${dateISO}T00:00:00.000Z`),
        timeSlot,
        guestCount: 0,
        rules: input.rules,
        demandSignal: input.signals.find((s) => s.dateISO === dateISO) ?? null,
        ratePlan: input.ratePlan,
      }).calculatedSlotPrice;

    let brute = Infinity;
    for (let i = 0; i < FROM_PRICE_WINDOW_DAYS; i++) {
      for (const slot of HALL_SLOTS) brute = Math.min(brute, priceOn(addDaysISO(TODAY, i), slot));
    }
    const r = hallFromPrice(input);
    expect(r.fromSlotPrice).toBe(brute);
    expect(r.fromSlotPrice).toBe(128250); // 1,50,000 × early-bird 0.95 × low-occupancy 0.9
    expect(priceOn(r.lowestAt!.dateISO, r.lowestAt!.timeSlot)).toBe(r.fromSlotPrice);
    expect(r.perGuestRate).toBe(200);
  });
});

describe("calendar helpers", () => {
  it("uses the Indian calendar day for today", () => {
    expect(istTodayISO(new Date("2026-09-16T20:00:00.000Z"))).toBe("2026-09-17");
    expect(istTodayISO(new Date("2026-09-16T18:00:00.000Z"))).toBe("2026-09-16");
  });

  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
});
