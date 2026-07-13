"use server";

// ============================================================
// Per-employee RECURRING pay — IO layer. Each row is a standing EARNING or
// DEDUCTION that the payroll run picks up while `active` and within its
// [startFy/startMonth .. endFy/endMonth] window. This module only manages the
// rows; the payroll run consumes them. Every write is gated on `hr:payroll` and
// audited to ActivityLog. Decimal money crosses the boundary via Number() out /
// new Prisma.Decimal() in — no float math is stored.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { Prisma, HrPayComponentKind } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENTITY_ID = "BILLION";
const FY_RE = /^\d{4}-\d{2}$/;

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

// ---------- Types (interfaces are fine to export from a "use server" file) ----------

export interface RecurringListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode: string;
  kind: HrPayComponentKind;
  code: string;
  name: string;
  amount: number;
  taxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  startFy: string;
  startMonth: number;
  endFy: string | null;
  endMonth: number | null;
  active: boolean;
  note: string | null;
  createdAt: string;
}

export interface RecurringEmployeeOption {
  id: string;
  empCode: string;
  name: string;
}

// ---------- Reads ----------

/**
 * All recurring pay rows (optionally filtered by employee), newest first.
 * HrRecurringPay has no employee relation, so the employee's name/empCode are
 * joined in memory from a separate query.
 */
export async function listRecurring(employeeId?: string): Promise<RecurringListRow[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) return [];

  const where: Prisma.HrRecurringPayWhereInput = { entityId: ENTITY_ID };
  if (employeeId) where.employeeId = employeeId;

  const rows = await prisma.hrRecurringPay.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (rows.length === 0) return [];

  const empIds = Array.from(new Set(rows.map((r) => r.employeeId)));
  const employees = await prisma.employee.findMany({
    where: { id: { in: empIds } },
    select: { id: true, empCode: true, firstName: true, lastName: true },
  });
  const empById = new Map(employees.map((e) => [e.id, e]));

  return rows.map((r) => {
    const e = empById.get(r.employeeId);
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: e ? fullName(e.firstName, e.lastName) : "Unknown employee",
      empCode: e?.empCode ?? "—",
      kind: r.kind,
      code: r.code,
      name: r.name,
      amount: Number(r.amount),
      taxable: r.taxable,
      pfApplicable: r.pfApplicable,
      esiApplicable: r.esiApplicable,
      ptApplicable: r.ptApplicable,
      startFy: r.startFy,
      startMonth: r.startMonth,
      endFy: r.endFy,
      endMonth: r.endMonth,
      active: r.active,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Active, non-deleted employees for the "new recurring" picker. */
export async function listRecurringEmployees(): Promise<RecurringEmployeeOption[]> {
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
 * Create a recurring pay component for an employee. Applicability flags
 * (pf/esi/pt) are only meaningful for EARNINGs and are forced off for
 * DEDUCTIONs. Amount must be positive; start FY/month are validated.
 */
export async function createRecurring(input: {
  employeeId: string;
  kind: HrPayComponentKind;
  code: string;
  name: string;
  amount: number;
  taxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  startFy: string;
  startMonth: number;
  endFy?: string;
  endMonth?: number;
  note?: string;
}): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const amount = Number(input.amount);
  const startMonth = Number(input.startMonth);
  const startFy = (input.startFy ?? "").trim();
  const code = (input.code ?? "").trim();
  const name = (input.name ?? "").trim();

  if (input.kind !== "EARNING" && input.kind !== "DEDUCTION") {
    return { success: false, error: "Kind must be an earning or a deduction." };
  }
  if (!code) return { success: false, error: "Component code is required." };
  if (!name) return { success: false, error: "Component name is required." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }
  if (!FY_RE.test(startFy)) {
    return { success: false, error: "Start financial year must look like 2026-27." };
  }
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    return { success: false, error: "Start month must be a month between 1 and 12." };
  }

  const hasEndFy = input.endFy != null && input.endFy.trim() !== "";
  const endFy = hasEndFy ? input.endFy!.trim() : null;
  const endMonth =
    input.endMonth != null && String(input.endMonth) !== "" ? Number(input.endMonth) : null;

  if (endFy !== null && !FY_RE.test(endFy)) {
    return { success: false, error: "End financial year must look like 2027-28." };
  }
  if (endMonth !== null && (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12)) {
    return { success: false, error: "End month must be a month between 1 and 12." };
  }
  if ((endFy === null) !== (endMonth === null)) {
    return { success: false, error: "Provide both an end FY and an end month, or neither." };
  }

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const isEarning = input.kind === "EARNING";
  const pfApplicable = isEarning ? !!input.pfApplicable : false;
  const esiApplicable = isEarning ? !!input.esiApplicable : false;
  const ptApplicable = isEarning ? !!input.ptApplicable : false;

  let createdId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.hrRecurringPay.create({
        data: {
          entityId: ENTITY_ID,
          employeeId: emp.id,
          kind: input.kind,
          code,
          name,
          amount: new Prisma.Decimal(amount),
          taxable: !!input.taxable,
          pfApplicable,
          esiApplicable,
          ptApplicable,
          startFy,
          startMonth,
          endFy,
          endMonth,
          note: input.note?.trim() || null,
          createdById: gate.userId,
        },
        select: { id: true },
      });
      await tx.activityLog.create({
        data: {
          action: "RECURRING_PAY_CREATED",
          entityType: "EMPLOYEE",
          entityId: emp.id,
          userId: gate.userId,
          changes: {
            recurringId: row.id,
            kind: input.kind,
            code,
            name,
            amount,
            startFy,
            startMonth,
            endFy,
            endMonth,
            empCode: emp.empCode,
            employee: fullName(emp.firstName, emp.lastName),
          },
        },
      });
      return row;
    });
    createdId = created.id;
  } catch {
    return { success: false, error: "Could not create the recurring pay component." };
  }

  revalidatePath("/people/payroll/recurring");
  return { success: true, data: { id: createdId } };
}

/** Close a recurring component at a given FY/month. It stops applying after that. */
export async function endRecurring(
  id: string,
  input: { endFy: string; endMonth: number },
): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const endFy = (input.endFy ?? "").trim();
  const endMonth = Number(input.endMonth);
  if (!FY_RE.test(endFy)) {
    return { success: false, error: "End financial year must look like 2027-28." };
  }
  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) {
    return { success: false, error: "End month must be a month between 1 and 12." };
  }

  const row = await prisma.hrRecurringPay.findFirst({
    where: { id, entityId: ENTITY_ID },
    select: { id: true, employeeId: true },
  });
  if (!row) return { success: false, error: "Recurring component not found." };

  await prisma.hrRecurringPay.update({
    where: { id },
    data: { endFy, endMonth },
  });

  await prisma.activityLog.create({
    data: {
      action: "RECURRING_PAY_ENDED",
      entityType: "EMPLOYEE",
      entityId: row.employeeId,
      userId: gate.userId,
      changes: { recurringId: row.id, endFy, endMonth },
    },
  });

  revalidatePath("/people/payroll/recurring");
  return { success: true, data: { id: row.id } };
}

/** Toggle a recurring component on/off. Inactive rows are skipped by payroll. */
export async function toggleRecurring(id: string): Promise<Result<{ id: string; active: boolean }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const row = await prisma.hrRecurringPay.findFirst({
    where: { id, entityId: ENTITY_ID },
    select: { id: true, active: true, employeeId: true },
  });
  if (!row) return { success: false, error: "Recurring component not found." };

  const nextActive = !row.active;
  await prisma.hrRecurringPay.update({
    where: { id },
    data: { active: nextActive },
  });

  await prisma.activityLog.create({
    data: {
      action: nextActive ? "RECURRING_PAY_ACTIVATED" : "RECURRING_PAY_DEACTIVATED",
      entityType: "EMPLOYEE",
      entityId: row.employeeId,
      userId: gate.userId,
      changes: { recurringId: row.id, active: nextActive },
    },
  });

  revalidatePath("/people/payroll/recurring");
  return { success: true, data: { id: row.id, active: nextActive } };
}

/** Permanently delete a recurring component. */
export async function deleteRecurring(id: string): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const row = await prisma.hrRecurringPay.findFirst({
    where: { id, entityId: ENTITY_ID },
    select: { id: true, employeeId: true, kind: true, code: true, name: true, amount: true },
  });
  if (!row) return { success: false, error: "Recurring component not found." };

  await prisma.$transaction(async (tx) => {
    await tx.hrRecurringPay.delete({ where: { id } });
    await tx.activityLog.create({
      data: {
        action: "RECURRING_PAY_DELETED",
        entityType: "EMPLOYEE",
        entityId: row.employeeId,
        userId: gate.userId,
        changes: {
          recurringId: row.id,
          kind: row.kind,
          code: row.code,
          name: row.name,
          amount: Number(row.amount),
        },
      },
    });
  });

  revalidatePath("/people/payroll/recurring");
  return { success: true, data: { id: row.id } };
}
