// ============================================================
// India-time windows for the home screen.
//
// The server runs on UTC and the business runs on IST (UTC+05:30, no DST).
// Two different kinds of column need two different answers to "today":
//
//   DateTime columns (Task.dueDate, Lead.followUpDate, Payment.paidAt ...)
//     hold real instants, so "today" is the half-open window between two IST
//     midnights expressed as UTC instants   -> istDayWindow().
//
//   @db.Date columns (Booking.date) hold a calendar day stored as UTC
//     midnight, so "today" is the UTC-midnight Date whose Y-M-D is India's
//     date -> istDateOnly(). Comparing those against a real instant is the
//     bug that makes today's event read as "past" between 00:00 and 05:30 IST.
//
// Same convention as dashboard.actions (istStartOfMonth), acq/analytics-range
// (startOfIstDay) and guest/host-scope (todayKey); those helpers are private
// to their files, so the home screen carries its own tested copy.
// Pure: `now` is always injected.
// ============================================================

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InstantWindow {
  /** Inclusive start, a real UTC instant. */
  start: Date;
  /** Exclusive end, a real UTC instant. */
  end: Date;
}

/** `now` shifted so its UTC fields read as the IST wall clock. */
function istShifted(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/** Hour of day (0-23) on the IST wall clock. */
export function istHour(now: Date): number {
  return istShifted(now).getUTCHours();
}

/** India's calendar date as yyyy-mm-dd. */
export function istDateKey(now: Date): string {
  return istShifted(now).toISOString().slice(0, 10);
}

/** The IST day containing `now` (plus `offsetDays`), as real instants. */
export function istDayWindow(now: Date, offsetDays = 0): InstantWindow {
  const s = istShifted(now);
  const startMs =
    Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + offsetDays) - IST_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

/**
 * India's date (plus `offsetDays`) as the UTC-midnight Date that a @db.Date
 * column stores for that day. Use with `equals` / `gte` / `lt` on Booking.date.
 */
export function istDateOnly(now: Date, offsetDays = 0): Date {
  const s = istShifted(now);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + offsetDays));
}

/** Days since Monday (0-6) for India's date. The business week is Mon-Sun. */
function istDaysSinceMonday(now: Date): number {
  return (istShifted(now).getUTCDay() + 6) % 7;
}

/** The Mon-Sun IST week containing `now`, as real instants. */
export function istWeekWindow(now: Date): InstantWindow {
  const back = istDaysSinceMonday(now);
  return { start: istDayWindow(now, -back).start, end: istDayWindow(now, 7 - back).start };
}

/** The same Mon-Sun week as @db.Date bounds: [monday, nextMonday). */
export function istWeekDateOnly(now: Date): InstantWindow {
  const back = istDaysSinceMonday(now);
  return { start: istDateOnly(now, -back), end: istDateOnly(now, 7 - back) };
}

/** The IST calendar month containing `now` (plus `offsetMonths`), as real instants. */
export function istMonthWindow(now: Date, offsetMonths = 0): InstantWindow {
  const s = istShifted(now);
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth() + offsetMonths;
  return {
    start: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS),
  };
}

/** Index 0-6 (Mon-Sun) of the IST weekday an instant falls on. */
export function istWeekdayIndex(instant: Date): number {
  return istDaysSinceMonday(instant);
}

const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});
const DAY_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});
// @db.Date values are already a calendar day at UTC midnight; formatting them
// in IST would be harmless (+5:30 stays on the same day) but UTC states intent.
const DATE_ONLY_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "5:30 pm" on the IST wall clock. */
export function formatIstTime(instant: Date | string): string {
  return TIME_FMT.format(new Date(instant));
}

/** "12 Sep" on the IST calendar, for a real instant. */
export function formatIstDay(instant: Date | string): string {
  return DAY_FMT.format(new Date(instant));
}

/** "12 Sep" for a @db.Date value. */
export function formatDateOnly(date: Date | string): string {
  return DATE_ONLY_FMT.format(new Date(date));
}
