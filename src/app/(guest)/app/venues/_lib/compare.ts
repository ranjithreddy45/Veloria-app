import { hallPriceText } from "@/app/(guest)/_components/format";

// ============================================================
// Compare halls — pure shaping for /app/venues/compare. Every figure comes in
// from the records the team uses (Venue, the team's hall pricing engine,
// approved public reviews); this only lines them up side by side.
// ============================================================

export const COMPARE_MAX = 3;

type Param = string | string[] | undefined;
const values = (v: Param): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Halls picked for comparison (?h=a&h=b, or ?ids=a,b): known halls only, de-duplicated, at most three. `extra` counts picks beyond three. */
export function parseCompareIds(params: { h?: Param; ids?: Param }, knownIds: readonly string[]): { ids: string[]; extra: number } {
  const picked = [...values(params.h), ...values(params.ids).flatMap((s) => s.split(","))].map((s) => s.trim()).filter(Boolean);
  const known = new Set(knownIds);
  const unique: string[] = [];
  for (const id of picked) if (known.has(id) && !unique.includes(id)) unique.push(id);
  return { ids: unique.slice(0, COMPARE_MAX), extra: Math.max(0, unique.length - COMPARE_MAX) };
}

export interface CompareHallInput {
  id: string;
  name: string;
  /** Venue.capacity */
  capacity: number;
  /** Venue.amenities */
  amenities: string[];
  /** getGuestHallPrices — the team's pricing engine. */
  price: { fromSlotPrice: number | null; perGuestRate: number } | null;
  /** getGuestVenueRatings — approved public reviews. */
  rating: { rating: number; count: number } | null;
  /** Venue.inHouseCateringRequired; null when it could not be read. */
  inHouseCateringRequired: boolean | null;
  inHouseCateringNote: string | null;
}

export interface CompareCell {
  main: string;
  sub: string | null;
}

export interface Comparison {
  halls: { id: string; name: string }[];
  capacity: CompareCell[];
  price: CompareCell[];
  rating: CompareCell[];
  catering: CompareCell[];
  /** Every amenity any hall lists; `has[i]` = hall i lists it. Shared amenities first. */
  amenities: { label: string; has: boolean[] }[];
}

export function buildComparison(halls: readonly CompareHallInput[]): Comparison {
  const labels = new Map<string, string>();
  const order: string[] = [];
  const listed = halls.map((h) => {
    const keys = new Set<string>();
    for (const raw of h.amenities) {
      const label = raw.trim().replace(/\s+/g, " ");
      if (!label) continue;
      const key = label.toLowerCase();
      if (!labels.has(key)) {
        labels.set(key, label);
        order.push(key);
      }
      keys.add(key);
    }
    return keys;
  });
  const amenities = order
    .map((key) => ({ label: labels.get(key) as string, has: listed.map((keys) => keys.has(key)) }))
    // Amenities more halls share come first; ties keep the order the team listed them in (stable sort).
    .sort((a, b) => b.has.filter(Boolean).length - a.has.filter(Boolean).length);

  return {
    halls: halls.map((h) => ({ id: h.id, name: h.name })),
    capacity: halls.map((h) => ({ main: `Up to ${h.capacity.toLocaleString("en-IN")}`, sub: "guests" })),
    price: halls.map((h) => {
      const t = hallPriceText(h.price);
      return { main: t.main, sub: t.sub };
    }),
    rating: halls.map((h) =>
      h.rating && h.rating.count > 0
        ? { main: `${h.rating.rating} ★`, sub: `${h.rating.count} review${h.rating.count === 1 ? "" : "s"}` }
        : { main: "No reviews yet", sub: null }
    ),
    catering: halls.map((h) =>
      h.inHouseCateringRequired === null
        ? { main: "Not available", sub: null }
        : h.inHouseCateringRequired
          ? { main: "Required", sub: h.inHouseCateringNote?.trim() || null }
          : { main: "Not required", sub: null }
    ),
    amenities,
  };
}
