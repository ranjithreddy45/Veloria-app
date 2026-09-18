import { SLOT_NAME, toTimeSlot } from "@/lib/sales/slot";

// ============================================================
// Hall search — the state behind the halls feed: a date, a slot, a guest
// count, one amenity and one capacity band.
//
// Pure and client-safe, so the sticky pill, the sheet, the chips row and the
// server feed all read the SAME rules. The whole state lives in the query
// string, which is what makes a search shareable and the back button work.
//
// Everything arriving here is untrusted (a query string, or an argument to a
// server action). A value that is not a real bookable date, a real slot, a
// positive guest count, a real capacity band or an amenity the halls actually
// list is DROPPED — never shown back to the customer, never used to filter.
// ============================================================

export interface HallSearch {
  dateISO: string | null;
  slot: string | null;
  guests: number | null;
  amenity: string | null;
  cap: string | null;
}

export const EMPTY_HALL_SEARCH: HallSearch = { dateISO: null, slot: null, guests: null, amenity: null, cap: null };

/** How far ahead a date may be searched — the customer availability calendar reaches twelve months. */
export const HALL_SEARCH_WINDOW_DAYS = 366;

/** Above this a "guest count" is a typo, not a party. */
export const MAX_SEARCH_GUESTS = 20000;

/** The query-string keys, in the order hrefs write them. */
export const HALL_SEARCH_KEYS = ["date", "slot", "guests", "amenity", "cap"] as const;

const IST = "Asia/Kolkata";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ------------------------------------------------------------ capacity bands

export interface HallCapBand {
  key: string;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound; null = no ceiling. */
  max: number | null;
}

/** Disjoint bands, so every hall falls in exactly one and the counts add up. */
export const HALL_CAP_BANDS: readonly HallCapBand[] = [
  { key: "upto-100", label: "Up to 100", min: 0, max: 100 },
  { key: "100-200", label: "100–200", min: 101, max: 200 },
  { key: "200-500", label: "200–500", min: 201, max: 500 },
  { key: "500-plus", label: "500+", min: 501, max: null },
];

export function capBand(key: string | null | undefined): HallCapBand | null {
  return HALL_CAP_BANDS.find((b) => b.key === key) ?? null;
}

export function capacityInBand(capacity: number, key: string | null | undefined): boolean {
  const band = capBand(key);
  if (!band) return true;
  return capacity >= band.min && (band.max === null || capacity <= band.max);
}

// ------------------------------------------------------------ dates

/** Today on the Indian calendar, YYYY-MM-DD. (Kept local so this module never pulls the pricing engine into the phone's bundle.) */
function istTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** YYYY-MM-DD plus n calendar days (UTC arithmetic, so no DST drift). */
function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A real day on the calendar — "2026-02-30" and "2026-13-01" are not. */
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "12 Dec" for a date this year, "12 Dec 2027" beyond it. Parsed as a plain calendar date — no timezone can shift it. */
export function formatSearchDate(dateISO: string | null | undefined, todayISO: string = istTodayISO()): string {
  if (!dateISO || !isCalendarDate(dateISO)) return "";
  const [y, m, d] = dateISO.split("-").map(Number);
  const sameYear = dateISO.slice(0, 4) === todayISO.slice(0, 4);
  return `${d} ${MONTHS[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

// ------------------------------------------------------------ parsing

/** Query-string shaped input. Values are `unknown`: this is the untrusted edge. */
export interface HallSearchParams {
  date?: unknown;
  slot?: unknown;
  guests?: unknown;
  amenity?: unknown;
  cap?: unknown;
}

/** One string out of a query-string value (Next gives string | string[]), or null. */
function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstString(x);
      if (s !== null) return s;
    }
  }
  return null;
}

/** Trimmed, whitespace-collapsed, length-capped — the shape an amenity label may take. */
function cleanLabel(v: unknown, max = 60): string | null {
  const s = firstString(v);
  if (s === null) return null;
  const t = s.trim().replace(/\s+/g, " ").slice(0, max).trim();
  return t ? t : null;
}

export interface ParseHallSearchOptions {
  /** The amenity values the halls actually list. Given, an amenity must match one (case-insensitively) and is returned in the team's own spelling. */
  knownAmenities?: readonly string[];
  /** Overrides "today" (tests, and a server that wants one clock for the whole request). */
  todayISO?: string;
}

/**
 * The search a URL (or a server-action argument) really describes. Anything
 * unreal is dropped: a date must be a real calendar day inside the bookable
 * window, a slot must be a real slot, guests a positive whole number, the
 * band a real band, and the amenity one the halls list.
 */
export function parseHallSearch(params: HallSearchParams, opts: ParseHallSearchOptions = {}): HallSearch {
  const todayISO = opts.todayISO && isCalendarDate(opts.todayISO) ? opts.todayISO : istTodayISO();
  const maxISO = addDaysISO(todayISO, HALL_SEARCH_WINDOW_DAYS);

  const rawDate = firstString(params.date);
  // ISO dates of one shape compare correctly as strings.
  const dateISO = rawDate && isCalendarDate(rawDate) && rawDate >= todayISO && rawDate <= maxISO ? rawDate : null;

  // A slot only means something against a date: without one it would sit in the
  // pill claiming to narrow a search that it cannot narrow.
  const slot = dateISO ? toTimeSlot(firstString(params.slot)) : null;

  const rawGuests = firstString(params.guests);
  const guestsNum = rawGuests !== null && /^\d{1,6}$/.test(rawGuests.trim()) ? Number(rawGuests.trim()) : NaN;
  const guests = Number.isInteger(guestsNum) && guestsNum > 0 && guestsNum <= MAX_SEARCH_GUESTS ? guestsNum : null;

  const rawAmenity = cleanLabel(params.amenity);
  let amenity: string | null = rawAmenity;
  if (rawAmenity && opts.knownAmenities) {
    const key = rawAmenity.toLowerCase();
    amenity = opts.knownAmenities.find((a) => a.trim().replace(/\s+/g, " ").toLowerCase() === key) ?? null;
  }

  const capKey = firstString(params.cap);
  const cap = capBand(capKey) ? capKey : null;

  return { dateISO, slot, guests, amenity, cap };
}

export function hallSearchIsEmpty(search: HallSearch): boolean {
  return !search.dateISO && !search.slot && !search.guests && !search.amenity && !search.cap;
}

/** Fields set, for "N filters" style copy. */
export function hallSearchCount(search: HallSearch): number {
  return [search.dateISO, search.slot, search.guests, search.amenity, search.cap].filter(Boolean).length;
}

// ------------------------------------------------------------ links

/**
 * The URL for a search, optionally with one or more fields changed. A field
 * set to null in `patch` is cleared, which is how a chip toggles itself off.
 */
export function hallSearchHref(base: string, search: HallSearch, patch: Partial<HallSearch> = {}): string {
  const next: HallSearch = { ...search, ...patch };
  const q = new URLSearchParams();
  if (next.dateISO) q.set("date", next.dateISO);
  if (next.slot) q.set("slot", next.slot);
  if (next.guests) q.set("guests", String(next.guests));
  if (next.amenity) q.set("amenity", next.amenity);
  if (next.cap) q.set("cap", next.cap);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

// ------------------------------------------------------------ wording

/** "12 Dec · Evening · 350 guests" — what the customer asked for, in one line. Empty when nothing is set. */
export function describeHallSearch(search: HallSearch, todayISO?: string): string {
  const parts: string[] = [];
  if (search.dateISO) parts.push(formatSearchDate(search.dateISO, todayISO));
  if (search.slot) parts.push(SLOT_NAME[search.slot as keyof typeof SLOT_NAME] ?? search.slot);
  if (search.guests) parts.push(`${search.guests.toLocaleString("en-IN")} guests`);
  const band = capBand(search.cap);
  if (band) parts.push(band.label);
  if (search.amenity) parts.push(search.amenity);
  return parts.filter(Boolean).join(" · ");
}

/** The two halves of the search pill. Placeholders when that half is unset — never a fabricated default. */
export function hallSearchPill(search: HallSearch, todayISO?: string): { dates: string; guests: string; datesSet: boolean; guestsSet: boolean } {
  const dateParts: string[] = [];
  if (search.dateISO) dateParts.push(formatSearchDate(search.dateISO, todayISO));
  if (search.slot) dateParts.push(SLOT_NAME[search.slot as keyof typeof SLOT_NAME] ?? search.slot);
  const band = capBand(search.cap);
  const guests = search.guests ? `${search.guests.toLocaleString("en-IN")} guests` : band ? band.label : "Add guests";
  return {
    dates: dateParts.length ? dateParts.join(" · ") : "Add dates",
    guests,
    datesSet: dateParts.length > 0,
    guestsSet: Boolean(search.guests || band),
  };
}

/**
 * The line above the results. Counts only — never a claim the records don't
 * carry. `freeCount` is how many of the shown halls have every slot open on
 * the searched date.
 */
export function resultCountText(o: { total: number; shown: number; dateISO: string | null; freeCount: number; todayISO?: string }): string {
  if (o.total === 0) return "";
  if (o.shown === 0) return "";
  if (o.dateISO) {
    const day = formatSearchDate(o.dateISO, o.todayISO);
    const head = o.freeCount > 0 ? `${o.freeCount} free on ${day}` : `None fully free on ${day}`;
    return o.shown === o.freeCount ? head : `${head} · ${o.shown} ${o.shown === 1 ? "space" : "spaces"} listed`;
  }
  if (o.shown < o.total) return `${o.shown} of ${o.total} spaces`;
  return `${o.total} ${o.total === 1 ? "space" : "spaces"}`;
}

/** Which filter to loosen when nothing matched — says the true reason, in the order worth trying. */
export function noMatchAdvice(search: HallSearch): string {
  if (search.guests) return `No hall here seats ${search.guests.toLocaleString("en-IN")} guests. Try a smaller party, or ask us about joining two halls.`;
  if (search.cap) return "No hall is that size. Try another size band.";
  if (search.amenity) return `No hall lists “${search.amenity}”. Clear that filter to see every hall.`;
  if (search.dateISO || search.slot) return "Nothing matches that search. Try another date or slot.";
  return "Nothing matches that search.";
}

// ------------------------------------------------------------ matching

export interface HallSearchable {
  capacity: number;
  amenities: readonly string[];
}

const amenityKey = (a: string) => a.trim().replace(/\s+/g, " ").toLowerCase();

/** Does a hall match the search? Availability never filters — a busy hall is still shown, just sorted lower. */
export function hallMatchesSearch(hall: HallSearchable, search: HallSearch): boolean {
  if (search.guests !== null && hall.capacity < search.guests) return false;
  if (!capacityInBand(hall.capacity, search.cap)) return false;
  if (search.amenity) {
    const want = amenityKey(search.amenity);
    if (!hall.amenities.some((a) => amenityKey(a) === want)) return false;
  }
  return true;
}

/**
 * The amenity values the halls actually list, most widely shared first — the
 * chips row. Labels keep the team's own spelling; nothing is invented and
 * nothing is renamed.
 */
export function topAmenities(halls: readonly { amenities: readonly string[] }[], max = 6): string[] {
  const label = new Map<string, string>();
  const count = new Map<string, number>();
  const order: string[] = [];
  for (const hall of halls) {
    const seen = new Set<string>();
    for (const raw of hall.amenities) {
      const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
      if (!text) continue;
      const key = text.toLowerCase();
      if (!label.has(key)) {
        label.set(key, text);
        order.push(key);
      }
      if (seen.has(key)) continue;
      seen.add(key);
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  return order
    .map((key, i) => ({ key, i }))
    .sort((a, b) => (count.get(b.key) ?? 0) - (count.get(a.key) ?? 0) || a.i - b.i)
    .slice(0, max)
    .map((x) => label.get(x.key) as string);
}

// ------------------------------------------------------------ availability wording

export type HallAvailability = "FREE" | "PARTIAL" | "TAKEN";

/**
 * The availability chip on a card. Says exactly what the booking rules say:
 * every slot open, some slots open (which ones), or nothing left that day.
 * When a slot was searched, the verdict is about that slot alone.
 */
export function availabilityChip(
  availability: HallAvailability | null,
  freeSlots: readonly string[],
  slot?: string | null
): { label: string; tone: "green" | "amber" | "grey" } | null {
  if (!availability) return null;
  if (slot) {
    const name = SLOT_NAME[slot as keyof typeof SLOT_NAME] ?? slot;
    return availability === "FREE" ? { label: `${name} free`, tone: "green" } : { label: `${name} taken`, tone: "grey" };
  }
  if (availability === "FREE") return { label: "Free all day", tone: "green" };
  if (availability === "TAKEN") return { label: "Fully booked", tone: "grey" };
  const names = freeSlots.map((s) => SLOT_NAME[s as keyof typeof SLOT_NAME] ?? s).filter(Boolean);
  if (names.length === 1) return { label: `${names[0]} free`, tone: "amber" };
  if (names.length > 1) return { label: `${names.length} slots free`, tone: "amber" };
  return { label: "Some slots taken", tone: "amber" };
}
