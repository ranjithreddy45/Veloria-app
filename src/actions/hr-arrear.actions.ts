"use server";

// ============================================================
// Salary Arrears — IO layer. An arrear is a one-off amount owed to an employee
// (a back-dated hike, a missed component, a correction) that is PAID by a
// specific payroll run. This module ONLY manages the arrear records — it does
// NOT compute PF / ESI / PT / tax. The payroll run reads a PENDING arrear for
// its pay month, applies the statutory maths per these flags, marks it PAID and
// stamps its runId. A PAID arrear is therefore locked here: it already lives in
// a payslip and cannot be edited or cancelled — the run must be reversed.
// Every write is gated on `hr:payroll` and audited to ActivityLog. All Decimal
// values are converted with Number() at the boundary — no float math on money.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

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

export interface ArrearListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode: string;
  name: string;
  amount: number;
  forFy: string | null;
  forMonth: number | null;
  payFy: string;
  payMonth: number;
  taxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  status: string;
  runId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ArrearEmployeeOption {
  id: string;
  empCode: string;
  name: string;
}

export interface ArrearInput {
  employeeId: string;
  name: string;
  amount: number;
  forFy?: string;
  forMonth?: number;
  payFy: string;
  payMonth: number;
  taxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  reason?: string;
}

// ---------- Validation ----------

/** Shared validation for create/update. Returns a normalized payload or an error. */
function validateArrear(input: ArrearInput):
  | {
      ok: true;
      value: {
        name: string;
        amount: number;
        forFy: string | null;
        forMonth: number | null;
        payFy: string;
        payMonth: number;
        taxable: boolean;
        pfApplicable: boolean;
        esiApplicable: boolean;
        ptApplicable: boolean;
        reason: string | null;
      };
    }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  const amount = Number(input.amount);
  const payFy = (input.payFy ?? "").trim();
  const payMonth = Number(input.payMonth);

  if (!name) return { ok: false, error: "Arrear name is required." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Arrear amount must be greater than zero." };
  }
  if (!payFy) return { ok: false, error: "Pay financial year is required." };
  if (!Number.isInteger(payMonth) || payMonth < 1 || payMonth > 12) {
    return { ok: false, error: "Pay month must be a month between 1 and 12." };
  }

  const forFy = (input.forFy ?? "").trim() || null;
  let forMonth: number | null = null;
  if (input.forMonth !== undefined && input.forMonth !== null) {
    const fm = Number(input.forMonth);
    if (!Number.isInteger(fm) || fm < 1 || fm > 12) {
      return { ok: false, error: "For-month must be a month between 1 and 12." };
    }
    forMonth = fm;
  }

  return {
    ok: true,
    value: {
      name,
      amount,
      forFy,
      forMonth,
      payFy,
      payMonth,
      taxable: Boolean(input.taxable),
      pfApplicable: Boolean(input.pfApplicable),
      esiApplicable: Boolean(input.esiApplicable),
      ptApplicable: Boolean(input.ptApplicable),
      reason: input.reason?.trim() || null,
    },
  };
}

// ---------- Reads ----------

/**
 * All arrears (optionally filtered by status / pay period), newest first.
 */
export async function listArrears(filter?: {
  status?: string;
  payFy?: string;
  payMonth?: number;
}): Promise<ArrearListRow[]> {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) return [];

  const where: Prisma.HrArrearWhereInput = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.payFy) where.payFy = filter.payFy;
  if (filter?.payMonth !== undefined) where.payMonth = filter.payMonth;

  const rows = await prisma.hrArrear.findMany({
    where,
    include: {
      employee: { select: { empCode: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: fullName(r.employee.firstName, r.employee.lastName),
    empCode: r.employee.empCode,
    name: r.name,
    amount: Number(r.amount),
    forFy: r.forFy,
    forMonth: r.forMonth,
    payFy: r.payFy,
    payMonth: r.payMonth,
    taxable: r.taxable,
    pfApplicable: r.pfApplicable,
    esiApplicable: r.esiApplicable,
    ptApplicable: r.ptApplicable,
    status: r.status,
    runId: r.runId,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Active, non-deleted employees for the "new arrear" picker. */
export async function listArrearEmployees(): Promise<ArrearEmployeeOption[]> {
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
 * Create a PENDING arrear. It is paid — with its statutory deductions — the
 * next time payroll is processed for its pay month.
 */
export async function createArrear(input: ArrearInput): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const v = validateArrear(input);
  if (!v.ok) return { success: false, error: v.error };

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const created = await prisma.hrArrear.create({
    data: {
      employeeId: emp.id,
      name: v.value.name,
      amount: v.value.amount,
      forFy: v.value.forFy,
      forMonth: v.value.forMonth,
      payFy: v.value.payFy,
      payMonth: v.value.payMonth,
      taxable: v.value.taxable,
      pfApplicable: v.value.pfApplicable,
      esiApplicable: v.value.esiApplicable,
      ptApplicable: v.value.ptApplicable,
      reason: v.value.reason,
      createdById: gate.userId,
    },
    select: { id: true },
  });

  await prisma.activityLog.create({
    data: {
      action: "ARREAR_CREATED",
      entityType: "EMPLOYEE",
      entityId: emp.id,
      userId: gate.userId,
      changes: {
        name: v.value.name,
        amount: v.value.amount,
        payFy: v.value.payFy,
        payMonth: v.value.payMonth,
        pfApplicable: v.value.pfApplicable,
        esiApplicable: v.value.esiApplicable,
      },
    },
  });

  revalidatePath("/people/payroll/arrears");
  return { success: true, data: { id: created.id } };
}

/**
 * Update a PENDING arrear. A PAID arrear is locked — it already sits in a
 * payslip — and is refused here; the run must be reversed to change it.
 */
export async function updateArrear(id: string, input: ArrearInput): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const existing = await prisma.hrArrear.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return { success: false, error: "Arrear not found." };
  if (existing.status !== "PENDING") {
    return {
      success: false,
      error:
        existing.status === "PAID"
          ? "This arrear has already been paid and is locked. Reverse the payroll run to change it."
          : "Only a pending arrear can be edited.",
    };
  }

  const v = validateArrear(input);
  if (!v.ok) return { success: false, error: v.error };

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  await prisma.hrArrear.update({
    where: { id },
    data: {
      employeeId: emp.id,
      name: v.value.name,
      amount: v.value.amount,
      forFy: v.value.forFy,
      forMonth: v.value.forMonth,
      payFy: v.value.payFy,
      payMonth: v.value.payMonth,
      taxable: v.value.taxable,
      pfApplicable: v.value.pfApplicable,
      esiApplicable: v.value.esiApplicable,
      ptApplicable: v.value.ptApplicable,
      reason: v.value.reason,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ARREAR_UPDATED",
      entityType: "EMPLOYEE",
      entityId: emp.id,
      userId: gate.userId,
      changes: {
        arrearId: id,
        name: v.value.name,
        amount: v.value.amount,
        payFy: v.value.payFy,
        payMonth: v.value.payMonth,
        pfApplicable: v.value.pfApplicable,
        esiApplicable: v.value.esiApplicable,
      },
    },
  });

  revalidatePath("/people/payroll/arrears");
  return { success: true, data: { id } };
}

/**
 * Cancel a PENDING arrear → CANCELLED. A PAID arrear cannot be cancelled here —
 * it is already in a payslip; the run must be reversed instead.
 */
export async function cancelArrear(id: string): Promise<Result<{ id: string }>> {
  const gate = await requirePayrollUser();
  if (!gate.ok) return { success: false, error: gate.error };

  const arr = await prisma.hrArrear.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, name: true, amount: true },
  });
  if (!arr) return { success: false, error: "Arrear not found." };
  if (arr.status !== "PENDING") {
    return {
      success: false,
      error:
        arr.status === "PAID"
          ? "This arrear has already been paid and cannot be cancelled here. Reverse the payroll run instead."
          : "Only a pending arrear can be cancelled.",
    };
  }

  await prisma.hrArrear.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await prisma.activityLog.create({
    data: {
      action: "ARREAR_CANCELLED",
      entityType: "EMPLOYEE",
      entityId: arr.employeeId,
      userId: gate.userId,
      changes: {
        arrearId: arr.id,
        name: arr.name,
        amount: Number(arr.amount),
      },
    },
  });

  revalidatePath("/people/payroll/arrears");
  return { success: true, data: { id: arr.id } };
}
