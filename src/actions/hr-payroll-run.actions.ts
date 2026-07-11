"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { computePayslip, type StructureLine, type StatConfig } from "@/lib/hr/payroll-calc";
import { resolveStatConfig } from "@/lib/hr/stat-config";

/** Round to paise. Money must never carry float dust into a Decimal column. */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
import { sendEmail } from "@/lib/email";
import { postWithinTx, fyForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

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
  const run = await prisma.hrPayrollRun.findUnique({
    where: { id: runId },
    include: { payslips: { orderBy: { nameSnap: "asc" } } },
  });
  if (!run) return null;
  // Resolve the GL entry number for display when this run has been posted.
  let glEntryNo: string | null = null;
  if (run.journalEntryId) {
    const je = await prisma.finJournalEntry.findUnique({
      where: { id: run.journalEntryId },
      select: { entryNo: true },
    });
    glEntryNo = je?.entryNo ?? null;
  }
  return { ...run, glEntryNo };
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
    // legalEntityId drives which persisted statutory config applies to this employee.
    select: { id: true, empCode: true, firstName: true, lastName: true, legalEntityId: true },
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

  // Statutory config is per LEGAL ENTITY. Resolve each distinct entity ONCE
  // (not per employee) before the transaction. An entity with no persisted
  // config falls back to DEFAULT_STAT_CONFIG, so runs keep their existing
  // numbers until an admin configures it — a missing config must never silently
  // zero out a statutory deduction.
  const entityIds = Array.from(
    new Set(employees.map((e) => e.legalEntityId).filter((x): x is string => !!x)),
  );
  const cfgByEntity = new Map<string, StatConfig>();
  for (const eid of entityIds) {
    const resolved = await resolveStatConfig(eid);
    cfgByEntity.set(eid, resolved.cfg);
  }

  // ---- Salary advances due for recovery this month ----
  // An advance is due once its start period has arrived. `startFy` is "YYYY-YY",
  // which sorts lexicographically in chronological order, so a plain string
  // compare is correct here.
  const advances = await prisma.hrAdvance.findMany({
    where: { status: "ACTIVE", employeeId: { in: employees.map((e) => e.id) } },
    include: { recoveries: { where: { runId }, select: { amount: true } } },
  });
  const dueAdvances = advances.filter(
    (a) => a.startFy < run.fy || (a.startFy === run.fy && a.startMonth <= run.month),
  );
  const advByEmp = new Map<string, (typeof dueAdvances)[number]>();
  for (const a of dueAdvances) advByEmp.set(a.employeeId, a); // at most one ACTIVE per employee

  // ---- Arrears due to be paid in THIS run's month ----
  // Include arrears already stamped with this runId (a re-run) so re-processing
  // the same month recomputes identically instead of dropping them.
  const arrears = await prisma.hrArrear.findMany({
    where: {
      payFy: run.fy,
      payMonth: run.month,
      employeeId: { in: employees.map((e) => e.id) },
      OR: [{ status: "PENDING" }, { status: "PAID", runId }],
    },
  });
  const arrearsByEmp = new Map<string, typeof arrears>();
  for (const a of arrears) {
    const list = arrearsByEmp.get(a.employeeId) ?? [];
    list.push(a);
    arrearsByEmp.set(a.employeeId, list);
  }

  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const struct = structByEmp.get(emp.id);
      if (!struct) {
        skipped++;
        continue;
      }
      const lines = (struct.lines as unknown as StructureLine[]) ?? [];
      const sheet = sheetByEmp.get(emp.id);
      const empArrears = arrearsByEmp.get(emp.id) ?? [];
      const c = computePayslip({
        lines,
        lopDays: sheet?.lop ?? 0,
        // Working days from the FINAL sheet are the payable base; no sheet → full pay.
        payableDays: sheet && sheet.workingDays > 0 ? sheet.workingDays : undefined,
        monthDays,
        cfg: emp.legalEntityId ? cfgByEntity.get(emp.legalEntityId) : undefined,
        arrears: empArrears.map((a) => ({
          amount: Number(a.amount),
          taxable: a.taxable,
          pfApplicable: a.pfApplicable,
          esiApplicable: a.esiApplicable,
          ptApplicable: a.ptApplicable,
        })),
      });

      // Stamp the arrears paid in this run (idempotent — a re-run re-marks the
      // same rows to this runId; it never pays an arrear twice).
      if (empArrears.length > 0) {
        await tx.hrArrear.updateMany({
          where: { id: { in: empArrears.map((a) => a.id) } },
          data: { status: "PAID", runId },
        });
      }

      // ---- Advance recovery ----
      // Idempotent by construction: a re-run of the SAME month first backs out
      // whatever this run previously recovered, so `recovered` can never be
      // double-counted. The instalment is capped by BOTH the outstanding balance
      // and this month's net pay, so recovery never drives a salary negative.
      const adv = advByEmp.get(emp.id);
      let advanceRecovered = 0;
      if (adv) {
        const priorThisRun = adv.recoveries.length ? Number(adv.recoveries[0].amount) : 0;
        const recoveredExcludingThisRun = Math.max(0, Number(adv.recovered) - priorThisRun);
        const outstanding = Math.max(0, Number(adv.amount) - recoveredExcludingThisRun);
        advanceRecovered = r2(Math.min(Number(adv.monthlyInstallment), outstanding, Math.max(0, c.net)));

        if (advanceRecovered > 0) {
          await tx.hrAdvanceRecovery.upsert({
            where: { advanceId_runId: { advanceId: adv.id, runId } },
            create: { advanceId: adv.id, runId, amount: new Prisma.Decimal(advanceRecovered) },
            update: { amount: new Prisma.Decimal(advanceRecovered) },
          });
        } else if (priorThisRun > 0) {
          // Nothing recoverable now (e.g. a zero-pay month) — drop a stale row.
          await tx.hrAdvanceRecovery.deleteMany({ where: { advanceId: adv.id, runId } });
        }

        const newRecovered = r2(recoveredExcludingThisRun + advanceRecovered);
        const settled = newRecovered >= Number(adv.amount) - 0.005;
        await tx.hrAdvance.update({
          where: { id: adv.id },
          data: { recovered: new Prisma.Decimal(newRecovered), ...(settled ? { status: "CLOSED" } : {}) },
        });
      }

      const netAfterAdvance = r2(Math.max(0, c.net - advanceRecovered));
      const deductionsWithAdvance =
        advanceRecovered > 0
          ? [...c.deductions, { code: "ADV", name: "Advance recovery", amount: advanceRecovered }]
          : c.deductions;

      headcount++;
      totalGross += c.gross;
      totalDeductions += c.totalDeductions + advanceRecovered;
      totalNet += netAfterAdvance;

      const name = `${emp.firstName} ${emp.lastName}`.trim();
      const payslipData = {
        empCodeSnap: emp.empCode,
        nameSnap: name,
        paidDays: new Prisma.Decimal(c.paidDays),
        lopDays: new Prisma.Decimal(c.lopDays),
        gross: new Prisma.Decimal(c.gross),
        earnings: c.earnings as unknown as Prisma.InputJsonValue,
        deductions: deductionsWithAdvance as unknown as Prisma.InputJsonValue,
        advanceRecovered: new Prisma.Decimal(advanceRecovered),
        pf: new Prisma.Decimal(c.pf),
        esi: new Prisma.Decimal(c.esi),
        pt: new Prisma.Decimal(c.pt),
        tds: new Prisma.Decimal(c.tds),
        gratuityAccrued: new Prisma.Decimal(c.gratuityAccrued),
        // Net PAYABLE after advance recovery (never negative).
        net: new Prisma.Decimal(netAfterAdvance),
        // Employer legs — cost to company, never deducted from the employee.
        employerEps: new Prisma.Decimal(c.employerEps),
        employerEpf: new Prisma.Decimal(c.employerEpf),
        employerPf: new Prisma.Decimal(c.employerPf),
        employerEdli: new Prisma.Decimal(c.employerEdli),
        employerPfAdmin: new Prisma.Decimal(c.employerPfAdmin),
        employerEsi: new Prisma.Decimal(c.employerEsi),
        employerCost: new Prisma.Decimal(c.employerCost),
        ctc: new Prisma.Decimal(c.ctc),
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

/**
 * Post a locked HR payroll run's salary journal to the Finance General Ledger —
 * the bridge that makes HR payroll the single source of truth (no double entry).
 *
 * Double-entry (rupees; the ledger enforces Σdebits = Σcredits in paise):
 *   Dr  Salaries & Wages (5100)      = total gross
 *   Cr  Salaries Payable (2230)      = gross − (PF+ESI+PT+TDS)   [≈ net pay]
 *   Cr  PF / ESI / PT / TDS Payable  = respective withholdings
 * Net payable is derived as (gross − statutory) so the entry ALWAYS balances by
 * construction, even if a structure ever carries a non-statutory deduction.
 *
 * Idempotent + safe: refuses a DRAFT run, short-circuits if already posted, and
 * inside one transaction re-checks the run + guards against ANY existing PAYROLL
 * journal for the same posting date (catches a re-post AND a clash with the
 * separate Finance payroll, preventing double-counted salaries). To re-post,
 * reverse the journal in Finance first.
 */
export async function postHrPayrollToGL(runId: string): Promise<Result<{ entryNo: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const run = await prisma.hrPayrollRun.findUnique({
    where: { id: runId },
    select: {
      status: true, fy: true, month: true, label: true, journalEntryId: true,
      totalGross: true, totalNet: true,
      payslips: { select: { pf: true, esi: true, pt: true, tds: true } },
    },
  });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (run.status === "DRAFT") return { success: false, error: "Lock the run before posting it to accounts." };
  if (run.journalEntryId) return { success: false, error: "This run is already posted to the ledger." };
  if (run.payslips.length === 0) return { success: false, error: "Run has no payslips to post." };

  const sum = run.payslips.reduce(
    (a, p) => {
      a.pf += Number(p.pf); a.esi += Number(p.esi); a.pt += Number(p.pt); a.tds += Number(p.tds);
      return a;
    },
    { pf: 0, esi: 0, pt: 0, tds: 0 },
  );
  const totalGross = Number(run.totalGross);
  const statutory = sum.pf + sum.esi + sum.pt + sum.tds;
  const netPayable = Math.round((totalGross - statutory) * 100) / 100; // ≈ totalNet
  if (totalGross <= 0) return { success: false, error: "Run has a zero gross — nothing to post." };

  // Posting date = 1st of the run's calendar month; the ledger derives fy/period.
  const date = new Date(Date.UTC(calendarYearFor(run.fy, run.month), run.month - 1, 1));
  if (fyForDate(date) !== run.fy) {
    return { success: false, error: `Run ${run.fy} / month ${run.month} can't be mapped to a posting date.` };
  }

  const codes = {
    salaries: FIN_ACCOUNT_CODES.salaries, // 5100
    salariesPayable: "2230", pfPayable: "2200", esiPayable: "2210", ptPayable: "2220", tdsPayable: "2110",
  };
  const accounts = await prisma.finAccount.findMany({ where: { code: { in: Object.values(codes) } }, select: { id: true, code: true } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const need = (code: string, label: string) => {
    const id = idByCode.get(code);
    if (!id) throw new Error(`${label} account (${code}) is missing — seed the chart of accounts in Finance first.`);
    return id;
  };

  try {
    const lines: { accountId: string; debit?: number; credit?: number; narration?: string }[] = [
      { accountId: need(codes.salaries, "Salaries & Wages"), debit: totalGross, narration: "Gross salaries" },
      { accountId: need(codes.salariesPayable, "Salaries Payable"), credit: netPayable, narration: "Net pay" },
    ];
    if (sum.pf > 0) lines.push({ accountId: need(codes.pfPayable, "PF Payable"), credit: sum.pf, narration: "PF" });
    if (sum.esi > 0) lines.push({ accountId: need(codes.esiPayable, "ESI Payable"), credit: sum.esi, narration: "ESI" });
    if (sum.pt > 0) lines.push({ accountId: need(codes.ptPayable, "PT Payable"), credit: sum.pt, narration: "Professional tax" });
    if (sum.tds > 0) lines.push({ accountId: need(codes.tdsPayable, "TDS Payable"), credit: sum.tds, narration: "TDS" });

    const entryNo = await prisma.$transaction(async (tx) => {
      const fresh = await tx.hrPayrollRun.findUnique({ where: { id: runId }, select: { status: true, journalEntryId: true } });
      if (!fresh || fresh.status === "DRAFT") throw new Error("Lock the run before posting it to accounts.");
      if (fresh.journalEntryId) throw new Error("This run is already posted to the ledger.");
      // Guard against ANY payroll journal already posted for this month (a
      // re-post, or the separate Finance payroll) → would double-count salaries.
      const clash = await tx.finJournalEntry.findFirst({
        where: { sourceModule: "PAYROLL", date, status: "POSTED" },
        select: { entryNo: true },
      });
      if (clash) throw new Error(`A payroll journal (${clash.entryNo}) is already posted for ${run.label}. Reverse it in Finance before re-posting.`);

      const entry = await postWithinTx(tx, {
        date,
        narration: `HR Payroll ${run.label}`,
        sourceModule: "PAYROLL",
        sourceRefId: runId,
        createdById: u!.id,
        lines,
      });
      await tx.hrPayrollRun.update({ where: { id: runId }, data: { journalEntryId: entry.id, glPostedAt: new Date() } });
      return entry.entryNo;
    });

    revalidatePath("/people/payroll");
    revalidatePath(`/people/payroll/${runId}`);
    revalidatePath("/finance");
    return { success: true, data: { entryNo } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not post the payroll run to accounts." };
  }
}
