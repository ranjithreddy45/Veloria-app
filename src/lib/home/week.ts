// ============================================================
// Seven Mon-Sun buckets for the side-card bar chart.
// Rows are bucketed by the IST weekday their instant falls on, so a payment
// taken at 00:20 IST on Tuesday lands on Tuesday even though the server's
// clock still says Monday. Pure: `now` is injected.
// ============================================================

import type { DayValue } from "./facts";
import { istWeekWindow, istWeekdayIndex } from "./ist";

const DAYS: [string, string][] = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
];

export function bucketWeek(rows: { at: Date; amount: number }[], now: Date): DayValue[] {
  const week = istWeekWindow(now);
  const today = istWeekdayIndex(now);
  // Whole paise, so a week of fractional rupee amounts cannot drift.
  const paise = new Array<number>(7).fill(0);
  for (const r of rows) {
    const t = r.at.getTime();
    if (t < week.start.getTime() || t >= week.end.getTime()) continue;
    paise[istWeekdayIndex(r.at)] += Math.round(r.amount * 100);
  }
  return DAYS.map(([label, name], i) => ({
    label,
    name,
    value: paise[i] / 100,
    isToday: i === today,
  }));
}

export function weekTotal(days: DayValue[]): number {
  return days.reduce((sum, d) => sum + Math.round(d.value * 100), 0) / 100;
}
