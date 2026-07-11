"use server";

// ============================================================
// Employee Reports — READ-ONLY reporting over the employee master.
// No writes, no money, no schema. Every report:
//   • gates on hr:read (returns empty payload otherwise — never throws),
//   • excludes soft-deleted rows (deletedAt: null),
//   • runs a single query, and
//   • returns plain-serialized rows (Dates → ISO yyyy-mm-dd in UTC).
// Dates are @db.Date (UTC midnight); we format/compute strictly in UTC so a
// DOB/DOJ/exit date never shifts a day in a behind-UTC timezone.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type EmployeeStatus } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

// --- guard (non-exported: a "use server" file may only export async fns) ------
async function canRead(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role ?? "";
  return hasPermission(role, "hr:read");
}

// --- shared filters -----------------------------------------------------------
export interface ReportFilters {
  entity?: string; // legalEntityId
  dept?: string; // departmentId
  desig?: string; // designationId
  status?: string; // EmployeeStatus
}

const VALID_STATUS = new Set<EmployeeStatus>([
  "ACTIVE",
  "ONBOARDING",
  "ON_LEAVE",
  "EXITED",
  "SUSPENDED",
]);

function baseWhere(f: ReportFilters = {}): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (f.entity) where.legalEntityId = f.entity;
  if (f.dept) where.departmentId = f.dept;
  if (f.desig) where.designationId = f.desig;
  if (f.status && VALID_STATUS.has(f.status as EmployeeStatus)) {
    where.status = f.status as EmployeeStatus;
  }
  return where;
}

// --- date helpers (all UTC) ---------------------------------------------------
/** yyyy-mm-dd in UTC, or "" for null. */
function utcDay(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  return d.toISOString().slice(0, 10);
}

/** UTC-midnight epoch for a Date's calendar day. */
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole months (rounded down) between two UTC calendar days, as {years, months}. */
function tenure(from: Date | null | undefined, to: Date): { months: number; label: string } {
  if (!from) return { months: 0, label: "—" };
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const label = y > 0 ? `${y}y ${m}m` : `${m}m`;
  return { months, label };
}

/** Parse a yyyy-mm-dd filter into UTC day-bounds. */
function rangeBounds(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const out: { gte?: Date; lte?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) out.gte = new Date(`${from}T00:00:00.000Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) out.lte = new Date(`${to}T23:59:59.999Z`);
  return out;
}

// ============================================================
// 1. Employee master — full directory export.
// ============================================================
export interface MasterRow {
  empCode: string;
  name: string;
  gender: string;
  dob: string;
  dateOfJoining: string;
  department: string;
  designation: string;
  branch: string;
  workEmail: string;
  personalEmail: string;
  phone: string;
  status: EmployeeStatus;
}

export async function getEmployeeMasterReport(
  f: ReportFilters = {}
): Promise<{ rows: MasterRow[] }> {
  if (!(await canRead())) return { rows: [] };

  const rows = await prisma.employee.findMany({
    where: baseWhere(f),
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      gender: true,
      dob: true,
      dateOfJoining: true,
      workEmail: true,
      personalEmail: true,
      phone: true,
      status: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return {
    rows: rows.map((r) => ({
      empCode: r.empCode,
      name: `${r.firstName} ${r.lastName}`.trim(),
      gender: r.gender ?? "",
      dob: utcDay(r.dob),
      dateOfJoining: utcDay(r.dateOfJoining),
      department: r.department?.name ?? "",
      designation: r.designation?.name ?? "",
      branch: r.legalEntity?.shortCode || r.legalEntity?.name || "",
      workEmail: r.workEmail ?? "",
      personalEmail: r.personalEmail ?? "",
      phone: r.phone ?? "",
      status: r.status,
    })),
  };
}

// ============================================================
// 2. Date of Birth — upcoming birthdays within N days (UTC).
// ============================================================
export interface DobRow {
  empCode: string;
  name: string;
  department: string;
  branch: string;
  dob: string; // yyyy-mm-dd
  birthday: string; // MMM DD (display-friendly, UTC month/day)
  daysUntil: number;
  turningAge: number;
}

export async function getDobReport(
  f: ReportFilters = {},
  windowDays = 30
): Promise<{ rows: DobRow[]; window: number }> {
  const win = [30, 60, 90].includes(windowDays) ? windowDays : 30;
  if (!(await canRead())) return { rows: [], window: win };

  const employees = await prisma.employee.findMany({
    where: { ...baseWhere(f), dob: { not: null } },
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      dob: true,
      department: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
    },
  });

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const rows: DobRow[] = [];
  for (const e of employees) {
    if (!e.dob) continue;
    const bm = e.dob.getUTCMonth();
    const bd = e.dob.getUTCDate();
    let nextYear = now.getUTCFullYear();
    let next = Date.UTC(nextYear, bm, bd);
    if (next < todayUTC) {
      nextYear += 1;
      next = Date.UTC(nextYear, bm, bd);
    }
    const daysUntil = Math.round((next - todayUTC) / 86_400_000);
    if (daysUntil > win) continue;
    rows.push({
      empCode: e.empCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: e.department?.name ?? "",
      branch: e.legalEntity?.shortCode || e.legalEntity?.name || "",
      dob: utcDay(e.dob),
      birthday: `${MONTHS[bm]} ${String(bd).padStart(2, "0")}`,
      daysUntil,
      turningAge: nextYear - e.dob.getUTCFullYear(),
    });
  }

  rows.sort((a, b) => a.daysUntil - b.daysUntil);
  return { rows, window: win };
}

// ============================================================
// 3. Date of Joining — joiners with tenure, date-range filterable.
// ============================================================
export interface DojRow {
  empCode: string;
  name: string;
  department: string;
  designation: string;
  branch: string;
  dateOfJoining: string;
  tenure: string;
  status: EmployeeStatus;
}

export async function getDojReport(
  f: ReportFilters = {},
  from?: string,
  to?: string
): Promise<{ rows: DojRow[] }> {
  if (!(await canRead())) return { rows: [] };

  const bounds = rangeBounds(from, to);
  const doj: Prisma.DateTimeNullableFilter = { not: null };
  if (bounds.gte) doj.gte = bounds.gte;
  if (bounds.lte) doj.lte = bounds.lte;

  const rows = await prisma.employee.findMany({
    where: { ...baseWhere(f), dateOfJoining: doj },
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      dateOfJoining: true,
      status: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
    },
    orderBy: [{ dateOfJoining: "desc" }],
  });

  const now = new Date();
  return {
    rows: rows.map((r) => ({
      empCode: r.empCode,
      name: `${r.firstName} ${r.lastName}`.trim(),
      department: r.department?.name ?? "",
      designation: r.designation?.name ?? "",
      branch: r.legalEntity?.shortCode || r.legalEntity?.name || "",
      dateOfJoining: utcDay(r.dateOfJoining),
      tenure: tenure(r.dateOfJoining, now).label,
      status: r.status,
    })),
  };
}

// ============================================================
// 4. Date of Leaving (exits) — status EXITED, with dateOfExit + tenure-at-exit.
// Exits in this app = status EXITED with a dateOfExit set on the employee
// record (set by the offboarding journey or soft-delete). We keep deletedAt:null
// so the report shows properly-offboarded, still-visible exit records.
// ============================================================
export interface ExitRow {
  empCode: string;
  name: string;
  department: string;
  designation: string;
  branch: string;
  dateOfJoining: string;
  dateOfExit: string;
  tenureAtExit: string;
}

export async function getExitReport(
  f: ReportFilters = {},
  from?: string,
  to?: string
): Promise<{ rows: ExitRow[] }> {
  if (!(await canRead())) return { rows: [] };

  // Force status EXITED regardless of any status filter passed in.
  const where: Prisma.EmployeeWhereInput = { ...baseWhere(f), status: "EXITED" };
  const bounds = rangeBounds(from, to);
  if (bounds.gte || bounds.lte) {
    const exitFilter: Prisma.DateTimeNullableFilter = {};
    if (bounds.gte) exitFilter.gte = bounds.gte;
    if (bounds.lte) exitFilter.lte = bounds.lte;
    where.dateOfExit = exitFilter;
  }

  const rows = await prisma.employee.findMany({
    where,
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      dateOfJoining: true,
      dateOfExit: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
    },
    orderBy: [{ dateOfExit: "desc" }],
  });

  return {
    rows: rows.map((r) => ({
      empCode: r.empCode,
      name: `${r.firstName} ${r.lastName}`.trim(),
      department: r.department?.name ?? "",
      designation: r.designation?.name ?? "",
      branch: r.legalEntity?.shortCode || r.legalEntity?.name || "",
      dateOfJoining: utcDay(r.dateOfJoining),
      dateOfExit: utcDay(r.dateOfExit),
      tenureAtExit: r.dateOfExit ? tenure(r.dateOfJoining, r.dateOfExit).label : "—",
    })),
  };
}

// ============================================================
// 5. Reporting Authority — employee → reporting manager mapping.
// ============================================================
export interface ReportingRow {
  empCode: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  managerCode: string;
  managerName: string;
}

export async function getReportingReport(
  f: ReportFilters = {}
): Promise<{ rows: ReportingRow[] }> {
  if (!(await canRead())) return { rows: [] };

  const rows = await prisma.employee.findMany({
    where: baseWhere(f),
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
      reportingManager: {
        select: { empCode: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return {
    rows: rows.map((r) => ({
      empCode: r.empCode,
      name: `${r.firstName} ${r.lastName}`.trim(),
      designation: r.designation?.name ?? "",
      department: r.department?.name ?? "",
      branch: r.legalEntity?.shortCode || r.legalEntity?.name || "",
      managerCode: r.reportingManager?.empCode ?? "",
      managerName: r.reportingManager
        ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}`.trim()
        : "",
    })),
  };
}

// ============================================================
// 6. Classification — headcount pivoted by dept / designation / branch / status.
// Single query (findMany select-only); pivots computed in JS so we can label
// each bucket without extra lookups.
// ============================================================
export interface ClassBucket {
  key: string;
  count: number;
}
export interface ClassificationReport {
  total: number;
  byDepartment: ClassBucket[];
  byDesignation: ClassBucket[];
  byBranch: ClassBucket[];
  byStatus: ClassBucket[];
}

export async function getClassificationReport(
  f: ReportFilters = {}
): Promise<ClassificationReport> {
  const empty: ClassificationReport = {
    total: 0,
    byDepartment: [],
    byDesignation: [],
    byBranch: [],
    byStatus: [],
  };
  if (!(await canRead())) return empty;

  const employees = await prisma.employee.findMany({
    where: baseWhere(f),
    select: {
      status: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
      legalEntity: { select: { name: true, shortCode: true } },
    },
  });

  const tally = (labels: (string | null | undefined)[]): ClassBucket[] => {
    const m = new Map<string, number>();
    for (const l of labels) {
      const key = l && l.trim() ? l : "Unassigned";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  };

  return {
    total: employees.length,
    byDepartment: tally(employees.map((e) => e.department?.name)),
    byDesignation: tally(employees.map((e) => e.designation?.name)),
    byBranch: tally(employees.map((e) => e.legalEntity?.shortCode || e.legalEntity?.name)),
    byStatus: tally(employees.map((e) => e.status)),
  };
}
