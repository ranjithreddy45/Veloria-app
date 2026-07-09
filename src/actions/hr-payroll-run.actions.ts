"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { computePayslip, type StructureLine } from "@/lib/hr/payroll-calc";
import { sendEmail } from "@/lib/email";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/**
 * Best-effort: notify each employee (with a linked work email) that their
 * payslip for the run is ready, linking to ESS. Never throws.
 */
async function deliverPayslipEmails(runId: string): Promise<void> {
  try {
    const run = await prisma.hrPayrollRun.findUnique({
      where: { id: runId },
      select: { label: true, payslips: { select: { employeeId: true, net: true } } },
    });
    if (!run || run.payslips.length === 0) return;
    const emps = await prisma.employee.findMany({
      where: { id: { in: run.payslips.map((p) => p.employeeId) }, workEmail: { not: null } },
      select: { id: true, firstName: true, workEmail: true },
    });
    const byId = new Map(emps.map((e) => [e.id, e]));
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
    await Promise.allSettled(
      run.payslips.map((p) => {
        const e = byId.get(p.employeeId);
        if (!e?.workEmail) return Promise.resolve();
        return sendEmail({
          to: e.workEmail,
          subject: `Your payslip for ${run.label} is ready`,
          html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.55">
            <p>Hi ${e.firstName || "there"},</p>
            <p>Your payslip for <strong>${run.label}</strong> is now available — net pay <strong>${inr(Number(p.net))}</strong>.</p>
            <p><a href="${base}/people/my/payslips" style="color:#7c3aed">View & download your payslip →</a></p>
          </div>`,
        });
      }),
    );
  } catch (err) {
    console.error("[PAYSLIP_EMAIL_ERR]", err);
  }
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENTITY_ID = "BILLION";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Calendar year for a given Indian FY + calendar month. FY "2026-27" spans
 * Apr 2026 → Mar 2027, so months 4..12 belong to the first year (2026) and
 * months 1..3 belong to the second year (2027).
 */
function calendarYearFor(fy: string, month: number): number {
  const first = Number(fy.slice(0, 4));
  return month >= 4 ? first : first + 1;
}

/** Days in a given calendar month (month 1..12). `new Date(y, m, 0)` = last day of month m. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ============================================================
// Reads
// ============================================================
export async function listPayrollRuns() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  return prisma.hrPayrollRun.findMany({
    where: { entityId: ENTITY_ID },
    orderBy: [{ fy: "desc" }, { month: "desc" }],
  });
}

export async function getPayrollRun(runId: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return null;
  return prisma.hrPayrollRun.findUnique({
    where: { id: runId },
    include: {
      payslips: { orderBy: { nameSnap: "asc" } },
    },
  });
}

// ============================================================
// Create a DRAFT run
// ============================================================
export async function createPayrollRun(input: { fy: string; month: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const fy = input.fy?.trim();
  const month = Number(input.month);
  if (!fy || !/^\d{4}-\d{2}$/.test(fy)) return { success: false, error: "Pick a valid financial year." };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { success: false, error: "Pick a valid month." };

  // Guard the @@unique([entityId, fy, month]).
  const existing = await prisma.hrPayrollRun.findUnique({
    where: { entityId_fy_month: { entityId: ENTITY_ID, fy, month } },
  });
  if (existing) return { success: false, error: `A payroll run for ${MONTH_ABBR[month - 1]} ${calendarYearFor(fy, month)} already exists.` };

  const label = `${MONTH_ABBR[month - 1]} ${calendarYearFor(fy, month)}`;

  try {
    const run = await prisma.hrPayrollRun.create({
      data: { entityId: ENTITY_ID, fy, month, label, status: "DRAFT", createdById: u?.id ?? null },
    });
    revalidatePath("/people/payroll");
    return { success: true, data: { id: run.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { success: false, error: "That payroll run already exists." };
    return { success: false, error: "Could not create the payroll run." };
  }
}

// ============================================================
// Compute / recompute payslips for a DRAFT run
// ============================================================
export async function computePayrollRun(runId: string): Promise<Result<{ headcount: number; skipped: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const run = await prisma.hrPayrollRun.findUnique({ where: { id: runId } });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (run.status !== "DRAFT") return { success: false, error: "Only draft runs can be computed. Locked/paid runs are frozen." };

  const year = calendarYearFor(run.fy, run.month);
  const monthDays = daysInMonth(year, run.month);

  // ACTIVE (payable) employees for this entity, each with their current structure.
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, empCode: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const structures = await prisma.hrSalaryStructure.findMany({
    where: { isCurrent: true, employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true, lines: true },
  });
  const structByEmp = new Map(structures.map((s) => [s.employeeId, s]));

  // Attendance → salary bridge: pull loss-of-pay days from the FINALised
  // monthly attendance sheet for this period. No FINAL sheet → LOP 0 (full pay).
  const sheets = await prisma.monthlyAttendanceSheet.findMany({
    where: { fy: run.fy, month: run.month, status: "FINAL", employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true, lopDays: true, workingDays: true },
  });
  // LOP + the working-day payable base go together so proration uses the same unit.
  const sheetByEmp = new Map(
    sheets.map((s) => [s.employeeId, { lop: Number(s.lopDays), workingDays: s.workingDays }]),
  );

  let headcount = 0;
  let skipped = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const struct = structByEmp.get(emp.id);
      if (!struct) {
        skipped++;
        continue;
      }
      const lines = (struct.lines as unknown as StructureLine[]) ?? [];
      const sheet = sheetByEmp.get(emp.id);
      const c = computePayslip({
        lines,
        lopDays: sheet?.lop ?? 0,
        // Working days from the FINAL sheet are the payable base; no sheet → full pay.
        payableDays: sheet && sheet.workingDays > 0 ? sheet.workingDays : undefined,
        monthDays,
      });

      headcount++;
      totalGross += c.gross;
      totalDeductions += c.totalDeductions;
      totalNet += c.net;

      const name = `${emp.firstName} ${emp.lastName}`.trim();
      const payslipData = {
        empCodeSnap: emp.empCode,
        nameSnap: name,
        paidDays: new Prisma.Decimal(c.paidDays),
        lopDays: new Prisma.Decimal(c.lopDays),
        gross: new Prisma.Decimal(c.gross),
        earnings: c.earnings as unknown as Prisma.InputJsonValue,
        deductions: c.deductions as unknown as Prisma.InputJsonValue,
        pf: new Prisma.Decimal(c.pf),
        esi: new Prisma.Decimal(c.esi),
        pt: new Prisma.Decimal(c.pt),
        tds: new Prisma.Decimal(c.tds),
        gratuityAccrued: new Prisma.Decimal(c.gratuityAccrued),
        net: new Prisma.Decimal(c.net),
      };

      // Idempotent: re-running overwrites the prior payslip for this employee.
      await tx.hrPayslip.upsert({
        where: { runId_employeeId: { runId, employeeId: emp.id } },
        create: { runId, employeeId: emp.id, ...payslipData },
        update: payslipData,
      });
    }

    // Drop stale payslips for employees no longer payable / without a structure.
    await tx.hrPayslip.deleteMany({
      where: { runId, employeeId: { notIn: employees.filter((e) => structByEmp.has(e.id)).map((e) => e.id) } },
    });

    await tx.hrPayrollRun.update({
      where: { id: runId },
      data: {
        totalGross: new Prisma.Decimal(totalGross.toFixed(2)),
        totalDeductions: new Prisma.Decimal(totalDeductions.toFixed(2)),
        totalNet: new Prisma.Decimal(totalNet.toFixed(2)),
        headcount,
      },
    });
  });

  revalidatePath("/people/payroll");
  revalidatePath(`/people/payroll/${runId}`);
  return { success: true, data: { headcount, skipped } };
}

// ============================================================
// Lifecycle: lock + mark paid
// ============================================================
export async function lockPayrollRun(runId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const run = await prisma.hrPayrollRun.findUnique({
    where: { id: runId },
    select: { status: true, headcount: true },
  });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (run.status !== "DRAFT") return { success: false, error: "Only a draft run can be locked." };
  if (run.headcount < 1) return { success: false, error: "Compute payslips before locking the run." };

  await prisma.hrPayrollRun.update({
    where: { id: runId },
    data: { status: "LOCKED", lockedAt: new Date() },
  });
  // Payslips are final once locked — notify employees their payslip is ready.
  await deliverPayslipEmails(runId);
  revalidatePath("/people/payroll");
  revalidatePath(`/people/payroll/${runId}`);
  return { success: true, data: { id: runId } };
}

export async function markPayrollPaid(runId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const run = await prisma.hrPayrollRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (run.status !== "LOCKED") return { success: false, error: "Lock the run before marking it paid." };

  await prisma.hrPayrollRun.update({ where: { id: runId }, data: { status: "PAID" } });
  revalidatePath("/people/payroll");
  revalidatePath(`/people/payroll/${runId}`);
  return { success: true, data: { id: runId } };
}
