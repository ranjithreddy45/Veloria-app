// ============================================================
// Venue portal — URL params, month grid and wording (pure, client-safe).
// ------------------------------------------------------------
// The portal has no actions and no API routes: venue, period and month all
// travel in the URL, and the server page clamps whatever arrives before it
// asks the data layer for anything. The venue id itself is checked against
// the owner's scope by selectVenues() in src/lib/venue-owner/portal-data.ts;
// these helpers only shape the rest.
//
// Calendar dates are plain "yyyy-mm-dd" India dates, built here with UTC
// arithmetic so the grid never depends on the server's or the phone's time
// zone (the VPS runs on New York time).
// ============================================================

export interface YearMonth {
  year: number;
  month: number;
}

export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** How far either side of this year the calendar will go. */
export const CALENDAR_YEARS_EACH_WAY = 5;

/** The first value of a search param that may arrive repeated. */
export function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function wholeNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,4}$/.test(raw)) return null;
  return Number(raw);
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The first and last month the calendar may show, around the current India month. */
export function calendarBounds(current: YearMonth): { min: YearMonth; max: YearMonth } {
  return {
    min: { year: current.year - CALENDAR_YEARS_EACH_WAY, month: 1 },
    max: { year: current.year + CALENDAR_YEARS_EACH_WAY, month: 12 },
  };
}

/**
 * The month to show from ?year=&month=. Missing or malformed → the current
 * India month; a month outside 1–12 or a year outside the bounds is pulled to
 * the nearest edge rather than handed to a date constructor to roll over.
 */
export function parseCalendarMonth(rawYear: string | undefined, rawMonth: string | undefined, current: YearMonth): YearMonth {
  const year = wholeNumber(rawYear);
  const month = wholeNumber(rawMonth);
  if (year === null || month === null) return current;
  const { min, max } = calendarBounds(current);
  return {
    year: Math.min(max.year, Math.max(min.year, year)),
    month: Math.min(12, Math.max(1, month)),
  };
}

/** "October 2026". */
export function monthTitle(ym: YearMonth): string {
  return `${MONTH_LONG[ym.month - 1]} ${ym.year}`;
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "Wednesday, 14 October 2026" for a yyyy-mm-dd key. */
export function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_LONG[weekday]}, ${d} ${MONTH_LONG[m - 1]} ${y}`;
}

export interface GridCell {
  key: string;
  day: number;
  inMonth: boolean;
}

/**
 * Every cell of the month grid, Sunday first like the staff booking calendar:
 * the tail of the previous month, the month itself, and the head of the next,
 * always whole weeks.
 */
export function monthGrid(year: number, month: number): GridCell[] {
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((lead + length) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 + i - lead));
    cells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: i >= lead && i < lead + length,
    });
  }
  return cells;
}

/**
 * A portal link. Params that are empty or equal to their default are left
 * out, so the plain URL and the explicit default are the same page.
 */
export function portalHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  defaults: Record<string, string> = { venue: "all", period: "month" },
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    const text = String(value);
    if (defaults[name] === text) continue;
    query.set(name, text);
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Event types are display strings ("Wedding", "Birthday Party"); a few older
 * rows carry an enum-style "CORPORATE_EVENT", which reads as shouting.
 */
export function eventTypeLabel(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  if (!/^[A-Z0-9_]+$/.test(text)) return text;
  const words = text.toLowerCase().split("_").filter(Boolean);
  if (words.length === 0) return null;
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export type CountKind = "booking" | "hold" | "lead";

/** The word after a count: "booked", "on hold", "enquiry" / "enquiries". */
export function countWord(kind: CountKind, n: number): string {
  if (kind === "booking") return "booked";
  if (kind === "hold") return "on hold";
  return n === 1 ? "enquiry" : "enquiries";
}

/** "2 booked", "1 on hold", "3 enquiries". */
export function countLabel(kind: CountKind, n: number): string {
  return `${n} ${countWord(kind, n)}`;
}

/** "120 guests" / "1 guest". */
export function guestsLabel(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  return `${n.toLocaleString("en-IN")} ${n === 1 ? "guest" : "guests"}`;
}
