// ============================================================
// Occasion = Lead.eventType, which is FREE TEXT.
//
// Production holds "Birthday Party" (93) and "Birthday" (10), "Corporate Event"
// and "Corporate", "Baby Shower" and "Baby shower", "Annriversary". An
// exact-match filter would offer each spelling as its own option and make every
// one of them undercount. So the filter works on a canonical KEY: spellings that
// mean the same occasion share a key, the dropdown lists keys, and picking one
// matches every raw spelling behind it.
//
// Nothing is rewritten in the database — the team's wording stays as typed.
// The alias list is deliberately short and explicit: only spellings that are
// unmistakably the same occasion are merged. "Kids Party" is NOT folded into
// "Birthday", and "Reception" is not folded into "Wedding" — a wrong merge
// hides leads, a missed merge only costs one extra option.
// ============================================================

/** Filter value for leads with no occasion recorded (null or blank). */
export const OCCASION_NONE = "NONE";

const ALIASES: Record<string, string> = {
  "birthday party": "birthday",
  "bday": "birthday",
  "b'day": "birthday",
  "corporate event": "corporate",
  "corporate events": "corporate",
  "annriversary": "anniversary",
  "aniversary": "anniversary",
  "get together": "get-together",
  "get to gether": "get-together",
  "gettogether": "get-together",
  "marriage": "wedding",
  "inaguration function": "inauguration",
  "inauguration function": "inauguration",
};

/** Lowercase, trimmed, single-spaced — the form aliases are keyed on. */
function squash(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The canonical key for a raw eventType, or null when none is recorded. */
export function occasionKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = squash(raw);
  if (s === "") return null;
  return ALIASES[s] ?? s;
}

/** "baby shower" → "Baby Shower". Hyphenated parts are capitalised too. */
export function occasionLabel(key: string): string {
  return key.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export interface OccasionOption {
  /** What goes in the URL (?occasion=) — the canonical key, or OCCASION_NONE. */
  value: string;
  label: string;
  count: number;
}

/**
 * Turn `groupBy eventType` rows into dropdown options: spellings merged,
 * biggest first, "Not recorded" always last so it never buries real occasions.
 */
export function buildOccasionOptions(
  rows: readonly { eventType: string | null; count: number }[]
): OccasionOption[] {
  const byKey = new Map<string, number>();
  let none = 0;
  for (const row of rows) {
    const key = occasionKey(row.eventType);
    if (key == null) none += row.count;
    else byKey.set(key, (byKey.get(key) ?? 0) + row.count);
  }
  const options = [...byKey.entries()]
    .map(([key, count]) => ({ value: key, label: occasionLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (none > 0) options.push({ value: OCCASION_NONE, label: "Not recorded", count: none });
  return options;
}

/**
 * Every raw spelling in the data that belongs to `key` — what the query's
 * `eventType IN (…)` needs. Empty means the key matches nothing on record, and
 * the caller must return no rows rather than drop the filter.
 */
export function rawValuesForOccasion(key: string, distinctRaw: readonly (string | null)[]): string[] {
  const wanted = occasionKey(key);
  if (wanted == null) return [];
  return distinctRaw.filter((raw): raw is string => raw != null && occasionKey(raw) === wanted);
}
