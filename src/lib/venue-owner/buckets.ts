// ============================================================
// Venue portal — pure date bucketing (client-safe, no IO).
// ------------------------------------------------------------
// Everything the owner sees is keyed by India's calendar date. Two traps:
//   • Booking.date is @db.Date — stored as UTC midnight of the day, so its key
//     is simply the ISO date.
//   • Lead.eventDate is a full instant written two ways (UTC midnight from web
//     forms, IST midnight = 18:30Z the day before from the manual form), so its
//     key must be taken in IST or a manual lead dated the 1st lands in the
//     previous month.
// ============================================================

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy-mm-dd of an instant in India. */
export function istDayKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** yyyy-mm-dd of a @db.Date value (UTC midnight). */
export function dbDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** yyyy-mm of an instant in India. */
export function istMonthKey(instant: Date): string {
  return istDayKey(instant).slice(0, 7);
}

/** The India calendar month [start, end) as real instants, for DateTime columns. */
export function istMonthInstants(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
  };
}

/** The calendar month [start, end) as UTC-midnight dates, for @db.Date columns. */
export function dbMonthDates(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

/** Today's date in India as a @db.Date-comparable UTC midnight. */
export function istToday(now: Date): Date {
  const s = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
}

/** The last `count` India months, oldest first, ending with the current one. */
export function lastMonths(now: Date, count: number): { key: string; label: string; year: number; month: number }[] {
  const s = new Date(now.getTime() + IST_OFFSET_MS);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    out.push({ key: `${year}-${String(month).padStart(2, "0")}`, label: MONTH_SHORT[month - 1], year, month });
  }
  return out;
}

export type PeriodKey = "month" | "quarter" | "year" | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "year", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

export function parsePeriod(raw: string | undefined | null): PeriodKey {
  return raw === "quarter" || raw === "year" || raw === "all" ? raw : "month";
}

/**
 * The period as instants (for Lead.createdAt) and as dates (for Booking.date).
 * "This month" is the current India month; the others end today and run back
 * whole months; "all" is unbounded.
 */
export function periodRange(key: PeriodKey, now: Date): { from: Date | null; to: Date | null; fromDate: Date | null; toDate: Date | null } {
  if (key === "all") return { from: null, to: null, fromDate: null, toDate: null };
  const months = key === "month" ? 1 : key === "quarter" ? 3 : 12;
  const first = lastMonths(now, months)[0];
  const current = lastMonths(now, 1)[0];
  const from = istMonthInstants(first.year, first.month).start;
  const to = istMonthInstants(current.year, current.month).end;
  const fromDate = dbMonthDates(first.year, first.month).start;
  const toDate = dbMonthDates(current.year, current.month).end;
  return { from, to, fromDate, toDate };
}

export function conversionPct(leads: number, converted: number): number {
  if (leads <= 0) return 0;
  return Math.round((converted / leads) * 100);
}

const BOOKING_SLOT: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  FULL_DAY: "Full day",
};

/** A readable slot for a booking's TimeSlot or a lead's "Lunch" / "Dinner". */
export function slotLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return BOOKING_SLOT[raw] ?? raw;
}
