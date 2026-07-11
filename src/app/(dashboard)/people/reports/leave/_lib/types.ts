// ============================================================
// Leave Reports — shared serialisable row types + tiny helpers.
// These types are the contract between the read-only server actions
// (src/actions/hr-report-leave.actions.ts) and the client views.
// All dates crossing the boundary are ISO strings (UTC).
// ============================================================

/** Round to 2 decimals; leave days are Floats (half-days etc.). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a UTC-midnight ISO date as DD MMM YYYY, in UTC (no TZ drift). */
export function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Filename date stamp (today, UTC). */
export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LeaveTypeLite {
  id: string;
  name: string;
  code: string;
  paid: boolean;
  accrualPerYear: number;
  carryForwardMax: number;
  color: string;
}

/** Balance report — one row per employee × leave type for a year. */
export interface BalanceRow {
  employeeId: string;
  empCode: string;
  name: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color: string;
  entitled: number;
  carriedForward: number;
  used: number;
  pending: number;
  available: number; // entitled + carriedForward − used − pending
}

/** Availed report — one row per approved leave request in a period. */
export interface AvailedRow {
  id: string;
  empCode: string;
  name: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color: string;
  startDate: string; // ISO UTC
  endDate: string; // ISO UTC
  days: number;
  status: string; // APPROVED (filtered)
  appliedOn: string; // ISO UTC (createdAt)
}

/** Allotment report — what was granted (entitled + carried) per emp × type. */
export interface AllotmentRow {
  employeeId: string;
  empCode: string;
  name: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color: string;
  entitled: number;
  carriedForward: number;
  allotted: number; // entitled + carriedForward
}

/** Lapsed report — projected lapse at year end (see report note). */
export interface LapsedRow {
  empCode: string;
  name: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color: string;
  available: number;
  carryForwardMax: number;
  projectedLapse: number; // max(0, available − carryForwardMax)
}

/** Org-wide summary — one row per leave type. */
export interface SummaryRow {
  leaveTypeId: string;
  name: string;
  code: string;
  color: string;
  paid: boolean;
  totalEntitled: number;
  totalCarried: number;
  totalUsed: number;
  totalPending: number;
  totalAllotted: number; // entitled + carried
  utilisationPct: number; // used / allotted * 100
}
