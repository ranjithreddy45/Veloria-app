import { describe, expect, it } from "vitest";
import { MIN_CREDIBLE_SLOT_PRICE, isCredibleSlotPrice } from "./credible-slot-price";

// The floor the guest app's prices pass through (guest-public.actions.ts:
// customerSlotPrice). Below it a figure is a placeholder someone saved, not a
// price, and the screens fall back to "Price on request" — nothing is ever
// corrected, rounded or invented.

describe("isCredibleSlotPrice", () => {
  it("refuses the placeholder prices two live halls actually carry", () => {
    // Venue.pricePerSlot of 1 and 2 printed as "from ₹1" under a 2,000-guest resort.
    expect(isCredibleSlotPrice(1)).toBe(false);
    expect(isCredibleSlotPrice(2)).toBe(false);
  });

  it("refuses anything below the floor, and zero and negatives with it", () => {
    expect(isCredibleSlotPrice(MIN_CREDIBLE_SLOT_PRICE - 1)).toBe(false);
    expect(isCredibleSlotPrice(0)).toBe(false);
    expect(isCredibleSlotPrice(-5000)).toBe(false);
  });

  it("accepts the floor itself and everything above it, unchanged", () => {
    expect(isCredibleSlotPrice(MIN_CREDIBLE_SLOT_PRICE)).toBe(true);
    expect(isCredibleSlotPrice(MIN_CREDIBLE_SLOT_PRICE + 1)).toBe(true);
    expect(isCredibleSlotPrice(185_000)).toBe(true);
  });

  it("treats a missing or unusable figure as no price", () => {
    expect(isCredibleSlotPrice(null)).toBe(false);
    expect(isCredibleSlotPrice(undefined)).toBe(false);
    expect(isCredibleSlotPrice(Number.NaN)).toBe(false);
    expect(isCredibleSlotPrice(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("keeps a floor that is a plausible banquet slot, not a token", () => {
    // A guard on the constant itself: a floor of 1 would let the placeholder through.
    expect(MIN_CREDIBLE_SLOT_PRICE).toBeGreaterThanOrEqual(100);
  });
});

// The shape the action applies: refuse, never adjust.
function customerSlotPrice(price: number | null | undefined): number | null {
  return isCredibleSlotPrice(price) ? (price as number) : null;
}

describe("the price the customer app prints", () => {
  it("is null below the floor and the engine's own figure at or above it", () => {
    expect(customerSlotPrice(1)).toBeNull();
    expect(customerSlotPrice(MIN_CREDIBLE_SLOT_PRICE - 0.5)).toBeNull();
    expect(customerSlotPrice(MIN_CREDIBLE_SLOT_PRICE)).toBe(MIN_CREDIBLE_SLOT_PRICE);
    expect(customerSlotPrice(247_500)).toBe(247_500);
  });
});
