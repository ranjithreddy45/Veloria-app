"use server";

// ============================================================
// Finance — Payroll. A self-contained payroll sub-ledger: employees,
// payroll runs (compute gross/PF/ESI/PT/TDS/net per active employee),
// and posting a BALANCED salary JE to the GL through the journal engine.
//   Dr Salaries Expense  = totalGross
//   Cr Salaries Payable  = totalNet
//   Cr PF / ESI / PT / TDS Payable = respective sums
// gross = net + pf + esi + pt + tds → Σdebit = Σcredit (passes the DB
// balance trigger). API consumed by /finance/payroll.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { postWithinTx, fyForDate, periodForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canFinance = (r?: string) => !!r && FINANCE_ROLES.includes(r);
// AUDITOR has finance:read (read-only accountant portal) — reads must honour it.
const canFinanceRead = (r?: string) => !!r && (FINANCE_ROLES.includes(r) || r === "AUDITOR");

const dec = (n: number) => new Prisma.Decimal(n.toFixed(2));

// ------------------------------------------------------------
// Employees
// ------------------------------------------------------------
export async function getEmployees() {
  const u = await requireUser();
  if (!canFinanceRead(u?.role)) return [];
  const rows = await prisma.finEmployee.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    designation: e.designation,
    department: e.department,
    ctcMonthly: Number(e.ctcMonthly),
    basicPct: e.basicPct,
    pan: e.pan,
    bankLast4: e.bankLast4,
    isActive: e.isActive,
  }));
}

export async function createEmployee(input: {
  name: string;
  designation?: string;
  department?: string;
  ctcMonthly: number;
  basicPct?: number;
  pan?: string;
  bankLast4?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Name is required." };
  const ctc = Number(input.ctcMonthly);
  if (!Number.isFinite(ctc) || ctc <= 0) return { success: false, error: "Monthly CTC must be a positive amount." };
  const basicPct = input.basicPct == null ? 50 : Math.round(Number(input.basicPct));
  if (!Number.isFinite(basicPct) || basicPct < 0 || basicPct > 100) return { success: false, error: "Basic % must be between 0 and 100." };

  const created = await prisma.finEmployee.create({
    data: {
      name: input.name.trim(),
      designation: input.designation?.trim() || null,
      department: input.department?.trim() || null,
      ctcMonthly: dec(ctc),
      basicPct,
      pan: input.pan?.trim() || null,
      bankLast4: input.bankLast4?.trim() || null,
      createdById: u!.id,
    },
  });
  revalidatePath("/finance/payroll");
  return { success: true, data: { id: created.id } };
}

// ------------------------------------------------------------
// Payroll runs
// ------------------------------------------------------------
export async function getPayrollRuns() {
  const u = await requireUser();
  if (!canFinanceRead(u?.role)) return [];
  const rows = await prisma.finPayrollRun.findMany({
    orderBy: [{ fy: "desc" }, { period: "desc" }],
    include: { _count: { select: { payslips: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    fy: r.fy,
    period: r.period,
    label: r.label,
    status: r.status,
    totalGross: Number(r.totalGross),
    totalDeductions: Number(r.totalDeductions),
    totalNet: Number(r.totalNet),
    journalEntryId: r.journalEntryId,
    payslipCount: r._count.payslips,
  }));
}

// Compute one payslip from an employee's CTC. Indian statutory rules of thumb:
//   pf  = 12% of basic, capped at ₹15,000 of basic
//   esi = 0.75% of ESI wages when wages ≤ ₹21,000, else nil
//   pt  = ₹200 flat ; tds = 0 (placeholder)
// ESI is computed on statutory "wages" — gross earnings paid to the employee,
// which exclude employer-side contributions (e.g. employer PF) bundled into CTC.
// We approximate wages as CTC minus the employer PF contribution (matched to the
// employee PF, capped at ₹15,000 of basic) so the ₹21,000 ceiling and 0.75% rate
// apply to the wage base rather than full CTC.
function computeSlip(ctcMonthly: number, basicPct: number) {
  const gross = Math.round(ctcMonthly * 100) / 100;
  const basic = (gross * basicPct) / 100;
  const pf = Math.round(Math.min(basic, 15000) * 0.12);
  // Employer PF mirrors the employee PF; it is part of CTC but not of ESI wages.
  const employerPf = pf;
  const esiWages = Math.round((gross - employerPf) * 100) / 100;
  const esi = esiWages <= 21000 ? Math.round(esiWages * 0.0075) : 0;
  const pt = 200;
  const tds = 0;
  const net = Math.round((gross - pf - esi - pt - tds) * 100) / 100;
  return { gross, pf, esi, pt, tds, net };
}

export async function createPayrollRun(input: {
  fy: string;
  period: number;
  label: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };

  const fy = input.fy?.trim();
  const period = Math.round(Number(input.period));
  const label = input.label?.trim();
  if (!fy) return { success: false, error: "Financial year is required." };
  if (!Number.isFinite(period) || period < 1 || period > 12) return { success: false, error: "Period must be 1–12 (Apr=1)." };
  if (!label) return { success: false, error: "Label is required." };

  const existing = await prisma.finPayrollRun.findUnique({ where: { fy_period: { fy, period } } });
  if (existing) return { success: false, error: `A run already exists for ${fy} period ${period}.` };

  const employees = await prisma.finEmployee.findMany({ where: { isActive: true } });
  if (employees.length === 0) return { success: false, error: "No active employees to run payroll for." };

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  const slips = employees.map((e) => {
    const s = computeSlip(Number(e.ctcMonthly), e.basicPct);
    totalGross += s.gross;
    totalDeductions += s.pf + s.esi + s.pt + s.tds;
    totalNet += s.net;
    return { employeeId: e.id, ...s };
  });
  totalGross = Math.round(totalGross * 100) / 100;
  totalDeductions = Math.round(totalDeductions * 100) / 100;
  totalNet = Math.round(totalNet * 100) / 100;

  const created = await prisma.finPayrollRun.create({
    data: {
      fy,
      period,
      label,
      status: "DRAFT",
      totalGross: dec(totalGross),
      totalDeductions: dec(totalDeductions),
      totalNet: dec(totalNet),
      createdById: u!.id,
      payslips: {
        create: slips.map((s) => ({
          employeeId: s.employeeId,
          gross: dec(s.gross),
          tds: dec(s.tds),
          pf: dec(s.pf),
          esi: dec(s.esi),
          pt: dec(s.pt),
          net: dec(s.net),
        })),
      },
    },
  });
  revalidatePath("/finance/payroll");
  return { success: true, data: { id: created.id } };
}

// ------------------------------------------------------------
// Post run → balanced salary JE through the journal engine.
// ------------------------------------------------------------
export async function postPayrollRun(runId: string): Promise<Result<{ entryNo: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };

  const run = await prisma.finPayrollRun.findUnique({
    where: { id: runId },
    include: { payslips: true },
  });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (run.status !== "DRAFT") return { success: false, error: "Only DRAFT runs can be posted." };
  if (run.payslips.length === 0) return { success: false, error: "Run has no payslips." };

  const sum = run.payslips.reduce(
    (acc, p) => {
      acc.pf += Number(p.pf);
      acc.esi += Number(p.esi);
      acc.pt += Number(p.pt);
      acc.tds += Number(p.tds);
      return acc;
    },
    { pf: 0, esi: 0, pt: 0, tds: 0 },
  );
  const totalGross = Number(run.totalGross);
  const totalNet = Number(run.totalNet);

  // Resolve posting accounts by code.
  const codes = {
    salaries: FIN_ACCOUNT_CODES.salaries, // 5100
    salariesPayable: "2230",
    pfPayable: "2200",
    esiPayable: "2210",
    ptPayable: "2220",
    tdsPayable: "2110",
  };
  const accounts = await prisma.finAccount.findMany({ where: { code: { in: Object.values(codes) } } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const need = (code: string, label: string) => {
    const id = idByCode.get(code);
    if (!id) throw new Error(`${label} account (${code}) not found — seed the chart of accounts first.`);
    return id;
  };

  try {
    const lines: { accountId: string; debit?: number; credit?: number; narration?: string }[] = [
      { accountId: need(codes.salaries, "Salaries Expense"), debit: totalGross, narration: "Gross salaries" },
      { accountId: need(codes.salariesPayable, "Salaries Payable"), credit: totalNet, narration: "Net pay" },
    ];
    if (sum.pf > 0) lines.push({ accountId: need(codes.pfPayable, "PF Payable"), credit: sum.pf, narration: "PF deduction" });
    if (sum.esi > 0) lines.push({ accountId: need(codes.esiPayable, "ESI Payable"), credit: sum.esi, narration: "ESI deduction" });
    if (sum.pt > 0) lines.push({ accountId: need(codes.ptPayable, "PT Payable"), credit: sum.pt, narration: "Professional tax" });
    if (sum.tds > 0) lines.push({ accountId: need(codes.tdsPayable, "TDS Payable"), credit: sum.tds, narration: "TDS deduction" });

    // Post into the calendar month this run belongs to. period 1=Apr (month
    // index 3) … 9=Dec (11), 10=Jan (0) … 12=Mar (2). FY start year covers
    // Apr–Dec (periods 1–9); Jan–Mar (periods 10–12) fall in start year + 1.
    const fyStart = Number(run.fy.slice(0, 4));
    const monthIndex = (run.period + 2) % 12; // Apr→3 … Mar→2
    const calYear = run.period <= 9 ? fyStart : fyStart + 1;
    const date = new Date(Date.UTC(calYear, monthIndex, 1));
    // Sanity: the engine must derive the same fy/period from this date.
    if (fyForDate(date) !== run.fy || periodForDate(date) !== run.period) {
      return { success: false, error: `Run period ${run.fy} P${run.period} is inconsistent — cannot resolve a posting date.` };
    }

    // ONE transaction: re-check DRAFT + idempotency on sourceRefId + post the
    // balanced JE + flip the run to POSTED. Posting the JE and marking the run
    // POSTED in separate writes risked a duplicate JE if the second write failed
    // (the run stayed DRAFT with a JE already posted, and re-posting would
    // double-count salaries — postJournalEntry has no idempotency guard).
    const res = await prisma.$transaction(async (tx) => {
      const fresh = await tx.finPayrollRun.findUnique({ where: { id: run.id }, select: { status: true } });
      if (!fresh || fresh.status !== "DRAFT") throw new Error("Only DRAFT runs can be posted.");
      const existing = await tx.finJournalEntry.findFirst({
        where: { sourceModule: "PAYROLL", sourceRefId: run.id },
        select: { id: true },
      });
      if (existing) throw new Error("This payroll run has already been posted.");

      const entry = await postWithinTx(tx, {
        date,
        narration: `Payroll ${run.label} (${run.fy} P${run.period})`,
        sourceModule: "PAYROLL",
        sourceRefId: run.id,
        createdById: u!.id,
        lines,
      });
      await tx.finPayrollRun.update({
        where: { id: run.id },
        data: { status: "POSTED", journalEntryId: entry.id },
      });
      return entry;
    });

    revalidatePath("/finance/payroll");
    return { success: true, data: { entryNo: res.entryNo } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not post payroll run." };
  }
}
