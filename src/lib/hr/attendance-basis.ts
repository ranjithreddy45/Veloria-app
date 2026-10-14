// ============================================================
// Attendance against a fixed 30-day month — for REPORTS and DASHBOARDS only.
// ------------------------------------------------------------
// Every month is measured out of 30 days, whatever its length, instead of a
// figure derived from the calendar or the roster. Payroll is deliberately NOT
// on this basis: the attendance sheet still derives working days and LOP from
// the actual calendar, because that drives salary and PF/ESI filings.
// ============================================================

/** The fixed denominator for monthly attendance in reports and dashboards. */
export const ATTENDANCE_BASIS_DAYS = 30;

/** Days attended: present and WFH count in full, a half-day counts as half. */
export function attendedDays(c: { present: number; wfh: number; halfDay: number }): number {
  return c.present + c.wfh + c.halfDay * 0.5;
}

/** Attendance as a percentage of the 30-day month, one decimal, capped at 100. */
export function attendancePct(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.min(100, Math.round((days / ATTENDANCE_BASIS_DAYS) * 1000) / 10);
}
