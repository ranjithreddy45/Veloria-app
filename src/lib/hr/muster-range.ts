// ============================================================
// Pure date helpers for the daily muster's From → To range.
// Day keys are "YYYY-MM-DD" IST calendar days, which is how attendance is
// stored (@db.Date at UTC midnight of the IST day).
// ============================================================

/** Longest range the daily register will build: one full pay period. */
export const MAX_MUSTER_RANGE_DAYS = 31;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function utcMidnight(key: string): number | null {
  if (!DAY_KEY.test(key)) return null;
  const t = Date.parse(`${key}T00:00:00.000Z`);
  return Number.isNaN(t) ? null : t;
}

export type RangeCheck =
  | { ok: true; days: string[] }
  | { ok: false; reason: string };

/**
 * Every day key from `from` to `to`, inclusive. Rejects a malformed day, a range
 * that runs backwards, and one longer than MAX_MUSTER_RANGE_DAYS — the caller
 * shows the reason rather than silently trimming the range.
 */
export function musterRangeDays(from: string, to: string): RangeCheck {
  const a = utcMidnight(from);
  const b = utcMidnight(to);
  if (a == null || b == null) return { ok: false, reason: "Pick a valid From and To date." };
  if (b < a) return { ok: false, reason: "The To date is before the From date." };
  const count = Math.round((b - a) / 86_400_000) + 1;
  if (count > MAX_MUSTER_RANGE_DAYS) {
    return { ok: false, reason: `Pick a range of ${MAX_MUSTER_RANGE_DAYS} days or fewer (that one is ${count}).` };
  }
  const days: string[] = [];
  for (let i = 0; i < count; i++) days.push(new Date(a + i * 86_400_000).toISOString().slice(0, 10));
  return { ok: true, days };
}

/** The IST calendar day an instant falls on, as a day key. */
export function istDayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Was the employee on the payroll by `dayKey`? An employee with no joining date
 * is treated as always joined (that was the register's behaviour before ranges).
 * Without this, a range spanning someone's start date would show a run of
 * absences for days they had not yet joined.
 */
export function joinedBy(dateOfJoining: Date | null | undefined, dayKey: string): boolean {
  if (!dateOfJoining) return true;
  return istDayKey(dateOfJoining) <= dayKey;
}
