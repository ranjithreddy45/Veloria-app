"use server";

// ============================================================
// Leave Reports — READ-ONLY server actions.
// No mutations, no schema changes. Every export is an async function
// (Server Action constraint). Each report gates on `hr:read`, excludes
// soft-deleted employees, and returns fully serialisable rows.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { round2 } from "@/app/(dashboard)/people/reports/leave/_lib/types";
import type {
  LeaveTypeLite,
  BalanceRow,
  AvailedRow,
  AllotmentRow,
  LapsedRow,
  SummaryRow,
} from "@/app/(dashboard)/people/reports/leave/_lib/types";

/** Read guard — throws if the caller lacks hr:read. Pages redirect before this,
 *  but the action guards independently (defence in depth). */
async function guardRead(): Promise<void> {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) {
    throw new Error("Not authorised to read HR leave reports.");
  }
}

/** Active (non-deleted) employees only. Reused by every report. */
const EMP_ACTIVE = { deletedAt: null } as const;

function empName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

/** Leave types (active + inactive) for filter dropdowns. */
export async function getLeaveTypesForReport(): Promise<LeaveTypeLite[]> {
  await guardRead();
  const types = await prisma.leaveType.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      paid: true,
      accrualPerYear: true,
      carryForwardMax: true,
      color: true,
    },
  });
  return types;
}

/** Distinct years that have leave data, newest first. Always includes the
 *  current UTC year so the selector is never empty. */
export async function getReportYears(): Promise<number[]> {
  await guardRead();
  const rows = await prisma.leaveBalance.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });
  const years = new Set<number>(rows.map((r) => r.year));
  years.add(new Date().getUTCFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

/** 1) BALANCE — per employee × leave type for a year.
 *  available = entitled + carriedForward − used − pending (computed here). */
export async function getBalanceReport(
  year: number,
  leaveTypeId?: string,
): Promise<BalanceRow[]> {
  await guardRead();
  const balances = await prisma.leaveBalance.findMany({
    where: {
      year,
      ...(leaveTypeId ? { leaveTypeId } : {}),
      employee: EMP_ACTIVE,
    },
    select: {
      entitled: true,
      carriedForward: true,
      used: true,
      pending: true,
      employeeId: true,
      leaveTypeId: true,
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      leaveType: { select: { name: true, code: true, color: true } },
    },
  });
  const rows: BalanceRow[] = balances.map((b) => {
    const available = b.entitled + b.carriedForward - b.used - b.pending;
    return {
      employeeId: b.employeeId,
      empCode: b.employee.empCode,
      name: empName(b.employee),
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveType.name,
      leaveTypeCode: b.leaveType.code,
      color: b.leaveType.color,
      entitled: round2(b.entitled),
      carriedForward: round2(b.carriedForward),
      used: round2(b.used),
      pending: round2(b.pending),
      available: round2(available),
    };
  });
  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.leaveTypeCode.localeCompare(b.leaveTypeCode),
  );
  return rows;
}

/** 2) AVAILED — APPROVED leave requests overlapping [fromIso, toIso].
 *  Overlap rule: startDate <= to AND endDate >= from. Dates are UTC-midnight. */
export async function getAvailedReport(
  fromIso: string,
  toIso: string,
): Promise<AvailedRow[]> {
  await guardRead();
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: to },
      endDate: { gte: from },
      employee: EMP_ACTIVE,
    },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      days: true,
      status: true,
      createdAt: true,
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      leaveType: { select: { name: true, code: true, color: true } },
    },
  });
  return requests.map((r) => ({
    id: r.id,
    empCode: r.employee.empCode,
    name: empName(r.employee),
    leaveTypeName: r.leaveType.name,
    leaveTypeCode: r.leaveType.code,
    color: r.leaveType.color,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    days: round2(r.days),
    status: r.status,
    appliedOn: r.createdAt.toISOString(),
  }));
}

/** 3) ALLOTMENT — what was granted (entitled + carriedForward) per emp × type. */
export async function getAllotmentReport(year: number): Promise<AllotmentRow[]> {
  await guardRead();
  const balances = await prisma.leaveBalance.findMany({
    where: { year, employee: EMP_ACTIVE },
    select: {
      entitled: true,
      carriedForward: true,
      employeeId: true,
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      leaveType: { select: { name: true, code: true, color: true } },
    },
  });
  const rows: AllotmentRow[] = balances.map((b) => ({
    employeeId: b.employeeId,
    empCode: b.employee.empCode,
    name: empName(b.employee),
    leaveTypeName: b.leaveType.name,
    leaveTypeCode: b.leaveType.code,
    color: b.leaveType.color,
    entitled: round2(b.entitled),
    carriedForward: round2(b.carriedForward),
    allotted: round2(b.entitled + b.carriedForward),
  }));
  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.leaveTypeCode.localeCompare(b.leaveTypeCode),
  );
  return rows;
}

/** 4) LAPSED — PROJECTED lapse at year-end (year-end rollover is not modelled
 *  in the schema, so this is a forward-looking projection, not a booked lapse).
 *  projectedLapse = max(0, available − carryForwardMax). Only rows with a
 *  positive projected lapse are returned. */
export async function getLapsedReport(year: number): Promise<LapsedRow[]> {
  await guardRead();
  const balances = await prisma.leaveBalance.findMany({
    where: { year, employee: EMP_ACTIVE },
    select: {
      entitled: true,
      carriedForward: true,
      used: true,
      pending: true,
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      leaveType: {
        select: { name: true, code: true, color: true, carryForwardMax: true },
      },
    },
  });
  const rows: LapsedRow[] = [];
  for (const b of balances) {
    const available = b.entitled + b.carriedForward - b.used - b.pending;
    const cfMax = b.leaveType.carryForwardMax;
    const projectedLapse = Math.max(0, available - cfMax);
    if (projectedLapse <= 0) continue;
    rows.push({
      empCode: b.employee.empCode,
      name: empName(b.employee),
      leaveTypeName: b.leaveType.name,
      leaveTypeCode: b.leaveType.code,
      color: b.leaveType.color,
      available: round2(available),
      carryForwardMax: round2(cfMax),
      projectedLapse: round2(projectedLapse),
    });
  }
  rows.sort(
    (a, b) =>
      b.projectedLapse - a.projectedLapse || a.name.localeCompare(b.name),
  );
  return rows;
}

/** 5) SUMMARY — org-wide totals per leave type for a year.
 *  utilisation % = totalUsed / (totalEntitled + totalCarried) × 100. */
export async function getSummaryReport(year: number): Promise<SummaryRow[]> {
  await guardRead();
  const [types, balances] = await Promise.all([
    prisma.leaveType.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, color: true, paid: true },
    }),
    prisma.leaveBalance.groupBy({
      by: ["leaveTypeId"],
      where: { year, employee: EMP_ACTIVE },
      _sum: {
        entitled: true,
        carriedForward: true,
        used: true,
        pending: true,
      },
    }),
  ]);
  const byType = new Map(balances.map((g) => [g.leaveTypeId, g._sum]));
  const rows: SummaryRow[] = types.map((t) => {
    const s = byType.get(t.id);
    const totalEntitled = s?.entitled ?? 0;
    const totalCarried = s?.carriedForward ?? 0;
    const totalUsed = s?.used ?? 0;
    const totalPending = s?.pending ?? 0;
    const totalAllotted = totalEntitled + totalCarried;
    const utilisationPct =
      totalAllotted > 0 ? (totalUsed / totalAllotted) * 100 : 0;
    return {
      leaveTypeId: t.id,
      name: t.name,
      code: t.code,
      color: t.color,
      paid: t.paid,
      totalEntitled: round2(totalEntitled),
      totalCarried: round2(totalCarried),
      totalUsed: round2(totalUsed),
      totalPending: round2(totalPending),
      totalAllotted: round2(totalAllotted),
      utilisationPct: round2(utilisationPct),
    };
  });
  return rows;
}
