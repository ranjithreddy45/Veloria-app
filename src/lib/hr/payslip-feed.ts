// ============================================================
// An employee's payslips, month by month — pure, client-safe.
// ------------------------------------------------------------
// Two kinds of payslip reach an employee: the ones payroll COMPUTES (HrPayslip,
// shown once their run is LOCKED or PAID) and the files HR UPLOADS
// (HrPayslipDocument, typically when payroll is run outside this system). They
// stay separate records on purpose (see hr-payslip-doc.actions.ts), but the
// employee sees one list: one entry per calendar month, carrying whichever of
// the two exist for it, newest month first.
// ============================================================

import { calendarYearFor } from "./statutory-exports";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface ComputedPayslip {
  id: string;
  net: number;
  run: { fy: string; month: number; label: string | null; status: string };
}

export interface UploadedPayslip {
  id: string;
  year: number;
  month: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  updatedAt: Date | string;
}

export interface PayslipMonth {
  key: string;
  year: number;
  month: number;
  /** "August 2026" */
  label: string;
  computed: ComputedPayslip | null;
  uploaded: UploadedPayslip | null;
}

export function buildPayslipMonths(computed: ComputedPayslip[], uploaded: UploadedPayslip[]): PayslipMonth[] {
  const byKey = new Map<string, PayslipMonth>();
  const entry = (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    let m = byKey.get(key);
    if (!m) {
      m = { key, year, month, label: `${MONTH_NAMES[month - 1] ?? month} ${year}`, computed: null, uploaded: null };
      byKey.set(key, m);
    }
    return m;
  };
  for (const c of computed) entry(calendarYearFor(c.run.fy, c.run.month), c.run.month).computed = c;
  for (const u of uploaded) entry(u.year, u.month).uploaded = u;
  return [...byKey.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}
