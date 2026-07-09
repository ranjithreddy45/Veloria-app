"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import {
  gratuityPayout,
  perDayPay,
  completedYearsBetween,
  DEFAULT_STAT_CONFIG,
  type StructureLine,
} from "@/lib/hr/payroll-calc";

// ============================================================
// Full-&-Final settlement — compute + persist DRAFT→APPROVED→PAID.
// Pure math lives in @/lib/hr/payroll-calc; this file is the IO layer.
// Guarded by hr:payroll.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

/** Indian financial year string for a date, e.g. "2026-27" (April–March). */
function fyOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1..12
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export interface FnfBreakdown {
  employeeId: string;
  empCode: string;
  name: string;
  lastWorkingDay: string; // ISO date (yyyy-mm-dd)
  dateOfJoining: string | null;
  // Service
  completedYears: number; // fractional years of service
  gratuityEligibleYears: number; // floored years used for payout
  lastDrawnBasic: number;
  monthlyCtc: number;
  // Components
  gratuityAmt: number;
  leaveEncashDays: number;
  leaveEncashAmt: number;
  perDayRate: number;
  pendingSalaryAmt: number;
  pendingSalaryEstimated: boolean; // true when derived from monthly CTC estimate
  pendingSalaryNote: string;
  noticeRecovery: number;
  otherAdditions: number;
  otherDeductions: number;
  // Result
  totalAdditions: number;
  totalDeductions: number;
  netPayable: number;
  notes: string[];
}

export interface ComputeFnfInput {
  lastWorkingDay: string; // yyyy-mm-dd
  noticeRecovery?: number;
  otherAdditions?: number;
  otherDeductions?: number;
}

// ------------------------------------------------------------
// Employee picker for the "New settlement" flow.
// ------------------------------------------------------------
export async function listFnfEmployees() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const emps = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      status: true,
      dateOfJoining: true,
      dateOfExit: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return emps.map((e) => ({
    id: e.id,
    empCode: e.empCode,
    firstName: e.firstName,
    lastName: e.lastName,
    status: e.status as string,
    dateOfJoining: e.dateOfJoining ? e.dateOfJoining.toISOString().slice(0, 10) : null,
    dateOfExit: e.dateOfExit ? e.dateOfExit.toISOString().slice(0, 10) : null,
  }));
}

// ------------------------------------------------------------
// computeFnfPreview — pure preview, NEVER persisted.
// ------------------------------------------------------------
export async function computeFnfPreview(
  employeeId: string,
  input: ComputeFnfInput,
): Promise<Result<FnfBreakdown>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  if (!input.lastWorkingDay) return { success: false, error: "Last working day is required." };
  const lwd = new Date(`${input.lastWorkingDay}T00:00:00.000Z`);
  if (Number.isNaN(lwd.getTime())) return { success: false, error: "Invalid last working day." };

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true, dateOfJoining: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const structure = await prisma.hrSalaryStructure.findFirst({
    where: { employeeId, isCurrent: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!structure) {
    return { success: false, error: "No current salary structure for this employee. Set one before running FnF." };
  }

  const lines = (structure.lines as unknown as StructureLine[]) || [];
  const lastDrawnBasic = Number(lines.find((l) => l.code === "BASIC")?.monthly ?? 0);
  const monthlyCtc = Number(structure.monthlyCtc);

  const notes: string[] = [];

  // ---- Gratuity: (15/26) × last basic × completed (floored) years, ≥5y ----
  const completedYears = emp.dateOfJoining ? completedYearsBetween(emp.dateOfJoining, lwd) : 0;
  const gratuityEligibleYears = Math.max(0, Math.floor(completedYears));
  const gratuityAmt = gratuityPayout(lastDrawnBasic, completedYears);
  if (!emp.dateOfJoining) notes.push("No date of joining on record — gratuity computed as 0.");
  else if (completedYears < DEFAULT_STAT_CONFIG.gratuityMinYears)
    notes.push(
      `Gratuity not payable — ${completedYears.toFixed(2)} years of service is below the ${DEFAULT_STAT_CONFIG.gratuityMinYears}-year statutory minimum.`,
    );

  // ---- Leave encashment: AVAILABLE paid-leave days × per-day (on basic) ----
  const year = lwd.getUTCFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId, year, leaveType: { paid: true } },
    include: { leaveType: { select: { name: true, paid: true } } },
  });
  let leaveEncashDays = 0;
  for (const b of balances) {
    const available = Number(b.entitled) + Number(b.carriedForward) - Number(b.used);
    if (available > 0) leaveEncashDays += available;
  }
  leaveEncashDays = Math.round(leaveEncashDays * 100) / 100;
  const perDayRate = perDayPay(lastDrawnBasic);
  const leaveEncashAmt = Math.round(leaveEncashDays * perDayRate);
  notes.push(
    `Leave encashment = available paid-leave balance (entitled + carried-forward − used) for ${year} × per-day pay on last-drawn basic (basic / ${DEFAULT_STAT_CONFIG.gratuityMonthDivisor}).`,
  );

  // ---- Pending salary: one month's pay if the exit month isn't yet run ----
  // Kept deliberately simple: uses monthly CTC as an ESTIMATE (a locked payroll
  // run for the exit month is the source of truth once it exists).
  const fy = fyOf(lwd);
  const exitMonth = lwd.getUTCMonth() + 1; // 1..12
  const alreadyPaid = await prisma.hrPayslip.findFirst({
    where: { employeeId, run: { fy, month: exitMonth } },
    select: { id: true },
  });
  let pendingSalaryAmt = 0;
  let pendingSalaryEstimated = false;
  let pendingSalaryNote: string;
  if (alreadyPaid) {
    pendingSalaryNote = `Exit month (${fy}, month ${exitMonth}) already has a payslip — no pending salary carried into FnF.`;
  } else {
    pendingSalaryAmt = Math.round(monthlyCtc);
    pendingSalaryEstimated = true;
    pendingSalaryNote = `Exit month (${fy}, month ${exitMonth}) not yet run — pending salary ESTIMATED as one month's CTC (₹${pendingSalaryAmt.toLocaleString("en-IN")}). Replace with the actual locked payslip when payroll runs.`;
  }
  notes.push(pendingSalaryNote);

  const noticeRecovery = Math.max(0, Math.round(Number(input.noticeRecovery ?? 0)));
  const otherAdditions = Math.max(0, Math.round(Number(input.otherAdditions ?? 0)));
  const otherDeductions = Math.max(0, Math.round(Number(input.otherDeductions ?? 0)));

  const totalAdditions = gratuityAmt + leaveEncashAmt + pendingSalaryAmt + otherAdditions;
  const totalDeductions = noticeRecovery + otherDeductions;
  const netPayable = totalAdditions - totalDeductions;

  const breakdown: FnfBreakdown = {
    employeeId: emp.id,
    empCode: emp.empCode,
    name: `${emp.firstName} ${emp.lastName}`,
    lastWorkingDay: input.lastWorkingDay,
    dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().slice(0, 10) : null,
    completedYears: Math.round(completedYears * 100) / 100,
    gratuityEligibleYears,
    lastDrawnBasic,
    monthlyCtc,
    gratuityAmt,
    leaveEncashDays,
    leaveEncashAmt,
    perDayRate,
    pendingSalaryAmt,
    pendingSalaryEstimated,
    pendingSalaryNote,
    noticeRecovery,
    otherAdditions,
    otherDeductions,
    totalAdditions,
    totalDeductions,
    netPayable,
    notes,
  };
  return { success: true, data: breakdown };
}

// ------------------------------------------------------------
// saveFnf — persist a DRAFT settlement (snapshots + breakdown).
// ------------------------------------------------------------
export async function saveFnf(
  employeeId: string,
  input: ComputeFnfInput & { note?: string },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const preview = await computeFnfPreview(employeeId, input);
  if (!preview.success) return preview;
  const b = preview.data;

  const created = await prisma.hrFnfSettlement.create({
    data: {
      employeeId,
      empCodeSnap: b.empCode,
      nameSnap: b.name,
      lastWorkingDay: new Date(`${b.lastWorkingDay}T00:00:00.000Z`),
      status: "DRAFT",
      leaveEncashDays: b.leaveEncashDays,
      leaveEncashAmt: b.leaveEncashAmt,
      gratuityAmt: b.gratuityAmt,
      pendingSalaryAmt: b.pendingSalaryAmt,
      noticeRecovery: b.noticeRecovery,
      otherAdditions: b.otherAdditions,
      otherDeductions: b.otherDeductions,
      netPayable: b.netPayable,
      note: input.note?.trim() || null,
      breakdown: b as unknown as Prisma.InputJsonValue,
      createdById: u!.id,
    },
  });
  revalidatePath("/people/payroll/fnf");
  return { success: true, data: { id: created.id } };
}

export async function approveFnf(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  // Only DRAFT → APPROVED; guard against double transitions.
  const res = await prisma.hrFnfSettlement.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  if (res.count === 0) return { success: false, error: "Settlement not found or not in DRAFT." };
  revalidatePath("/people/payroll/fnf");
  revalidatePath(`/people/payroll/fnf/${id}`);
  return { success: true, data: { id } };
}

export async function markFnfPaid(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  // Only APPROVED → PAID.
  const res = await prisma.hrFnfSettlement.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "PAID" },
  });
  if (res.count === 0) return { success: false, error: "Settlement must be APPROVED before it can be marked paid." };
  revalidatePath("/people/payroll/fnf");
  revalidatePath(`/people/payroll/fnf/${id}`);
  return { success: true, data: { id } };
}

export async function listFnf() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const rows = await prisma.hrFnfSettlement.findMany({
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    empCode: r.empCodeSnap,
    name: r.nameSnap,
    lastWorkingDay: r.lastWorkingDay.toISOString().slice(0, 10),
    status: r.status,
    gratuityAmt: Number(r.gratuityAmt),
    leaveEncashAmt: Number(r.leaveEncashAmt),
    pendingSalaryAmt: Number(r.pendingSalaryAmt),
    netPayable: Number(r.netPayable),
    createdAt: r.createdAt.toISOString(),
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
  }));
}

export async function getFnf(id: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return null;
  const r = await prisma.hrFnfSettlement.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    employeeId: r.employeeId,
    empCode: r.empCodeSnap,
    name: r.nameSnap,
    lastWorkingDay: r.lastWorkingDay.toISOString().slice(0, 10),
    status: r.status,
    leaveEncashDays: Number(r.leaveEncashDays),
    leaveEncashAmt: Number(r.leaveEncashAmt),
    gratuityAmt: Number(r.gratuityAmt),
    pendingSalaryAmt: Number(r.pendingSalaryAmt),
    noticeRecovery: Number(r.noticeRecovery),
    otherAdditions: Number(r.otherAdditions),
    otherDeductions: Number(r.otherDeductions),
    netPayable: Number(r.netPayable),
    note: r.note,
    breakdown: (r.breakdown as unknown as FnfBreakdown) || null,
    createdAt: r.createdAt.toISOString(),
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
  };
}
