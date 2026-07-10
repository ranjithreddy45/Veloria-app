"use server";

// ============================================================
// Salary Hold / Release + Bank Advice (disbursement) reads
// ------------------------------------------------------------
// Spec: Salary Process > "Salary On Hold". A HELD payslip is still fully
// computed and visible — it is simply EXCLUDED from bank disbursement until it
// is released. Holding never alters any computed figure (net/gross/etc.); it
// only toggles the onHold flag + audit fields on HrPayslip.
//
// Every write is gated `hr:payroll` and audited to ActivityLog.
// Money is Prisma Decimal — always Number() at the boundary, never float-math a
// Decimal in place.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { decryptField, maskAccount } from "@/lib/hr/crypto";

const ENTITY_ID = "BILLION";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function gate(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, error: "Not signed in." };
  if (!hasPermission(user.role ?? "", "hr:payroll"))
    return { ok: false, error: "You don’t have permission to manage payroll." };
  return { ok: true, userId: user.id };
}

// ============================================================
// Hold
// ============================================================
export async function holdSalary(payslipId: string, reason: string): Promise<Result<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return { success: false, error: g.error };

  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { success: false, error: "A reason is required to hold a salary." };

  const slip = await prisma.hrPayslip.findUnique({
    where: { id: payslipId },
    select: { id: true, onHold: true, run: { select: { status: true, fy: true, month: true } } },
  });
  if (!slip) return { success: false, error: "Payslip not found." };

  // Once the run is PAID the money has already gone out — holding is meaningless
  // and would misrepresent reality. Refuse it explicitly.
  if (slip.run.status === "PAID")
    return { success: false, error: "This run is already marked paid — salaries have been disbursed and can no longer be held." };

  if (slip.onHold) return { success: false, error: "This salary is already on hold." };

  await prisma.hrPayslip.update({
    where: { id: payslipId },
    data: {
      onHold: true,
      holdReason: trimmed,
      heldById: g.userId,
      heldAt: new Date(),
      // A fresh hold supersedes any prior release marker.
      releasedById: null,
      releasedAt: null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "SALARY_HELD",
      entityType: "PAYSLIP",
      entityId: payslipId,
      userId: g.userId,
      changes: { reason: trimmed },
    },
  });

  revalidatePath("/people/payroll/disbursement");
  return { success: true, data: { id: payslipId } };
}

// ============================================================
// Release
// ============================================================
export async function releaseSalary(payslipId: string, note?: string): Promise<Result<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return { success: false, error: g.error };

  const slip = await prisma.hrPayslip.findUnique({
    where: { id: payslipId },
    select: { id: true, onHold: true },
  });
  if (!slip) return { success: false, error: "Payslip not found." };
  if (!slip.onHold) return { success: false, error: "This salary is not on hold." };

  await prisma.hrPayslip.update({
    where: { id: payslipId },
    data: {
      onHold: false,
      releasedById: g.userId,
      releasedAt: new Date(),
      // KEEP holdReason for the audit trail — we clear the flag, not the history.
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "SALARY_RELEASED",
      entityType: "PAYSLIP",
      entityId: payslipId,
      userId: g.userId,
      changes: note?.trim() ? { note: note.trim() } : {},
    },
  });

  revalidatePath("/people/payroll/disbursement");
  return { success: true, data: { id: payslipId } };
}

// ============================================================
// Disbursement read (bank advice source)
// ============================================================
export interface DisbursementRow {
  payslipId: string;
  employeeId: string;
  empCode: string;
  name: string;
  net: number;
  onHold: boolean;
  holdReason: string | null;
  /** Masked account number for display + bank advice.
   * Bank details are stored ENCRYPTED at rest (EmployeeStatutory.bankAccountEnc);
   * per policy we do NOT surface the plaintext account here — we render what the
   * masking helper returns (last 4 digits). IFSC is stored plain. */
  bankAccountMasked: string | null;
  bankIfsc: string | null;
}

export interface DisbursementView {
  fy: string;
  month: number;
  runExists: boolean;
  runStatus: string | null;
  runLabel: string | null;
  rows: DisbursementRow[];
  payableCount: number;
  payableTotal: number;
  heldCount: number;
  heldTotal: number;
}

export async function getDisbursement({ fy, month }: { fy: string; month: number }): Promise<DisbursementView> {
  const empty: DisbursementView = {
    fy,
    month,
    runExists: false,
    runStatus: null,
    runLabel: null,
    rows: [],
    payableCount: 0,
    payableTotal: 0,
    heldCount: 0,
    heldTotal: 0,
  };

  const g = await gate();
  if (!g.ok) return empty;

  const run = await prisma.hrPayrollRun.findUnique({
    where: { entityId_fy_month: { entityId: ENTITY_ID, fy, month } },
    select: {
      id: true,
      status: true,
      label: true,
      payslips: {
        orderBy: { nameSnap: "asc" },
        select: {
          id: true,
          employeeId: true,
          empCodeSnap: true,
          nameSnap: true,
          net: true,
          onHold: true,
          holdReason: true,
        },
      },
    },
  });
  if (!run) return empty;

  // Bank details live on EmployeeStatutory (account encrypted, IFSC plain).
  const empIds = run.payslips.map((p) => p.employeeId);
  const statutory = empIds.length
    ? await prisma.employeeStatutory.findMany({
        where: { employeeId: { in: empIds } },
        select: { employeeId: true, bankAccountEnc: true, bankIfsc: true },
      })
    : [];
  const bankByEmp = new Map(statutory.map((s) => [s.employeeId, s]));

  const rows: DisbursementRow[] = run.payslips.map((p) => {
    const bank = bankByEmp.get(p.employeeId);
    return {
      payslipId: p.id,
      employeeId: p.employeeId,
      empCode: p.empCodeSnap,
      name: p.nameSnap,
      net: Number(p.net),
      onHold: p.onHold,
      holdReason: p.holdReason,
      bankAccountMasked: maskAccount(decryptField(bank?.bankAccountEnc)),
      bankIfsc: bank?.bankIfsc ?? null,
    };
  });

  // Payable = NOT on hold. The whole point of the feature is that held salaries
  // are excluded from the amount that goes to the bank.
  const payable = rows.filter((r) => !r.onHold);
  const held = rows.filter((r) => r.onHold);

  return {
    fy,
    month,
    runExists: true,
    runStatus: run.status,
    runLabel: run.label,
    rows,
    payableCount: payable.length,
    payableTotal: payable.reduce((sum, r) => sum + r.net, 0),
    heldCount: held.length,
    heldTotal: held.reduce((sum, r) => sum + r.net, 0),
  };
}

/** FY + month options for the selector — the runs that actually exist. */
export async function listDisbursementRuns(): Promise<
  { fy: string; month: number; label: string; status: string }[]
> {
  const g = await gate();
  if (!g.ok) return [];
  const runs = await prisma.hrPayrollRun.findMany({
    where: { entityId: ENTITY_ID },
    orderBy: [{ fy: "desc" }, { month: "desc" }],
    select: { fy: true, month: true, label: true, status: true },
  });
  return runs;
}
