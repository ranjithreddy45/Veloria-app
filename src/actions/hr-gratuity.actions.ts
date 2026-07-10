"use server";

// ============================================================
// Gratuity module — IO layer. All gratuity MATH is delegated to the single
// source of truth, `gratuityPayout(...)` in @/lib/hr/payroll-calc — this file
// never re-derives the formula. Guarded by hr:read (reads) / hr:payroll (write).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import {
  gratuityPayout,
  completedYearsBetween,
  DEFAULT_STAT_CONFIG,
  type StructureLine,
} from "@/lib/hr/payroll-calc";
import type {
  GratuityRow,
  RecordGratuityInput,
  GratuitySettlementLog,
} from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// The statutory config that carries gratuityDaysPerYear (15), gratuityMonthDivisor
// (26) and gratuityMinYears (5 = eligibility). Single source for the whole module.
const CFG = DEFAULT_STAT_CONFIG;

/**
 * The gratuity ledger / report dataset: every non-soft-deleted employee with
 * years of service (UTC), eligibility, last drawn basic, projected payout (via
 * gratuityPayout) and the total already ACCRUED across their payslips.
 *
 * Employees with no current salary structure get `lastBasic = projectedPayout =
 * null` — the UI renders "—" and excludes them from the payable total. They are
 * NOT collapsed to ₹0 (that would understate the liability and mislead).
 */
export async function getGratuityLedger(): Promise<GratuityRow[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) return [];

  const [employees, structures, accruals] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        empCode: true,
        firstName: true,
        lastName: true,
        dateOfJoining: true,
        status: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.hrSalaryStructure.findMany({
      where: { isCurrent: true },
      orderBy: { effectiveFrom: "desc" },
      select: { employeeId: true, lines: true },
    }),
    prisma.hrPayslip.groupBy({
      by: ["employeeId"],
      _sum: { gratuityAccrued: true },
    }),
  ]);

  // Last drawn BASIC per employee, from the newest CURRENT structure. There can
  // be more than one row flagged current historically, so the first (newest
  // effectiveFrom, thanks to orderBy) wins and later duplicates are ignored.
  const basicByEmp = new Map<string, number>();
  for (const s of structures) {
    if (basicByEmp.has(s.employeeId)) continue;
    const lines = (s.lines as unknown as StructureLine[]) || [];
    const basic = Number(lines.find((l) => l.code === "BASIC")?.monthly ?? 0);
    basicByEmp.set(s.employeeId, basic);
  }

  const accruedByEmp = new Map<string, number>();
  for (const a of accruals) {
    // Prisma Decimal → number only at the boundary; never float-math the Decimal.
    accruedByEmp.set(a.employeeId, Number(a._sum?.gratuityAccrued ?? 0));
  }

  const now = new Date();
  return employees.map((e) => {
    // Years of service in UTC: completedYearsBetween uses absolute epoch-ms diff,
    // so a @db.Date DOJ (UTC midnight) can't flip a tenure by local timezone.
    const years = e.dateOfJoining ? completedYearsBetween(e.dateOfJoining, now) : 0;
    const eligible = !!e.dateOfJoining && years >= CFG.gratuityMinYears;
    const hasStructure = basicByEmp.has(e.id);
    const lastBasic = hasStructure ? (basicByEmp.get(e.id) as number) : null;
    // REUSE the shared calculator — no second formula lives here.
    const projectedPayout = lastBasic == null ? null : gratuityPayout(lastBasic, years, CFG);

    return {
      id: e.id,
      empCode: e.empCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      status: e.status as string,
      doj: e.dateOfJoining ? e.dateOfJoining.toISOString().slice(0, 10) : null,
      yearsOfService: Math.round(years * 100) / 100,
      eligible,
      lastBasic,
      projectedPayout,
      accruedToDate: accruedByEmp.get(e.id) ?? 0,
    };
  });
}

/**
 * Recent manual gratuity settlements. These are reconstructed from ActivityLog
 * entries (there is no dedicated table yet — see recordGratuitySettlement).
 */
export async function getRecentGratuitySettlements(): Promise<GratuitySettlementLog[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) return [];

  const logs = await prisma.activityLog.findMany({
    where: { action: "GRATUITY_RECORDED", entityType: "EMPLOYEE" },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return logs.map((l) => {
    const c = (l.changes ?? {}) as Record<string, unknown>;
    return {
      id: l.id,
      employeeId: l.entityId,
      empCode: String(c.empCode ?? ""),
      name: String(c.name ?? ""),
      amount: Number(c.amount ?? 0),
      settlementDate: String(c.settlementDate ?? ""),
      note: c.note ? String(c.note) : null,
      recordedAt: l.createdAt.toISOString(),
    };
  });
}

/**
 * Record a manual gratuity settlement / override for one employee.
 *
 * SCHEMA NOTE (follow-up): this module may not alter prisma/schema.prisma, and
 * there is deliberately no `GratuityPayment` model yet. So the settlement is
 * persisted as an ActivityLog audit entry (action "GRATUITY_RECORDED") — NOT
 * silently pretended into a ledger table. A dedicated GratuityPayment model
 * (employeeId, amount, settlementDate, note, status, GL posting) is the intended
 * next step to turn this into a real, queryable, postable ledger.
 */
export async function recordGratuitySettlement(
  input: RecordGratuityInput,
): Promise<Result<{ id: string }>> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { success: false, error: "Not signed in." };
  if (!hasPermission(user.role ?? "", "hr:payroll")) {
    return { success: false, error: "Not authorized." };
  }

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { success: false, error: "Enter a valid settlement amount." };
  }
  if (!input.settlementDate) {
    return { success: false, error: "Settlement date is required." };
  }
  const settlementDate = new Date(`${input.settlementDate}T00:00:00.000Z`);
  if (Number.isNaN(settlementDate.getTime())) {
    return { success: false, error: "Invalid settlement date." };
  }

  const log = await prisma.activityLog.create({
    data: {
      action: "GRATUITY_RECORDED",
      entityType: "EMPLOYEE",
      entityId: emp.id,
      userId: user.id,
      changes: {
        amount,
        settlementDate: input.settlementDate,
        note: input.note?.trim() || null,
        empCode: emp.empCode,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
      },
    },
  });

  revalidatePath("/people/gratuity");
  revalidatePath("/people/gratuity/report");
  revalidatePath("/people/gratuity/add");
  return { success: true, data: { id: log.id } };
}
