// ============================================================
// Home screen — the browse-first rules.
//
// Pure: no React, no Prisma, no server imports, so the order of the spaces
// rail and every count and label around it can be read and tested on their
// own. The home screen is the only caller. The search itself, the capacity
// bands and the hall card belong to the feed (venues/_lib/hall-search.ts) and
// are used from there — this file never restates them.
//
// Honesty: every number here comes from a caller's real records — the count
// in "See all 11 spaces" is the number of halls the feed actually returned,
// never a figure typed into the design.
// ============================================================

/** The little a hall needs for the rail's order; a feed item carries far more. */
export interface RailHall {
  id: string;
  capacity: number;
}

/** How many halls the rail shows before the "See all" card. */
export const RAIL_LIMIT = 8;

/**
 * The order halls appear in the home rail: the hall the team books most often
 * first (a real signal — getGuestMostBookedVenueId), then the largest rooms.
 * Equal capacities keep the order they arrived in, so the rail never shuffles
 * between renders.
 */
export function orderHallsForRail<T extends RailHall>(
  halls: readonly T[],
  mostBookedId?: string | null
): T[] {
  const arrived = new Map(halls.map((h, i) => [h.id, i]));
  const at = (id: string) => arrived.get(id) ?? 0;
  return [...halls].sort((a, b) => {
    if (mostBookedId) {
      if (a.id === mostBookedId && b.id !== mostBookedId) return -1;
      if (b.id === mostBookedId && a.id !== mostBookedId) return 1;
    }
    return b.capacity - a.capacity || at(a.id) - at(b.id);
  });
}

/** The rail's last card. The count is how many halls there really are. */
export function seeAllLabel(total: number): string {
  if (total <= 0) return "See all spaces";
  return `See all ${total.toLocaleString("en-IN")} space${total === 1 ? "" : "s"}`;
}

/**
 * The line under the home heading: how many spaces there are and the party
 * sizes they really seat. Stays honest when there are none yet, and claims no
 * range when the halls carry no capacity.
 */
export function browseSubtitle(total: number, capacityRange?: string | null): string {
  if (total <= 0) return "Our spaces appear here as soon as the team publishes them.";
  const spaces = total === 1 ? "One space" : `${total.toLocaleString("en-IN")} spaces`;
  return capacityRange ? `${spaces} at one address, seating ${capacityRange}.` : `${spaces} at one address.`;
}

/**
 * The home screen's compact countdown to a booked event: "Today", "in 12
 * days", "12 days ago". `days` is whole India-calendar days from
 * daysUntilEvent, so this reads the same as the event screen's own count.
 */
export function countdownPhrase(days: number): string {
  if (days === 0) return "Today";
  const n = Math.abs(days);
  const unit = `day${n === 1 ? "" : "s"}`;
  return days > 0 ? `in ${n.toLocaleString("en-IN")} ${unit}` : `${n.toLocaleString("en-IN")} ${unit} ago`;
}

/** The same count as a big figure and its caption, for the event summary card. */
export function countdownFigure(days: number): { value: string; caption: string } {
  if (days === 0) return { value: "Today", caption: "is your event day" };
  const n = Math.abs(days);
  const unit = `day${n === 1 ? "" : "s"}`;
  return { value: n.toLocaleString("en-IN"), caption: days > 0 ? `${unit} to go` : `${unit} ago` };
}

/**
 * The party sizes the published halls really seat — "100–2,000 guests".
 * Null when no hall carries a capacity, so the heading claims no range that
 * the records don't support.
 */
export function capacityRangeText(halls: readonly RailHall[]): string | null {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const h of halls) {
    if (!(h.capacity > 0)) continue;
    if (h.capacity < min) min = h.capacity;
    if (h.capacity > max) max = h.capacity;
  }
  if (max <= 0) return null;
  const n = (v: number) => v.toLocaleString("en-IN");
  return min === max ? `${n(max)} guests` : `${n(min)}–${n(max)} guests`;
}
