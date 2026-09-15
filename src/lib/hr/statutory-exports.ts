// ============================================================
// Statutory FILING exports — PURE formatters (no IO).
// ------------------------------------------------------------
// Turns already-frozen payslip figures into the upload formats the three
// Indian statutory portals actually accept:
//
//   1. PF  — EPFO Unified Portal "ECR Text File Format" (ECR v2): one line per
//            member, fields separated by `#~#`, integers, no header, CRLF.
//   2. ESI — ESIC "Excel template for monthly contribution" (MC upload): the six
//            template columns, one row per Insured Person.
//   3. TDS — Form 24Q annexure HELPER (quarterly): per-employee Section 192
//            rows + a per-month quarter summary. This is INPUT for the NSDL /
//            Protean RPU utility — it is NOT the FVU file itself.
//
// Design rules (mirrors payroll-calc.ts):
//   * Every cap / ceiling comes in via config — never hard-coded in the math.
//   * NOTHING is silently dropped. A member with a missing / malformed
//     statutory ID is still emitted (so file totals tie to the register) and
//     named in `warnings[]` so HR fixes the master and regenerates. The only
//     rows excluded are the ones the statute itself excludes (e.g. an employee
//     above the ESI wage ceiling) — and those are warned about when they carry
//     an IP number.
//   * Money arrives as JS numbers (Prisma Decimal → Number() at the action
//     boundary); every filed figure is a whole rupee.
// ============================================================

export interface ExportFile {
  fileName: string;
  mimeType: string;
  content: string;
  rowCount: number;
  warnings: string[];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Whole rupees, never negative, never NaN. */
const rupee = (n: number): number => {
  const v = Math.round(Number(n) || 0);
  return v < 0 || !Number.isFinite(v) ? 0 : v;
};

/**
 * Calendar year for an Indian FY + calendar month. FY "2026-27" spans
 * Apr 2026 → Mar 2027: months 4..12 → 2026, months 1..3 → 2027.
 */
export function calendarYearFor(fy: string, month: number): number {
  const first = Number(fy.slice(0, 4));
  return month >= 4 ? first : first + 1;
}

/** "YYYYMM" period tag for file names. */
function periodTag(fy: string, month: number): string {
  return `${calendarYearFor(fy, month)}${String(month).padStart(2, "0")}`;
}

/** Last calendar day of (fy, month) in UTC — the assumed date of payment. */
export function lastDayOfMonth(fy: string, month: number): Date {
  // Day 0 of the NEXT month = last day of this month.
  return new Date(Date.UTC(calendarYearFor(fy, month), month, 0));
}

/** DD/MM/YYYY — the date shape ESIC and the 24Q RPU both accept. */
export function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Calendar months (1..12) that make up a 24Q quarter (Q1 = Apr–Jun … Q4 = Jan–Mar). */
export function quarterMonths(quarter: number): number[] {
  switch (quarter) {
    case 1:
      return [4, 5, 6];
    case 2:
      return [7, 8, 9];
    case 3:
      return [10, 11, 12];
    case 4:
      return [1, 2, 3];
    default:
      return [];
  }
}

/** Minimal CSV cell escaping (commas, quotes, newlines). */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvLine(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

// ============================================================
// 1) PF ECR (EPFO Unified Portal, ECR v2 text file)
// ============================================================

export interface EcrConfig {
  /** Employee PF rate (used only to sanity-check EE contribution vs EPF wages). */
  pfRatePct: number;
  /** Statutory PF wage ceiling (₹15,000). Ignored when pfOnFullBasic. */
  pfWageCeiling: number;
  pfOnFullBasic: boolean;
  /** EPS is ALWAYS capped at this ceiling, even when PF runs on full basic. */
  epsWageCeiling: number;
  epsApplicable: boolean;
  edliWageCeiling: number;
}

export interface EcrMemberInput {
  empCode: string;
  name: string;
  /** 12-digit UAN. null / malformed → the row is still emitted and warned. */
  uan: string | null | undefined;
  /** Total gross wages paid this month (ECR "Gross Wages"). */
  grossWages: number;
  /**
   * UNCAPPED PF-able wages actually paid this month = paid BASIC + PF-applicable
   * arrears. The formatter applies the EPF / EPS / EDLI ceilings from `cfg`
   * exactly as the payroll engine did, so the wage columns reconcile to the
   * contributions frozen on the payslip.
   */
  pfWageBase: number;
  /** Employee EPF contribution as frozen on the payslip (HrPayslip.pf). */
  employeePf: number;
  /** Employer EPS (pension) contribution (HrPayslip.employerEps). */
  employerEps: number;
  /** Employer EPF = employer 12% − EPS (HrPayslip.employerEpf) → ECR "EPF EPS Diff". */
  employerEpf: number;
  /** Non-contributory-period days = loss-of-pay days (HrPayslip.lopDays). */
  ncpDays: number;
  /** Refund of advances recovered through salary — not tracked by the app; default 0. */
  refundOfAdvances?: number;
}

/** ECR member name: UPPERCASE, letters/digits/space only, single-spaced. */
export function sanitizeEcrName(name: string): string {
  return (name ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits only; the portal wants a bare 12-digit UAN. */
function cleanUan(uan: string | null | undefined): string {
  return (uan ?? "").replace(/\D/g, "");
}

export interface EcrLine {
  uan: string;
  name: string;
  grossWages: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  employeePf: number;
  employerEps: number;
  employerEpf: number;
  ncpDays: number;
  refundOfAdvances: number;
}

/** Resolve one member into the 11 ECR fields (caps applied per config). */
export function computeEcrLine(m: EcrMemberInput, cfg: EcrConfig): EcrLine {
  const base = Math.max(0, Number(m.pfWageBase) || 0);
  const epfWages = rupee(cfg.pfOnFullBasic ? base : Math.min(base, cfg.pfWageCeiling));
  // EPS wages are reported only when a pension contribution was actually made —
  // the portal validates EPS contribution against EPS wages, so a non-EPS member
  // (config off, or ₹0 pension leg) must show 0 EPS wages.
  const epsWages = cfg.epsApplicable && rupee(m.employerEps) > 0 ? rupee(Math.min(base, cfg.epsWageCeiling)) : 0;
  const edliWages = rupee(Math.min(base, cfg.edliWageCeiling));
  return {
    uan: cleanUan(m.uan),
    name: sanitizeEcrName(m.name),
    grossWages: rupee(m.grossWages),
    epfWages,
    epsWages,
    edliWages,
    employeePf: rupee(m.employeePf),
    employerEps: rupee(m.employerEps),
    employerEpf: rupee(m.employerEpf),
    ncpDays: rupee(m.ncpDays),
    refundOfAdvances: rupee(m.refundOfAdvances ?? 0),
  };
}

/** Serialise one resolved line in the EPFO field order with `#~#` separators. */
export function formatEcrLine(l: EcrLine): string {
  return [
    l.uan,
    l.name,
    l.grossWages,
    l.epfWages,
    l.epsWages,
    l.edliWages,
    l.employeePf,
    l.employerEps,
    l.employerEpf,
    l.ncpDays,
    l.refundOfAdvances,
  ].join("#~#");
}

export function buildPfEcrFile(input: {
  fy: string;
  month: number;
  members: EcrMemberInput[];
  cfgFor: (m: EcrMemberInput) => EcrConfig;
}): ExportFile {
  const warnings: string[] = [];
  const lines: string[] = [];

  for (const m of input.members) {
    const cfg = input.cfgFor(m);
    const l = computeEcrLine(m, cfg);
    const who = `${m.empCode} ${m.name}`.trim();

    if (!l.uan) warnings.push(`${who}: UAN missing — the portal will reject this line until the UAN is added to the employee's statutory record.`);
    else if (l.uan.length !== 12) warnings.push(`${who}: UAN "${l.uan}" is not 12 digits — verify before upload.`);
    if (!l.name) warnings.push(`${who}: name is empty after removing special characters — fix the employee name.`);

    // Non-integer LOP (e.g. 1.5 days) cannot be filed; it is rounded here.
    if (Math.abs((Number(m.ncpDays) || 0) - l.ncpDays) > 1e-9)
      warnings.push(`${who}: NCP days ${m.ncpDays} rounded to ${l.ncpDays} (the ECR takes whole days).`);

    // Sanity: EE contribution must be the PF rate on EPF wages, otherwise the
    // portal flags the line. A mismatch means the payslip's PF base included
    // something we could not reconstruct (verify the arrears on that payslip).
    if (cfg.pfRatePct > 0) {
      const expected = rupee((l.epfWages * cfg.pfRatePct) / 100);
      if (Math.abs(expected - l.employeePf) > 1)
        warnings.push(
          `${who}: employee PF ₹${l.employeePf} ≠ ${cfg.pfRatePct}% of EPF wages ₹${l.epfWages} (expected ₹${expected}) — verify the PF wage base on this payslip.`,
        );
    }
    if (l.epsWages > l.epfWages)
      warnings.push(`${who}: EPS wages ₹${l.epsWages} exceed EPF wages ₹${l.epfWages} — check the EPS ceiling in statutory config.`);

    lines.push(formatEcrLine(l));
  }

  return {
    fileName: `ECR_${periodTag(input.fy, input.month)}.txt`,
    mimeType: "text/plain",
    // EPFO: CRLF line endings, no header row, no trailing blank line.
    content: lines.join("\r\n"),
    rowCount: lines.length,
    warnings,
  };
}

// ============================================================
// 2) ESI monthly contribution (ESIC MC Excel template)
// ============================================================

/** The six column headers of the ESIC monthly-contribution upload template. */
export const ESI_MC_HEADERS = [
  "IP Number (10 Digits)",
  "IP Name ( Only alphabets and space )",
  "No of Days for which wages paid/payable during the month",
  "Total Monthly Wages",
  "Reason Code for Zero workings days(numeric only; provide 0 for all other reasons- Click on the link for reference)",
  "Last Working Day ( Format DD/MM/YYYY  or DD-MM-YYYY)",
] as const;

/**
 * ESIC "reason for zero working days" codes (the subset the app can infer).
 * 0 = not applicable (days > 0), 1 = without wages, 2 = left service.
 * Others (3 retired, 4 out of coverage, 5 expired, …) must be set by hand.
 */
export const ESI_ZERO_DAYS_REASON = { NONE: 0, WITHOUT_WAGES: 1, LEFT_SERVICE: 2 } as const;

export interface EsiConfig {
  /** Monthly gross ceiling for coverage (₹21,000). */
  esiGrossCeiling: number;
}

export interface EsiMemberInput {
  empCode: string;
  name: string;
  /** 10-digit ESIC Insurance (IP) number. */
  ipNumber: string | null | undefined;
  /** Days for which wages were paid this month (HrPayslip.paidDays). */
  paidDays: number;
  /** ESI wages paid this month = regular gross paid + ESI-applicable arrears. */
  esiWages: number;
  /**
   * FULL (un-prorated) contractual monthly gross — coverage is decided on the
   * contractual wage, not on what a low-attendance month happened to pay.
   */
  eligibilityWage: number;
  employeeEsi: number;
  employerEsi: number;
  /** Set only when the employee exited on/before the month end. */
  lastWorkingDay?: Date | null;
}

/** ESIC IP name: letters and spaces only, single-spaced. */
export function sanitizeEsiName(name: string): string {
  return (name ?? "")
    .replace(/[^A-Za-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coverage test: within the ceiling, OR the engine actually contributed. */
export function isEsiCovered(m: EsiMemberInput, cfg: EsiConfig): boolean {
  return (
    (Number(m.eligibilityWage) || 0) <= cfg.esiGrossCeiling ||
    rupee(m.employeeEsi) > 0 ||
    rupee(m.employerEsi) > 0
  );
}

export interface EsiRow {
  ipNumber: string;
  name: string;
  days: number;
  wages: number;
  reasonCode: number;
  lastWorkingDay: string;
}

export function computeEsiRow(m: EsiMemberInput): EsiRow {
  const days = rupee(m.paidDays);
  const exited = !!m.lastWorkingDay;
  const reasonCode =
    days > 0
      ? ESI_ZERO_DAYS_REASON.NONE
      : exited
        ? ESI_ZERO_DAYS_REASON.LEFT_SERVICE
        : ESI_ZERO_DAYS_REASON.WITHOUT_WAGES;
  return {
    ipNumber: (m.ipNumber ?? "").replace(/\D/g, ""),
    name: sanitizeEsiName(m.name),
    days,
    wages: rupee(m.esiWages),
    reasonCode,
    lastWorkingDay: m.lastWorkingDay ? formatDDMMYYYY(m.lastWorkingDay) : "",
  };
}

export function buildEsiReturnFile(input: {
  fy: string;
  month: number;
  members: EsiMemberInput[];
  cfgFor: (m: EsiMemberInput) => EsiConfig;
}): ExportFile {
  const warnings: string[] = [];
  const rows: EsiRow[] = [];

  for (const m of input.members) {
    const cfg = input.cfgFor(m);
    const who = `${m.empCode} ${m.name}`.trim();
    const ip = (m.ipNumber ?? "").replace(/\D/g, "");

    if (!isEsiCovered(m, cfg)) {
      // Statute excludes them; only worth a warning when they carry an IP number
      // (coverage continues to the end of the Apr–Sep / Oct–Mar contribution
      // period for someone who crossed the ceiling mid-period).
      if (ip)
        warnings.push(
          `${who}: has IP number ${ip} but monthly wage ₹${rupee(m.eligibilityWage)} is above the ESI ceiling ₹${cfg.esiGrossCeiling} — excluded. If they crossed the ceiling mid contribution-period they must still be reported; add the row by hand.`,
        );
      continue;
    }

    const r = computeEsiRow(m);
    if (!r.ipNumber) warnings.push(`${who}: ESI IP number missing — ESIC will reject this row until it is added to the employee's statutory record.`);
    else if (r.ipNumber.length !== 10) warnings.push(`${who}: IP number "${r.ipNumber}" is not 10 digits — verify before upload.`);
    if (!r.name) warnings.push(`${who}: name is empty after removing non-alphabet characters — fix the employee name.`);
    if (Math.abs((Number(m.paidDays) || 0) - r.days) > 1e-9)
      warnings.push(`${who}: paid days ${m.paidDays} rounded to ${r.days} (the template takes whole days).`);
    if (r.days === 0)
      warnings.push(
        `${who}: zero wage days — reason code ${r.reasonCode} (${r.reasonCode === 2 ? "left service" : "without wages"}) assumed; change it if another ESIC reason applies.`,
      );
    rows.push(r);
  }

  const content = [
    csvLine([...ESI_MC_HEADERS]),
    ...rows.map((r) => csvLine([r.ipNumber, r.name, r.days, r.wages, r.reasonCode, r.lastWorkingDay])),
  ].join("\r\n");

  return {
    fileName: `ESI_MC_${periodTag(input.fy, input.month)}.csv`,
    mimeType: "text/csv",
    content,
    rowCount: rows.length,
    warnings,
  };
}

// ============================================================
// 3) TDS Form 24Q annexure helper (quarterly)
// ============================================================

export const TDS_24Q_HEADERS = [
  "Employee PAN",
  "Employee Name",
  "Section",
  "Date of Payment/Credit",
  "Amount Paid/Credited",
  "TDS Deducted",
  "TDS Deposited",
] as const;

/** RPU placeholder for a deductee without a PAN (attracts 20% under s.206AA). */
export const PAN_NOT_AVAILABLE = "PANNOTAVBL";
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export interface TdsEmployeeRow {
  empCode: string;
  name: string;
  /** Plain-text PAN — decrypted by the ACTION, never stored here. */
  pan: string | null | undefined;
  /** Salary paid/credited this month (gross less bill-backed reimbursements). */
  amountPaid: number;
  tdsDeducted: number;
  /** Defaults to tdsDeducted — the app does not track challan deposits. */
  tdsDeposited?: number;
}

export interface TdsMonthInput {
  month: number; // calendar month 1..12
  /** Actual salary credit date if known; null → last day of the month is assumed. */
  dateOfPayment?: Date | null;
  rows: TdsEmployeeRow[];
}

export function buildTds24qFile(input: {
  fy: string;
  quarter: number;
  months: TdsMonthInput[];
}): ExportFile {
  const warnings: string[] = [];
  const expected = quarterMonths(input.quarter);
  const byMonth = new Map(input.months.map((m) => [m.month, m]));

  for (const mo of expected) {
    if (!byMonth.has(mo))
      warnings.push(`${MONTH_ABBR[mo - 1]} ${calendarYearFor(input.fy, mo)}: no finalised payroll run — this month is missing from the quarter.`);
  }
  if (input.months.some((m) => !m.dateOfPayment))
    warnings.push("Date of payment is assumed to be the last day of each salary month (the app does not record the actual credit date) — correct it in the RPU if salary was credited on another date.");
  warnings.push("TDS deposited is set equal to TDS deducted — reconcile against the OLTAS challans (BSR code, challan serial, deposit date) in the RPU before filing.");

  const detail: string[] = [];
  const summary: { month: number; employees: number; paid: number; deducted: number; deposited: number }[] = [];
  const panWarned = new Set<string>();
  let rowCount = 0;

  for (const mo of expected) {
    const m = byMonth.get(mo);
    if (!m) continue;
    const date = formatDDMMYYYY(m.dateOfPayment ?? lastDayOfMonth(input.fy, mo));
    let paid = 0;
    let deducted = 0;
    let deposited = 0;

    for (const r of m.rows) {
      const who = `${r.empCode} ${r.name}`.trim();
      let pan = (r.pan ?? "").replace(/\s+/g, "").toUpperCase();
      if (!pan) {
        pan = PAN_NOT_AVAILABLE;
        if (!panWarned.has(r.empCode)) {
          panWarned.add(r.empCode);
          warnings.push(`${who}: PAN missing — filed as ${PAN_NOT_AVAILABLE}; TDS should have been deducted at 20% (s.206AA). Add the PAN and regenerate.`);
        }
      } else if (!PAN_RE.test(pan) && !panWarned.has(r.empCode)) {
        panWarned.add(r.empCode);
        warnings.push(`${who}: PAN "${pan}" is not in the ABCDE1234F format — verify before filing.`);
      }
      const amt = rupee(r.amountPaid);
      const ded = rupee(r.tdsDeducted);
      const dep = rupee(r.tdsDeposited ?? r.tdsDeducted);
      paid += amt;
      deducted += ded;
      deposited += dep;
      detail.push(csvLine([pan, r.name, "192", date, amt, ded, dep]));
      rowCount++;
    }
    summary.push({ month: mo, employees: m.rows.length, paid, deducted, deposited });
  }

  const totals = summary.reduce(
    (t, s) => ({
      employees: t.employees + s.employees,
      paid: t.paid + s.paid,
      deducted: t.deducted + s.deducted,
      deposited: t.deposited + s.deposited,
    }),
    { employees: 0, paid: 0, deducted: 0, deposited: 0 },
  );

  const content = [
    csvLine([...TDS_24Q_HEADERS]),
    ...detail,
    "",
    csvLine([`Quarter summary — FY ${input.fy} Q${input.quarter}`]),
    csvLine(["Month", "Employees", "Amount Paid/Credited", "TDS Deducted", "TDS Deposited"]),
    ...summary.map((s) =>
      csvLine([`${MONTH_ABBR[s.month - 1]} ${calendarYearFor(input.fy, s.month)}`, s.employees, s.paid, s.deducted, s.deposited]),
    ),
    csvLine(["Total", totals.employees, totals.paid, totals.deducted, totals.deposited]),
  ].join("\r\n");

  return {
    fileName: `TDS_24Q_FY${input.fy}_Q${input.quarter}.csv`,
    mimeType: "text/csv",
    content,
    rowCount,
    warnings,
  };
}
