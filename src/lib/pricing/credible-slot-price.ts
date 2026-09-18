// ============================================================
// Is a hall's slot price real, or a placeholder someone saved?
//
// A banquet slot is never ₹1. Two live halls carried 1 and 2 as their
// pricePerSlot, and the customer app printed "from ₹1" for a 2,000-guest
// resort. The rule is deliberately dumb and one-directional: a figure below
// the floor is treated as MISSING (screens already say "Price on request"),
// never corrected, rounded or invented — the team's record is left exactly as
// it is, and the team's own venue list flags it so someone fixes the number.
// ============================================================

/** Below this, a per-slot price is a placeholder rather than a price (rupees). */
export const MIN_CREDIBLE_SLOT_PRICE = 1000;

/** True when a per-slot price is worth showing a customer. */
export function isCredibleSlotPrice(price: number | null | undefined): boolean {
  return typeof price === "number" && Number.isFinite(price) && price >= MIN_CREDIBLE_SLOT_PRICE;
}
