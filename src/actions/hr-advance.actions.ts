"use server";

// ============================================================
// Salary Advance — IO layer. An employee may hold AT MOST ONE ACTIVE advance.
// Outstanding balance is ALWAYS computed as (amount - recovered) — it is never
// stored. Recovery rows are written by the payroll run, NOT by this module.
// Every write is gated on `hr:payroll` and audited to ActivityLog. All Decimal
// values are converted with Number() at the boundary — no float math on money.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requirePayrollUser(): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, error: "Not signed in." };
  if (!hasPermission(user.role ?? "", "hr:payroll")) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true, userId: user.id, role: user.role ?? "" };
}

function fullName(first: string, last: string | null): string {
  return `${first} ${last ?? ""}`.trim();
}

// ---------- Types (plain, not exported through the "use server" runtime) ----------

export interface AdvanceListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode: string;
  amount: number;
  monthlyInstallment: number;
  recovered: number;
  outstanding: number;
  status: string;
  startFy: string;
  startMonth: number;
  reason: string | null;
  recoveryCount: number;
  createdAt: string;
}

export interface AdvanceRecoveryRow {
  id: string;
  runId: string;
  amount: number;
  createdAt: string;
}

export interface AdvanceDetail extends AdvanceListRow {
  recoveries: AdvanceRecoveryRow[];
}

export interface AdvanceEmployeeOption {
  id: string;
  empCode: string;
  name: string;
}

// ---------- Reads ----------

/**
 * All advances (optionally filtered by employee / status), newest first.
 * Outstanding is computed here — never read from a stored column.
 */
export async function listAdvances(filter?: {
  employeeId?: string;
  status?: string;
}): Promise<AdvanceListRow[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) return [];

  const where: Prisma.HrAdvanceWhereInput = {};
  if (filter?.employeeId) where.employeeId = filter.employeeId;
  if (filter?.status) where.status = filter.status;

  const rows = await prisma.hrAdvance.findMany({
    where,
    include: {
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      _count: { select: { recoveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => {
    const amount = Number(r.amount);
    const recovered = Number(r.recovered);
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: fullName(r.employee.firstName, r.employee.lastName),
      empCode: r.employee.empCode,
      amount,
      monthlyInstallment: Number(r.monthlyInstallment),
      recovered,
      outstanding: amount - recovered,
      status: r.status,
      startFy: r.startFy,
      startMonth: r.startMonth,
      reason: r.reason,
      recoveryCount: r._count.recoveries,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** A single advance plus its full recovery history, newest first. */
export async function getAdvanceDetail(id: string): Promise<AdvanceDetail | null> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) return null;

  const r = await prisma.hrAdvance.findUnique({
    where: { id },
    include: {
      employee: { select: { empCode: true, firstName: true, lastName: true } },
      _count: { select: { recoveries: true } },
      recoveries: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!r) return null;

  const amount = Number(r.amount);
  const recovered = Number(r.recovered);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: fullName(r.employee.firstName, r.employee.lastName),
    empCode: r.employee.empCode,
    amount,
    monthlyInstallment: Number(r.monthlyInstallment),
    recovered,
    outstanding: amount - recovered,
    status: r.status,
    startFy: r.startFy,
    startMonth: r.startMonth,
    reason: r.reason,
    recoveryCount: r._count.recoveries,
    createdAt: r.createdAt.toISOString(),
    recoveries: r.recoveries.map((rec) => ({
      id: rec.id,
      runId: rec.runId,
      amount: Number(rec.amount),
      createdAt: rec.createdAt.toISOString(),
    })),
  };
}

/** Active, non-deleted employees for the "new advance" picker. */
export async function listAdvanceEmployees(): Promise<AdvanceEmployeeOption[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) return [];

  const rows = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((e) => ({
    id: e.id,
    empCode: e.empCode,
    name: fullName(e.firstName, e.lastName),
  }));
}

// ---------- Writes ----------

/**
 * Create a salary advance. An employee may hold at most ONE ACTIVE advance —
 * a second is rejected with a clear error. Recovery is applied later by the
 * payroll run.
 */
export async function createAdvance(input: {
  employeeId: string;
  amount: number;
  monthlyInstallment: number;
  startFy: string;
  startMonth: number;
  reason?: string;
}): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const amount = Number(input.amount);
  const monthlyInstallment = Number(input.monthlyInstallment);
  const startMonth = Number(input.startMonth);
  const startFy = (input.startFy ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Advance amount must be greater than zero." };
  }
  if (!Number.isFinite(monthlyInstallment) || monthlyInstallment <= 0) {
    return { success: false, error: "Monthly instalment must be greater than zero." };
  }
  if (monthlyInstallment > amount) {
    return { success: false, error: "Monthly instalment cannot exceed the advance amount." };
  }
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    return { success: false, error: "Start month must be a month between 1 and 12." };
  }
  if (!startFy) {
    return { success: false, error: "Start financial year is required." };
  }

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  // The "at most one ACTIVE advance" invariant is load-bearing for the payroll
  // recovery run. Check-and-create must be ATOMIC: a plain findFirst-then-create
  // is a TOCTOU that a double-submit (or two payroll users) can slip a second
  // ACTIVE advance through. Serializable makes the concurrent create abort rather
  // than duplicate. (No DB partial-unique index — hard constraints are deferred
  // until prod data is cleaned, per project policy.)
  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.hrAdvance.findFirst({
        where: { employeeId: emp.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (existingActive) throw new Error("ALREADY_ACTIVE");

      const adv = await tx.hrAdvance.create({
        data: {
          employeeId: emp.id,
          amount,
          monthlyInstallment,
          startFy,
          startMonth,
          reason: input.reason?.trim() || null,
          createdById: gate.userId,
        },
        select: { id: true },
      });
      await tx.activityLog.create({
        data: {
          action: "ADVANCE_CREATED",
          entityType: "EMPLOYEE",
          entityId: emp.id,
          userId: gate.userId,
          changes: {
            advanceId: adv.id,
            amount,
            monthlyInstallment,
            startFy,
            startMonth,
            empCode: emp.empCode,
            name: fullName(emp.firstName, emp.lastName),
          },
        },
      });
      return adv;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_ACTIVE")
      return { success: false, error: "This employee already holds an active advance. Close or cancel it before creating another." };
    return { success: false, error: "Could not create the advance." };
  }

  revalidatePath("/people/payroll/advances");
  return { success: true, data: { id: created.id } };
}

/** Cancel an ACTIVE advance. Recoveries already taken are preserved. */
export async function cancelAdvance(id: string, reason?: string): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const adv = await prisma.hrAdvance.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, recovered: true, amount: true },
  });
  if (!adv) return { success: false, error: "Advance not found." };
  if (adv.status !== "ACTIVE") {
    return { success: false, error: "Only an active advance can be cancelled." };
  }

  await prisma.hrAdvance.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await prisma.activityLog.create({
    data: {
      action: "ADVANCE_CANCELLED",
      entityType: "EMPLOYEE",
      entityId: adv.employeeId,
      userId: gate.userId,
      changes: {
        advanceId: adv.id,
        reason: reason?.trim() || null,
        recoveredAtCancel: Number(adv.recovered),
        amount: Number(adv.amount),
      },
    },
  });

  revalidatePath("/people/payroll/advances");
  return { success: true, data: { id: adv.id } };
}

/** Close a fully-recovered advance (outstanding <= 0). */
export async function closeAdvance(id: string): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const adv = await prisma.hrAdvance.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, amount: true, recovered: true },
  });
  if (!adv) return { success: false, error: "Advance not found." };
  if (adv.status !== "ACTIVE") {
    return { success: false, error: "Only an active advance can be closed." };
  }

  const outstanding = Number(adv.amount) - Number(adv.recovered);
  if (outstanding > 0) {
    return {
      success: false,
      error: "This advance still has an outstanding balance and cannot be closed yet.",
    };
  }

  await prisma.hrAdvance.update({
    where: { id },
    data: { status: "CLOSED" },
  });

  await prisma.activityLog.create({
    data: {
      action: "ADVANCE_CLOSED",
      entityType: "EMPLOYEE",
      entityId: adv.employeeId,
      userId: gate.userId,
      changes: {
        advanceId: adv.id,
        amount: Number(adv.amount),
        recovered: Number(adv.recovered),
      },
    },
  });

  revalidatePath("/people/payroll/advances");
  return { success: true, data: { id: adv.id } };
}
