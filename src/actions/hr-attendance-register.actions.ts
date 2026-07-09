"use server";

// ============================================================
// HR Attendance Register — org-wide muster (read-only).
//
// The per-employee attendance actions live in hr-attendance.actions.ts;
// this file adds the *organisation* view HR was missing:
//   • getDailyMuster   — for one day, every active employee with their punch
//                        (LEFT-JOIN semantics: no record ⇒ ABSENT / no-punch).
//   • getMonthlyRegister — employee × day-of-month status grid.
//
// Guarded on hr:read. Dates are IST-anchored but @db.Date columns are stored
// at UTC-midnight, so every day key is built as Date.UTC(...) and every
// clock time is formatted with timeZone "Asia/Kolkata".
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

/** UTC-midnight of the IST calendar day for "now" — the muster's default day. */
function todayIstDateString(): string {
  // en-CA renders YYYY-MM-DD; anchoring to Asia/Kolkata gives the IST day.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Parse a "YYYY-MM-DD" day key into its UTC-midnight Date (matches @db.Date). */
function utcMidnightOf(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Active roster = not soft-deleted and not EXITED. */
const ROSTER_WHERE = { deletedAt: null, status: { not: "EXITED" as const } };
const ROSTER_ORDER = [{ firstName: "asc" as const }, { lastName: "asc" as const }];

export type MusterStatus =
  | "PRESENT" | "ABSENT" | "HALF_DAY" | "WFH" | "ON_LEAVE" | "HOLIDAY" | "WEEKEND";

export interface MusterRow {
  employeeId: string;
  name: string;
  empCode: string;
  department: string | null;
  status: MusterStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  workedMinutes: number;
  visitType: string | null;
  flagged: boolean;
  flagReason: string | null;
  isRegularized: boolean;
}

export interface DailyMuster {
  date: string; // YYYY-MM-DD (IST day)
  rows: MusterRow[];
  summary: {
    headcount: number;
    present: number; // PRESENT + HALF_DAY (physically working / in office)
    absent: number; // explicit ABSENT + no record for the day
    wfh: number;
    onLeave: number;
    flagged: number;
  };
}

/**
 * The org-wide muster for a single day. Every active employee is returned; those
 * with no AttendanceRecord for the day surface as ABSENT with no punch — this is
 * the LEFT-JOIN we get by including a date-filtered `attendance` relation (take 1
 * on the @@unique([employeeId, date]) row) rather than querying records first.
 */
export async function getDailyMuster(input: { date?: string }): Promise<DailyMuster | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const dayStr = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayIstDateString();
  const date = utcMidnightOf(dayStr);
  if (!date) return null;

  const employees = await prisma.employee.findMany({
    where: ROSTER_WHERE,
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      // LEFT JOIN: the day's record if any (0 or 1 by the unique constraint).
      attendance: {
        where: { date },
        take: 1,
        select: {
          status: true,
          checkInAt: true,
          checkOutAt: true,
          workedMinutes: true,
          visitType: true,
          flagged: true,
          flagReason: true,
          isRegularized: true,
        },
      },
    },
    orderBy: ROSTER_ORDER,
  });

  const rows: MusterRow[] = employees.map((e) => {
    const rec = e.attendance[0] ?? null;
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      empCode: e.empCode,
      department: e.department?.name ?? null,
      status: (rec?.status ?? "ABSENT") as MusterStatus,
      checkInAt: rec?.checkInAt ?? null,
      checkOutAt: rec?.checkOutAt ?? null,
      workedMinutes: rec?.workedMinutes ?? 0,
      visitType: rec?.visitType ?? null,
      flagged: rec?.flagged ?? false,
      flagReason: rec?.flagReason ?? null,
      isRegularized: rec?.isRegularized ?? false,
    };
  });

  const summary = {
    headcount: rows.length,
    present: rows.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    wfh: rows.filter((r) => r.status === "WFH").length,
    onLeave: rows.filter((r) => r.status === "ON_LEAVE").length,
    flagged: rows.filter((r) => r.flagged).length,
  };

  return { date: dayStr, rows, summary };
}

// ============================================================
// Monthly register — employee × day-of-month status grid.
// Two queries total: the roster, and every record in the month window.
// ============================================================

export interface MonthlyRegister {
  fy: string;
  month: number; // 1-12
  year: number; // calendar year the month falls in
  daysInMonth: number;
  rows: Array<{
    employeeId: string;
    name: string;
    empCode: string;
    department: string | null;
    /** day-of-month (1-based) → status; missing day ⇒ no record (blank). */
    days: Record<number, MusterStatus>;
    present: number; // PRESENT + HALF_DAY + WFH days recorded
  }>;
}

/** Calendar year a given month sits in for an Indian FY (Apr-start). fy="2025-26". */
function calendarYearForFyMonth(fy: string, month: number): number | null {
  const start = Number(fy.split("-")[0]);
  if (!Number.isFinite(start) || month < 1 || month > 12) return null;
  // Apr(4)–Dec(12) belong to the FY start year; Jan(1)–Mar(3) to the next.
  return month >= 4 ? start : start + 1;
}

export async function getMonthlyRegister(input: { fy: string; month: number }): Promise<MonthlyRegister | null> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;

  const year = calendarYearForFyMonth(input.fy, input.month);
  if (year == null) return null;
  const month = input.month;

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0)); // last day of month, UTC-midnight
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
      select: { employeeId: true, date: true, status: true },
    }),
  ]);

  // employeeId → (day-of-month → status)
  const byEmp = new Map<string, Record<number, MusterStatus>>();
  for (const r of records) {
    const day = r.date.getUTCDate(); // @db.Date is UTC-midnight → read in UTC
    let m = byEmp.get(r.employeeId);
    if (!m) { m = {}; byEmp.set(r.employeeId, m); }
    m[day] = r.status as MusterStatus;
  }

  const rows = employees.map((e) => {
    const days = byEmp.get(e.id) ?? {};
    const present = Object.values(days).filter(
      (s) => s === "PRESENT" || s === "HALF_DAY" || s === "WFH",
    ).length;
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      empCode: e.empCode,
      department: e.department?.name ?? null,
      days,
      present,
    };
  });

  return { fy: input.fy, month, year, daysInMonth, rows };
}
