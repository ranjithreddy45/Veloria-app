"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENTITY_ID = "BILLION";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ------------------------------------------------------------
// Auth + permission boilerplate (mirrors hr-payroll-run.actions.ts).
// ------------------------------------------------------------
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

/**
 * Calendar year for an Indian FY + calendar month. FY "2026-27" spans
 * Apr 2026 → Mar 2027, so months 4..12 belong to the first year (2026) and
 * months 1..3 belong to the second year (2027).
 */
function calendarYearFor(fy: string, month: number): number {
  const first = Number(fy.slice(0, 4));
  return month >= 4 ? first : first + 1;
}

/** Days in a given calendar month (month 1..12). `Date.UTC(y, m, 0)` = last day of month m. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True when two dates fall on the same UTC calendar day. */
function sameUTCDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function validPeriod(fy: string | undefined, month: number): { fy: string; month: number } | null {
  const f = fy?.trim();
  if (!f || !/^\d{4}-\d{2}$/.test(f)) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { fy: f, month };
}

// ============================================================
// generateAttendanceSheet — auto-build the monthly report per employee.
// ============================================================
export async function generateAttendanceSheet(input: {
  fy: string;
  month: number;
  force?: boolean;
}): Promise<Result<{ generated: number; refreshed: number; kept: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const period = validPeriod(input.fy, Number(input.month));
  if (!period) return { success: false, error: "Pick a valid financial year and month." };
  const { fy, month } = period;
  const force = input.force === true;

  const year = calendarYearFor(fy, month);
  const totalDays = daysInMonth(year, month);
  // IST-safe month bounds: @db.Date values are stored at UTC midnight, so we
  // window with UTC bounds [first-of-month, first-of-next-month).
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ACTIVE workforce for this entity.
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true, legalEntityId: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  if (employees.length === 0) return { success: false, error: "No active employees to build the sheet for." };

  // --- Holidays in the month → per-entity sets of day-of-month numbers. ---
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    select: { date: true, legalEntityId: true },
  });
  const holidayAll = new Set<number>(); // legalEntityId null → applies to every entity
  const holidayByEntity = new Map<string, Set<number>>();
  for (const h of holidays) {
    const day = h.date.getUTCDate();
    if (h.legalEntityId) {
      const set = holidayByEntity.get(h.legalEntityId) ?? new Set<number>();
      set.add(day);
      holidayByEntity.set(h.legalEntityId, set);
    } else {
      holidayAll.add(day);
    }
  }
  function isWorkingDay(dayNum: number, entityId: string | null): boolean {
    const dow = new Date(Date.UTC(year, month - 1, dayNum)).getUTCDay(); // 0=Sun … 6=Sat
    if (dow === 0 || dow === 6) return false; // weekend
    if (holidayAll.has(dayNum)) return false;
    if (entityId && holidayByEntity.get(entityId)?.has(dayNum)) return false;
    return true;
  }
  function workingDaysFor(entityId: string | null): number {
    let n = 0;
    for (let d = 1; d <= totalDays; d++) if (isWorkingDay(d, entityId)) n++;
    return n;
  }

  const empIds = employees.map((e) => e.id);

  // --- Attendance → present days (PRESENT/WFH = 1, HALF_DAY = 0.5). ---
  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: empIds }, date: { gte: monthStart, lt: monthEnd } },
    select: { employeeId: true, status: true },
  });
  const presentByEmp = new Map<string, number>();
  for (const r of records) {
    let v = 0;
    if (r.status === "PRESENT" || r.status === "WFH") v = 1;
    else if (r.status === "HALF_DAY") v = 0.5;
    if (v > 0) presentByEmp.set(r.employeeId, (presentByEmp.get(r.employeeId) ?? 0) + v);
  }

  // --- Approved PAID leave overlapping the month → leave days (prorated). ---
  const leaveReqs = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: empIds },
      status: "APPROVED",
      leaveType: { is: { paid: true } },
      startDate: { lt: monthEnd },
      endDate: { gte: monthStart },
    },
    select: { employeeId: true, startDate: true, endDate: true, startPart: true, endPart: true },
  });
  const empEntity = new Map(employees.map((e) => [e.id, e.legalEntityId]));
  const leaveByEmp = new Map<string, number>();
  for (const req of leaveReqs) {
    const entityId = empEntity.get(req.employeeId) ?? null;
    let leave = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dUTC = new Date(Date.UTC(year, month - 1, d));
      // in the leave span?
      if (dUTC < req.startDate || dUTC > req.endDate) continue;
      if (!isWorkingDay(d, entityId)) continue;
      let contrib = 1;
      if (sameUTCDate(dUTC, req.startDate) && req.startPart !== "FULL") contrib = 0.5;
      if (sameUTCDate(dUTC, req.endDate) && req.endPart !== "FULL") contrib = Math.min(contrib, 0.5);
      leave += contrib;
    }
    if (leave > 0) leaveByEmp.set(req.employeeId, (leaveByEmp.get(req.employeeId) ?? 0) + leave);
  }

  // --- Existing rows → honour manual edits / finalised rows. ---
  const existing = await prisma.monthlyAttendanceSheet.findMany({
    where: { entityId: ENTITY_ID, fy, month },
    select: { employeeId: true, status: true, edited: true },
  });
  const existingByEmp = new Map(existing.map((r) => [r.employeeId, r]));

  let generated = 0;
  let refreshed = 0;
  let kept = 0;

  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const prior = existingByEmp.get(emp.id);
      // Never clobber a FINAL row, and don't overwrite a manually-edited DRAFT
      // unless the caller forces a refresh.
      if (prior && (prior.status === "FINAL" || (prior.edited && !force))) {
        kept++;
        continue;
      }

      const workingDays = workingDaysFor(emp.legalEntityId);
      const presentDays = round2(presentByEmp.get(emp.id) ?? 0);
      const leaveDays = round2(leaveByEmp.get(emp.id) ?? 0);
      const lopDays = round2(Math.max(0, workingDays - presentDays - leaveDays));
      const name = `${emp.firstName} ${emp.lastName}`.trim();

      const computed = {
        empCodeSnap: emp.empCode,
        nameSnap: name,
        workingDays,
        presentDays: new Prisma.Decimal(presentDays),
        leaveDays: new Prisma.Decimal(leaveDays),
        lopDays: new Prisma.Decimal(lopDays),
      };

      await tx.monthlyAttendanceSheet.upsert({
        where: { entityId_fy_month_employeeId: { entityId: ENTITY_ID, fy, month, employeeId: emp.id } },
        create: {
          entityId: ENTITY_ID,
          fy,
          month,
          employeeId: emp.id,
          status: "DRAFT",
          edited: false,
          createdById: u?.id ?? null,
          ...computed,
        },
        // Refreshing a computed DRAFT row: reset edited (this is the fresh auto figure).
        update: { ...computed, status: "DRAFT", edited: false },
      });

      if (prior) refreshed++;
      else generated++;
    }
  });

  revalidatePath("/people/payroll/attendance-sheet");
  return { success: true, data: { generated, refreshed, kept } };
}

// ============================================================
// getAttendanceSheet — rows + totals for the period.
// ============================================================
export interface AttendanceSheetRow {
  id: string;
  employeeId: string;
  empCode: string;
  name: string;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays: number;
  status: string;
  edited: boolean;
  note: string | null;
}
export interface AttendanceSheet {
  fy: string;
  month: number;
  rows: AttendanceSheetRow[];
  totals: { headcount: number; workingDays: number; presentDays: number; leaveDays: number; lopDays: number };
  allFinal: boolean;
  anyFinal: boolean;
}

export async function getAttendanceSheet(input: { fy: string; month: number }): Promise<AttendanceSheet | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return null;

  const period = validPeriod(input.fy, Number(input.month));
  if (!period) return null;
  const { fy, month } = period;

  const sheets = await prisma.monthlyAttendanceSheet.findMany({
    where: { entityId: ENTITY_ID, fy, month },
    orderBy: { nameSnap: "asc" },
  });

  const rows: AttendanceSheetRow[] = sheets.map((s) => ({
    id: s.id,
    employeeId: s.employeeId,
    empCode: s.empCodeSnap,
    name: s.nameSnap,
    workingDays: s.workingDays,
    presentDays: Number(s.presentDays),
    leaveDays: Number(s.leaveDays),
    lopDays: Number(s.lopDays),
    status: s.status,
    edited: s.edited,
    note: s.note,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.headcount += 1;
      acc.workingDays += r.workingDays;
      acc.presentDays += r.presentDays;
      acc.leaveDays += r.leaveDays;
      acc.lopDays += r.lopDays;
      return acc;
    },
    { headcount: 0, workingDays: 0, presentDays: 0, leaveDays: 0, lopDays: 0 },
  );
  totals.presentDays = round2(totals.presentDays);
  totals.leaveDays = round2(totals.leaveDays);
  totals.lopDays = round2(totals.lopDays);

  return {
    fy,
    month,
    rows,
    totals,
    allFinal: rows.length > 0 && rows.every((r) => r.status === "FINAL"),
    anyFinal: rows.some((r) => r.status === "FINAL"),
  };
}

// ============================================================
// updateAttendanceSheetRow — HR correction (marks the row edited).
// ============================================================
export async function updateAttendanceSheetRow(
  id: string,
  patch: { presentDays?: number; leaveDays?: number; lopDays?: number; note?: string },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const row = await prisma.monthlyAttendanceSheet.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Attendance sheet row not found." };
  if (row.status === "FINAL")
    return { success: false, error: "This sheet is finalised — reopen it before editing." };

  const clampDays = (v: number) => Math.max(0, Math.min(row.workingDays, round2(v)));

  const presentGiven = typeof patch.presentDays === "number" && Number.isFinite(patch.presentDays);
  const leaveGiven = typeof patch.leaveDays === "number" && Number.isFinite(patch.leaveDays);
  const lopGiven = typeof patch.lopDays === "number" && Number.isFinite(patch.lopDays);

  const presentDays = presentGiven ? clampDays(patch.presentDays!) : Number(row.presentDays);
  const leaveDays = leaveGiven ? clampDays(patch.leaveDays!) : Number(row.leaveDays);
  // Recompute LOP when present/leave changed and LOP not explicitly supplied.
  const lopDays =
    lopGiven
      ? Math.max(0, round2(patch.lopDays!))
      : round2(Math.max(0, row.workingDays - presentDays - leaveDays));

  const data: Prisma.MonthlyAttendanceSheetUpdateInput = {
    presentDays: new Prisma.Decimal(presentDays),
    leaveDays: new Prisma.Decimal(leaveDays),
    lopDays: new Prisma.Decimal(lopDays),
    edited: true,
  };
  if (patch.note !== undefined) data.note = patch.note.trim() || null;

  await prisma.monthlyAttendanceSheet.update({ where: { id }, data });

  revalidatePath("/people/payroll/attendance-sheet");
  return { success: true, data: { id } };
}

// ============================================================
// finalizeAttendanceSheet / reopenAttendanceSheet — lifecycle.
// ============================================================
export async function finalizeAttendanceSheet(input: {
  fy: string;
  month: number;
}): Promise<Result<{ count: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const period = validPeriod(input.fy, Number(input.month));
  if (!period) return { success: false, error: "Pick a valid financial year and month." };
  const { fy, month } = period;

  const rowCount = await prisma.monthlyAttendanceSheet.count({ where: { entityId: ENTITY_ID, fy, month } });
  if (rowCount === 0) return { success: false, error: "Generate the sheet before finalising." };

  const res = await prisma.monthlyAttendanceSheet.updateMany({
    where: { entityId: ENTITY_ID, fy, month, status: "DRAFT" },
    data: { status: "FINAL" },
  });

  revalidatePath("/people/payroll/attendance-sheet");
  return { success: true, data: { count: res.count } };
}

export async function reopenAttendanceSheet(input: {
  fy: string;
  month: number;
}): Promise<Result<{ count: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const period = validPeriod(input.fy, Number(input.month));
  if (!period) return { success: false, error: "Pick a valid financial year and month." };
  const { fy, month } = period;

  const res = await prisma.monthlyAttendanceSheet.updateMany({
    where: { entityId: ENTITY_ID, fy, month, status: "FINAL" },
    data: { status: "DRAFT" },
  });

  revalidatePath("/people/payroll/attendance-sheet");
  return { success: true, data: { count: res.count } };
}

// Exposed for the picker: label helpers reused by the page.
export async function attendanceSheetPeriodLabel(fy: string, month: number): Promise<string> {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) return fy;
  return `${MONTH_ABBR[m - 1]} ${calendarYearFor(fy, m)}`;
}
