// ============================================================
// Leave working-days calculation — pure & testable.
// Excludes weekends (Sat/Sun) and holidays. Supports half-day
// boundaries on the first and/or last day of a range.
// ============================================================

export type HalfDayPart = "FULL" | "FIRST_HALF" | "SECOND_HALF";

/** YYYY-MM-DD in UTC for stable holiday-set keys. */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6;
}

/**
 * Count chargeable leave days between start and end (inclusive).
 * - weekends and holiday keys are skipped (count 0)
 * - a non-FULL part on the first or last working day counts 0.5
 * - if start === end, startPart governs (a half part → 0.5)
 */
export function workingDays(
  start: Date,
  end: Date,
  startPart: HalfDayPart = "FULL",
  endPart: HalfDayPart = "FULL",
  holidayKeys: Set<string> = new Set()
): number {
  // Normalise to UTC midnight.
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (e < s) return 0;

  const sameDay = dateKey(s) === dateKey(e);

  if (sameDay) {
    if (isWeekend(s) || holidayKeys.has(dateKey(s))) return 0;
    return startPart !== "FULL" ? 0.5 : 1;
  }

  let total = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const k = dateKey(cur);
    const skip = isWeekend(cur) || holidayKeys.has(k);
    if (!skip) {
      let val = 1;
      if (k === dateKey(s) && startPart === "SECOND_HALF") val = 0.5;
      else if (k === dateKey(e) && endPart === "FIRST_HALF") val = 0.5;
      total += val;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return total;
}

/** Do two date ranges overlap (inclusive)? Used to block double-booking leave. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
