"use server";

// ============================================================
// Time-Office / Attendance Reports — READ-ONLY reporting over the existing
// AttendanceRecord data. No schema changes, no mutations. Every function is
// guarded on `hr:read`, excludes soft-deleted employees (deletedAt: null), and
// builds every day boundary at UTC-midnight so days never shift under the
// IST↔UTC offset (@db.Date columns are stored at UTC-midnight).
//
// The five reports:
//   1. getMonthlySummary   — per-employee status tally + worked hours for a month
//   2. getExceptions       — flagged / unverified punches (geo-integrity)
//   3. getLateEarly        — first check-in vs a configurable expected-in time
//   4. getAbsentReport     — explicit ABSENT records in a range
//   5. getPunchReport      — raw punches with geo + a maps link
//
// siteId is a plain String (no Prisma relation) → site names are resolved via a
// one-shot id→name Map. Clock times are returned as Date and formatted in IST
// on the client; this file only deals in UTC-midnight day boundaries.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { AttendanceStatus } from "@prisma/client";

// ------------------------------------------------------------
// Guards & shared helpers
// ------------------------------------------------------------

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

/** Active roster for reports = simply not soft-deleted (historic/EXITED staff
 * still belong in historic attendance reports). */
const ROSTER_WHERE = { deletedAt: null } as const;
const ROSTER_ORDER = [{ firstName: "asc" as const }, { lastName: "asc" as const }];

/** Parse "YYYY-MM-DD" into its UTC-midnight Date (matches the @db.Date column). */
function utcMidnightOf(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Calendar year a given month sits in for an Indian FY (Apr-start). fy="2025-26". */
function calendarYearForFyMonth(fy: string, month: number): number | null {
  const start = Number(fy.split("-")[0]);
  if (!Number.isFinite(start) || month < 1 || month > 12) return null;
  return month >= 4 ? start : start + 1;
}

/** Normalise a {from,to} range to inclusive UTC-midnight bounds (from ≤ to). */
function utcRange(from?: string, to?: string): { from: Date; to: Date } | null {
  const f = from ? utcMidnightOf(from) : null;
  const t = to ? utcMidnightOf(to) : null;
  if (!f || !t) return null;
  return f.getTime() <= t.getTime() ? { from: f, to: t } : { from: t, to: f };
}

/** One-shot AttendanceSite id→name map (siteId is a plain String, no relation). */
async function siteNameMap(): Promise<Map<string, string>> {
  const sites = await prisma.attendanceSite.findMany({ select: { id: true, name: true } });
  return new Map(sites.map((s) => [s.id, s.name]));
}

function empName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

// ============================================================
// 1. Monthly summary — per-employee status tally + worked hours
// ============================================================

export interface MonthlySummaryRow {
  employeeId: string;
  name: string;
  empCode: string;
  department: string | null;
  present: number;
  absent: number;
  halfDay: number;
  wfh: number;
  onLeave: number;
  holiday: number;
  weekend: number;
  recordedDays: number;
  workedMinutes: number;
}

export interface MonthlySummary {
  fy: string;
  month: number; // 1-12
  year: number;
  daysInMonth: number;
  rows: MonthlySummaryRow[];
  totals: {
    headcount: number;
    present: number;
    absent: number;
    halfDay: number;
    wfh: number;
    onLeave: number;
    workedMinutes: number;
  };
}

export async function getMonthlySummary(input: {
  fy: string;
  month: number;
}): Promise<MonthlySummary | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const year = calendarYearForFyMonth(input.fy, input.month);
  if (year == null) return null;
  const month = input.month;

  // UTC-midnight bounds of the calendar month.
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0)); // last day of month
  const daysInMonth = to.getUTCDate();

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: ROSTER_WHERE,
      select: {
        id: true,
        empCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
      },
      orderBy: ROSTER_ORDER,
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: from, lte: to }, employee: ROSTER_WHERE },
      select: { employeeId: true, status: true, workedMinutes: true },
    }),
  ]);

  // employeeId → accumulator
  const acc = new Map<string, MonthlySummaryRow>();
  for (const e of employees) {
    acc.set(e.id, {
      employeeId: e.id,
      name: empName(e),
      empCode: e.empCode,
      department: e.department?.name ?? null,
      present: 0,
      absent: 0,
      halfDay: 0,
      wfh: 0,
      onLeave: 0,
      holiday: 0,
      weekend: 0,
      recordedDays: 0,
      workedMinutes: 0,
    });
  }
  for (const r of records) {
    const row = acc.get(r.employeeId);
    if (!row) continue; // record for a soft-deleted employee — skip
    row.recordedDays += 1;
    row.workedMinutes += r.workedMinutes;
    switch (r.status) {
      case "PRESENT": row.present += 1; break;
      case "ABSENT": row.absent += 1; break;
      case "HALF_DAY": row.halfDay += 1; break;
      case "WFH": row.wfh += 1; break;
      case "ON_LEAVE": row.onLeave += 1; break;
      case "HOLIDAY": row.holiday += 1; break;
      case "WEEKEND": row.weekend += 1; break;
    }
  }

  const rows = [...acc.values()];
  const totals = rows.reduce(
    (t, r) => {
      t.present += r.present;
      t.absent += r.absent;
      t.halfDay += r.halfDay;
      t.wfh += r.wfh;
      t.onLeave += r.onLeave;
      t.workedMinutes += r.workedMinutes;
      return t;
    },
    { headcount: rows.length, present: 0, absent: 0, halfDay: 0, wfh: 0, onLeave: 0, workedMinutes: 0 },
  );

  return { fy: input.fy, month, year, daysInMonth, rows, totals };
}

// ============================================================
// 2. Exception report — flagged / unverified punches (geo integrity)
// ============================================================

export interface ExceptionRow {
  id: string;
  employeeId: string;
  name: string;
  empCode: string;
  date: Date;
  status: AttendanceStatus;
  flagged: boolean;
  flagReason: string | null;
  isRegularized: boolean;
  locationVerified: boolean | null;
  checkOutVerified: boolean | null;
  accuracyM: number | null;
  siteId: string | null;
  siteName: string | null;
  checkInAt: Date | null;
  visitType: string | null;
}

export interface ExceptionReport {
  from: string;
  to: string;
  rows: ExceptionRow[];
  totals: { total: number; flagged: number; unverified: number };
}

export async function getExceptions(input: {
  from: string;
  to: string;
}): Promise<ExceptionReport | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const range = utcRange(input.from, input.to);
  if (!range) return null;

  const [records, siteMap] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        employee: ROSTER_WHERE,
        // Geo-integrity exceptions: flagged OR location not verified.
        OR: [{ flagged: true }, { locationVerified: false }],
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        status: true,
        flagged: true,
        flagReason: true,
        isRegularized: true,
        locationVerified: true,
        checkOutVerified: true,
        checkInAccuracyM: true,
        siteId: true,
        checkInAt: true,
        visitType: true,
        employee: { select: { empCode: true, firstName: true, lastName: true } },
      },
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
    }),
    siteNameMap(),
  ]);

  const rows: ExceptionRow[] = records.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    name: empName(r.employee),
    empCode: r.employee.empCode,
    date: r.date,
    status: r.status,
    flagged: r.flagged,
    flagReason: r.flagReason,
    isRegularized: r.isRegularized,
    locationVerified: r.locationVerified,
    checkOutVerified: r.checkOutVerified,
    accuracyM: r.checkInAccuracyM,
    siteId: r.siteId,
    siteName: r.siteId ? siteMap.get(r.siteId) ?? null : null,
    checkInAt: r.checkInAt,
    visitType: r.visitType,
  }));

  const totals = {
    total: rows.length,
    flagged: rows.filter((r) => r.flagged).length,
    unverified: rows.filter((r) => r.locationVerified === false).length,
  };

  return { from: input.from, to: input.to, rows, totals };
}

// ============================================================
// 3. Late-in / Early-out
// ------------------------------------------------------------
// HONEST NOTE on what "late" means here: this org has no per-employee shift
// roster joinable to a punch, so "late" is NOT measured against an individual
// shift. Instead it is measured against a single, configurable, org-wide
// expected clock window (default: in by 09:30 IST, out by 18:00 IST). A day is
// also marked "short" when workedMinutes falls below a configurable threshold
// (default 240 min). Treat these as eyeball aids, not a payroll-grade verdict.
// ============================================================

/** Default expected-in / expected-out, minutes-since-IST-midnight. */
const DEFAULT_EXPECTED_IN_MIN = 9 * 60 + 30; // 09:30 IST
const DEFAULT_EXPECTED_OUT_MIN = 18 * 60; // 18:00 IST
const DEFAULT_SHORT_DAY_MIN = 240; // below this worked → short day

/** Minutes-since-midnight of a Date, read in IST. */
function istMinutesOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

export interface LateEarlyRow {
  id: string;
  employeeId: string;
  name: string;
  empCode: string;
  date: Date;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  workedMinutes: number;
  lateInMinutes: number; // minutes past expected-in; 0 if on time / no punch
  earlyOutMinutes: number; // minutes before expected-out; 0 if none / no punch
  isLate: boolean;
  isEarlyOut: boolean;
  isShortDay: boolean;
}

export interface LateEarlyReport {
  from: string;
  to: string;
  expectedInMin: number;
  expectedOutMin: number;
  shortDayMin: number;
  rows: LateEarlyRow[];
  totals: { total: number; late: number; earlyOut: number; shortDay: number };
}

export async function getLateEarly(input: {
  from: string;
  to: string;
  expectedInMin?: number;
  expectedOutMin?: number;
  shortDayMin?: number;
}): Promise<LateEarlyReport | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const range = utcRange(input.from, input.to);
  if (!range) return null;

  const expectedInMin =
    Number.isFinite(input.expectedInMin) && input.expectedInMin! >= 0 && input.expectedInMin! < 1440
      ? Math.round(input.expectedInMin!)
      : DEFAULT_EXPECTED_IN_MIN;
  const expectedOutMin =
    Number.isFinite(input.expectedOutMin) && input.expectedOutMin! >= 0 && input.expectedOutMin! < 1440
      ? Math.round(input.expectedOutMin!)
      : DEFAULT_EXPECTED_OUT_MIN;
  const shortDayMin =
    Number.isFinite(input.shortDayMin) && input.shortDayMin! >= 0
      ? Math.round(input.shortDayMin!)
      : DEFAULT_SHORT_DAY_MIN;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: range.from, lte: range.to },
      employee: ROSTER_WHERE,
      // Only days the person actually worked have a meaningful in/out clock.
      status: { in: ["PRESENT", "HALF_DAY", "WFH"] },
      checkInAt: { not: null },
    },
    select: {
      id: true,
      employeeId: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      workedMinutes: true,
      employee: { select: { empCode: true, firstName: true, lastName: true } },
    },
    orderBy: [{ date: "desc" }, { employeeId: "asc" }],
  });

  const rows: LateEarlyRow[] = records.map((r) => {
    const inMin = r.checkInAt ? istMinutesOfDay(r.checkInAt) : null;
    const outMin = r.checkOutAt ? istMinutesOfDay(r.checkOutAt) : null;
    const lateInMinutes = inMin != null ? Math.max(0, inMin - expectedInMin) : 0;
    const earlyOutMinutes = outMin != null ? Math.max(0, expectedOutMin - outMin) : 0;
    return {
      id: r.id,
      employeeId: r.employeeId,
      name: empName(r.employee),
      empCode: r.employee.empCode,
      date: r.date,
      status: r.status,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      workedMinutes: r.workedMinutes,
      lateInMinutes,
      earlyOutMinutes,
      isLate: lateInMinutes > 0,
      isEarlyOut: earlyOutMinutes > 0,
      isShortDay: r.workedMinutes > 0 && r.workedMinutes < shortDayMin,
    };
  });

  // Surface the exceptions first: late, early-out or short days.
  const flagged = rows.filter((r) => r.isLate || r.isEarlyOut || r.isShortDay);

  const totals = {
    total: flagged.length,
    late: flagged.filter((r) => r.isLate).length,
    earlyOut: flagged.filter((r) => r.isEarlyOut).length,
    shortDay: flagged.filter((r) => r.isShortDay).length,
  };

  return {
    from: input.from,
    to: input.to,
    expectedInMin,
    expectedOutMin,
    shortDayMin,
    rows: flagged,
    totals,
  };
}

// ============================================================
// 4. Absent report
// ------------------------------------------------------------
// HONEST NOTE: this reports rows explicitly marked ABSENT within the range.
// Days with NO record are NOT inferred as absent — without an authoritative
// per-employee working-day / holiday calendar, a missing row could equally be a
// weekend, holiday or simply un-posted attendance. Use the Monthly Summary for
// coverage gaps.
// ============================================================

export interface AbsentRow {
  id: string;
  employeeId: string;
  name: string;
  empCode: string;
  department: string | null;
  date: Date;
  isRegularized: boolean;
  note: string | null;
}

export interface AbsentReport {
  from: string;
  to: string;
  rows: AbsentRow[];
  totals: { total: number; employees: number; regularized: number };
}

export async function getAbsentReport(input: {
  from: string;
  to: string;
}): Promise<AbsentReport | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const range = utcRange(input.from, input.to);
  if (!range) return null;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: range.from, lte: range.to },
      employee: ROSTER_WHERE,
      status: "ABSENT",
    },
    select: {
      id: true,
      employeeId: true,
      date: true,
      isRegularized: true,
      note: true,
      employee: {
        select: {
          empCode: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { employeeId: "asc" }],
  });

  const rows: AbsentRow[] = records.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    name: empName(r.employee),
    empCode: r.employee.empCode,
    department: r.employee.department?.name ?? null,
    date: r.date,
    isRegularized: r.isRegularized,
    note: r.note,
  }));

  const totals = {
    total: rows.length,
    employees: new Set(rows.map((r) => r.employeeId)).size,
    regularized: rows.filter((r) => r.isRegularized).length,
  };

  return { from: input.from, to: input.to, rows, totals };
}

// ============================================================
// 5. Punch report — raw punches with geo + maps link
// ============================================================

export interface PunchRow {
  id: string;
  employeeId: string;
  name: string;
  empCode: string;
  date: Date;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  workedMinutes: number;
  siteId: string | null;
  siteName: string | null;
  checkInVerified: boolean | null;
  checkOutVerified: boolean | null;
  visitType: string | null;
  lat: number | null;
  lng: number | null;
  flagged: boolean;
}

export interface PunchReport {
  from: string;
  to: string;
  rows: PunchRow[];
  totals: { total: number; withGeo: number; flagged: number; workedMinutes: number };
}

export async function getPunchReport(input: {
  from: string;
  to: string;
}): Promise<PunchReport | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const range = utcRange(input.from, input.to);
  if (!range) return null;

  const [records, siteMap] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        employee: ROSTER_WHERE,
        // A "punch" is a day where the person actually checked in.
        checkInAt: { not: null },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        workedMinutes: true,
        siteId: true,
        locationVerified: true,
        checkOutVerified: true,
        visitType: true,
        checkInLat: true,
        checkInLng: true,
        flagged: true,
        employee: { select: { empCode: true, firstName: true, lastName: true } },
      },
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
    }),
    siteNameMap(),
  ]);

  const rows: PunchRow[] = records.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    name: empName(r.employee),
    empCode: r.employee.empCode,
    date: r.date,
    status: r.status,
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    workedMinutes: r.workedMinutes,
    siteId: r.siteId,
    siteName: r.siteId ? siteMap.get(r.siteId) ?? null : null,
    checkInVerified: r.locationVerified,
    checkOutVerified: r.checkOutVerified,
    visitType: r.visitType,
    lat: r.checkInLat,
    lng: r.checkInLng,
    flagged: r.flagged,
  }));

  const totals = {
    total: rows.length,
    withGeo: rows.filter((r) => r.lat != null && r.lng != null).length,
    flagged: rows.filter((r) => r.flagged).length,
    workedMinutes: rows.reduce((s, r) => s + r.workedMinutes, 0),
  };

  return { from: input.from, to: input.to, rows, totals };
}
