"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { decryptField, maskAccount } from "@/lib/hr/crypto";

// ============================================================
// Salary Reports — read-only reporting over the frozen HrPayslip
// snapshots for a payroll run. Five reports:
//   1. Salary sheet (standard)
//   2. Salary sheet (detailed — earnings/deductions expanded to columns)
//   3. Bank statement / advice (excludes on-hold salaries)
//   4. CTC sheet (employer contributions + CTC)
//   5. Salary summary (run totals)
//
// GUARD: every function requires `hr:payroll` (salary is sensitive).
// DEFAULT: only LOCKED or PAID runs surface figures; DRAFT numbers are
// withheld unless the caller explicitly opts in with `includeDraft`.
// PURE READ — no mutation, no persistence.
// ============================================================

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// A run's figures are "final" only when LOCKED or PAID. DRAFT is work-in-progress.
function isFinalStatus(status: string) {
  return status === "LOCKED" || status === "PAID";
}

// --- component-JSON shape stored on the payslip -----------------------------
interface Component {
  code: string;
  name: string;
  amount: number;
}
function parseComponents(value: unknown): Component[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        code: String(o.code ?? ""),
        name: String(o.name ?? o.code ?? ""),
        amount: Number(o.amount ?? 0) || 0,
      };
    })
    .filter((c) => c.code);
}

// Shared report metadata every report echoes back so the UI can render the
// period header, status pill and the "draft withheld" notice consistently.
export interface SalaryReportMeta {
  fy: string;
  month: number;
  runExists: boolean;
  runStatus: string | null; // DRAFT | LOCKED | PAID
  runLabel: string | null;
  /** True when a DRAFT run's figures are withheld because includeDraft was off. */
  draftHidden: boolean;
}

function emptyMeta(fy: string, month: number): SalaryReportMeta {
  return { fy, month, runExists: false, runStatus: null, runLabel: null, draftHidden: false };
}

// ------------------------------------------------------------
// Period picker — every run (all statuses) so the UI can offer a
// draft toggle; the default selection should be the latest final run.
// ------------------------------------------------------------
export interface SalaryRunPeriod {
  fy: string;
  month: number;
  label: string;
  status: string;
  headcount: number;
  isFinal: boolean;
}
export async function listSalaryRuns(): Promise<SalaryRunPeriod[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const runs = await prisma.hrPayrollRun.findMany({
    orderBy: [{ fy: "desc" }, { month: "desc" }],
    select: { fy: true, month: true, label: true, status: true, headcount: true },
  });
  return runs.map((r) => ({ ...r, isFinal: isFinalStatus(r.status) }));
}

// ============================================================
// 1. SALARY SHEET (standard)
// ============================================================
export interface SalarySheetRow {
  employeeId: string;
  empCode: string;
  name: string;
  paidDays: number;
  lopDays: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  otherDeductions: number; // residual: gross − net − (pf+esi+pt+tds)
  net: number;
}
export interface SalarySheet extends SalaryReportMeta {
  rows: SalarySheetRow[];
  totals: {
    headcount: number;
    gross: number;
    pf: number;
    esi: number;
    pt: number;
    tds: number;
    otherDeductions: number;
    net: number;
  };
}

export async function getSalarySheet(input: {
  fy: string;
  month: number;
  includeDraft?: boolean;
}): Promise<SalarySheet> {
  const u = await requireUser();
  const base: SalarySheet = {
    ...emptyMeta(input.fy, input.month),
    rows: [],
    totals: { headcount: 0, gross: 0, pf: 0, esi: 0, pt: 0, tds: 0, otherDeductions: 0, net: 0 },
  };
  if (!can(u?.role, "hr:payroll") || !input.fy || !input.month) return base;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    select: {
      label: true,
      status: true,
      payslips: {
        orderBy: { empCodeSnap: "asc" },
        select: {
          employeeId: true, empCodeSnap: true, nameSnap: true,
          paidDays: true, lopDays: true, gross: true,
          pf: true, esi: true, pt: true, tds: true, net: true,
        },
      },
    },
  });
  if (!run) return base;

  const meta: SalaryReportMeta = {
    fy: input.fy, month: input.month, runExists: true,
    runStatus: run.status, runLabel: run.label, draftHidden: false,
  };
  if (!isFinalStatus(run.status) && !input.includeDraft) {
    return { ...base, ...meta, draftHidden: true };
  }

  const rows: SalarySheetRow[] = run.payslips.map((p) => {
    const gross = Number(p.gross), pf = Number(p.pf), esi = Number(p.esi),
      pt = Number(p.pt), tds = Number(p.tds), net = Number(p.net);
    // Residual "other deductions" so the row always reconciles to net.
    const other = gross - net - pf - esi - pt - tds;
    return {
      employeeId: p.employeeId,
      empCode: p.empCodeSnap,
      name: p.nameSnap,
      paidDays: Number(p.paidDays),
      lopDays: Number(p.lopDays),
      gross, pf, esi, pt, tds,
      otherDeductions: other,
      net,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      headcount: t.headcount + 1,
      gross: t.gross + r.gross,
      pf: t.pf + r.pf,
      esi: t.esi + r.esi,
      pt: t.pt + r.pt,
      tds: t.tds + r.tds,
      otherDeductions: t.otherDeductions + r.otherDeductions,
      net: t.net + r.net,
    }),
    { headcount: 0, gross: 0, pf: 0, esi: 0, pt: 0, tds: 0, otherDeductions: 0, net: 0 },
  );

  return { ...meta, rows, totals };
}

// ============================================================
// 2. SALARY SHEET (detailed) — earnings + deductions expanded into
//    a dynamic column set (union of component codes across the run).
// ============================================================
export interface SalaryDetailedColumn {
  code: string;
  name: string;
}
export interface SalaryDetailedRow {
  employeeId: string;
  empCode: string;
  name: string;
  paidDays: number;
  gross: number;
  net: number;
  earnings: Record<string, number>; // code → amount
  deductions: Record<string, number>; // code → amount
}
export interface SalaryDetailedSheet extends SalaryReportMeta {
  earningColumns: SalaryDetailedColumn[];
  deductionColumns: SalaryDetailedColumn[];
  rows: SalaryDetailedRow[];
}

export async function getSalarySheetDetailed(input: {
  fy: string;
  month: number;
  includeDraft?: boolean;
}): Promise<SalaryDetailedSheet> {
  const u = await requireUser();
  const base: SalaryDetailedSheet = {
    ...emptyMeta(input.fy, input.month),
    earningColumns: [], deductionColumns: [], rows: [],
  };
  if (!can(u?.role, "hr:payroll") || !input.fy || !input.month) return base;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    select: {
      label: true,
      status: true,
      payslips: {
        orderBy: { empCodeSnap: "asc" },
        select: {
          employeeId: true, empCodeSnap: true, nameSnap: true,
          paidDays: true, gross: true, net: true,
          earnings: true, deductions: true,
        },
      },
    },
  });
  if (!run) return base;

  const meta: SalaryReportMeta = {
    fy: input.fy, month: input.month, runExists: true,
    runStatus: run.status, runLabel: run.label, draftHidden: false,
  };
  if (!isFinalStatus(run.status) && !input.includeDraft) {
    return { ...base, ...meta, draftHidden: true };
  }

  // Build the union of component columns in first-seen order (stable layout).
  const earnCols = new Map<string, string>();
  const dedCols = new Map<string, string>();
  const parsed = run.payslips.map((p) => {
    const earns = parseComponents(p.earnings);
    const deds = parseComponents(p.deductions);
    earns.forEach((c) => { if (!earnCols.has(c.code)) earnCols.set(c.code, c.name); });
    deds.forEach((c) => { if (!dedCols.has(c.code)) dedCols.set(c.code, c.name); });
    return { p, earns, deds };
  });

  const rows: SalaryDetailedRow[] = parsed.map(({ p, earns, deds }) => {
    const earnings: Record<string, number> = {};
    const deductions: Record<string, number> = {};
    earns.forEach((c) => { earnings[c.code] = (earnings[c.code] ?? 0) + c.amount; });
    deds.forEach((c) => { deductions[c.code] = (deductions[c.code] ?? 0) + c.amount; });
    return {
      employeeId: p.employeeId,
      empCode: p.empCodeSnap,
      name: p.nameSnap,
      paidDays: Number(p.paidDays),
      gross: Number(p.gross),
      net: Number(p.net),
      earnings,
      deductions,
    };
  });

  return {
    ...meta,
    earningColumns: [...earnCols.entries()].map(([code, name]) => ({ code, name })),
    deductionColumns: [...dedCols.entries()].map(([code, name]) => ({ code, name })),
    rows,
  };
}

// ============================================================
// 3. BANK STATEMENT / ADVICE — excludes on-hold payslips (held
//    salaries are never disbursed).
// ============================================================
export interface BankStatementRow {
  employeeId: string;
  empCode: string;
  name: string;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  net: number;
}
export interface BankStatement extends SalaryReportMeta {
  rows: BankStatementRow[];
  total: number;
  payableCount: number;
  heldCount: number; // rows excluded because they are on hold
  heldTotal: number;
}

export async function getBankStatement(input: {
  fy: string;
  month: number;
  includeDraft?: boolean;
}): Promise<BankStatement> {
  const u = await requireUser();
  const base: BankStatement = {
    ...emptyMeta(input.fy, input.month),
    rows: [], total: 0, payableCount: 0, heldCount: 0, heldTotal: 0,
  };
  if (!can(u?.role, "hr:payroll") || !input.fy || !input.month) return base;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    select: {
      label: true,
      status: true,
      payslips: {
        orderBy: { empCodeSnap: "asc" },
        select: {
          employeeId: true, empCodeSnap: true, nameSnap: true, net: true, onHold: true,
        },
      },
    },
  });
  if (!run) return base;

  const meta: SalaryReportMeta = {
    fy: input.fy, month: input.month, runExists: true,
    runStatus: run.status, runLabel: run.label, draftHidden: false,
  };
  if (!isFinalStatus(run.status) && !input.includeDraft) {
    return { ...base, ...meta, draftHidden: true };
  }

  // Bank details live on EmployeeStatutory (account encrypted, IFSC plain).
  // We decrypt server-side ONLY to mask — masked value is what leaves the server.
  const empIds = run.payslips.map((p) => p.employeeId);
  const statutory = empIds.length
    ? await prisma.employeeStatutory.findMany({
        where: { employeeId: { in: empIds } },
        select: { employeeId: true, bankAccountEnc: true, bankIfsc: true },
      })
    : [];
  const bankByEmp = new Map(statutory.map((s) => [s.employeeId, s]));

  const held = run.payslips.filter((p) => p.onHold);
  // EXCLUDE on-hold payslips — held salaries are not disbursed to the bank.
  const rows: BankStatementRow[] = run.payslips
    .filter((p) => !p.onHold)
    .map((p) => {
      const bank = bankByEmp.get(p.employeeId);
      return {
        employeeId: p.employeeId,
        empCode: p.empCodeSnap,
        name: p.nameSnap,
        bankAccountMasked: maskAccount(decryptField(bank?.bankAccountEnc)),
        bankIfsc: bank?.bankIfsc ?? null,
        net: Number(p.net),
      };
    });

  return {
    ...meta,
    rows,
    total: rows.reduce((s, r) => s + r.net, 0),
    payableCount: rows.length,
    heldCount: held.length,
    heldTotal: held.reduce((s, p) => s + Number(p.net), 0),
  };
}

// ============================================================
// 4. CTC SHEET — gross + employer contribution legs + CTC.
// ============================================================
export interface CtcSheetRow {
  employeeId: string;
  empCode: string;
  name: string;
  gross: number;
  employerPf: number; // eps + epf
  employerEps: number;
  employerEpf: number;
  employerEsi: number;
  employerEdli: number;
  employerPfAdmin: number;
  gratuityAccrued: number;
  employerCost: number;
  ctc: number;
}
export interface CtcSheet extends SalaryReportMeta {
  rows: CtcSheetRow[];
  totals: {
    headcount: number;
    gross: number;
    employerPf: number;
    employerEps: number;
    employerEpf: number;
    employerEsi: number;
    employerEdli: number;
    employerPfAdmin: number;
    gratuityAccrued: number;
    employerCost: number;
    ctc: number;
  };
}

export async function getCtcSheet(input: {
  fy: string;
  month: number;
  includeDraft?: boolean;
}): Promise<CtcSheet> {
  const u = await requireUser();
  const base: CtcSheet = {
    ...emptyMeta(input.fy, input.month),
    rows: [],
    totals: {
      headcount: 0, gross: 0, employerPf: 0, employerEps: 0, employerEpf: 0,
      employerEsi: 0, employerEdli: 0, employerPfAdmin: 0, gratuityAccrued: 0,
      employerCost: 0, ctc: 0,
    },
  };
  if (!can(u?.role, "hr:payroll") || !input.fy || !input.month) return base;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    select: {
      label: true,
      status: true,
      payslips: {
        orderBy: { empCodeSnap: "asc" },
        select: {
          employeeId: true, empCodeSnap: true, nameSnap: true, gross: true,
          employerPf: true, employerEps: true, employerEpf: true,
          employerEsi: true, employerEdli: true, employerPfAdmin: true,
          gratuityAccrued: true, employerCost: true, ctc: true,
        },
      },
    },
  });
  if (!run) return base;

  const meta: SalaryReportMeta = {
    fy: input.fy, month: input.month, runExists: true,
    runStatus: run.status, runLabel: run.label, draftHidden: false,
  };
  if (!isFinalStatus(run.status) && !input.includeDraft) {
    return { ...base, ...meta, draftHidden: true };
  }

  const rows: CtcSheetRow[] = run.payslips.map((p) => ({
    employeeId: p.employeeId,
    empCode: p.empCodeSnap,
    name: p.nameSnap,
    gross: Number(p.gross),
    employerPf: Number(p.employerPf),
    employerEps: Number(p.employerEps),
    employerEpf: Number(p.employerEpf),
    employerEsi: Number(p.employerEsi),
    employerEdli: Number(p.employerEdli),
    employerPfAdmin: Number(p.employerPfAdmin),
    gratuityAccrued: Number(p.gratuityAccrued),
    employerCost: Number(p.employerCost),
    ctc: Number(p.ctc),
  }));

  const totals = rows.reduce(
    (t, r) => ({
      headcount: t.headcount + 1,
      gross: t.gross + r.gross,
      employerPf: t.employerPf + r.employerPf,
      employerEps: t.employerEps + r.employerEps,
      employerEpf: t.employerEpf + r.employerEpf,
      employerEsi: t.employerEsi + r.employerEsi,
      employerEdli: t.employerEdli + r.employerEdli,
      employerPfAdmin: t.employerPfAdmin + r.employerPfAdmin,
      gratuityAccrued: t.gratuityAccrued + r.gratuityAccrued,
      employerCost: t.employerCost + r.employerCost,
      ctc: t.ctc + r.ctc,
    }),
    {
      headcount: 0, gross: 0, employerPf: 0, employerEps: 0, employerEpf: 0,
      employerEsi: 0, employerEdli: 0, employerPfAdmin: 0, gratuityAccrued: 0,
      employerCost: 0, ctc: 0,
    },
  );

  return { ...meta, rows, totals };
}

// ============================================================
// 5. SALARY SUMMARY — run totals (single row of aggregates).
// ============================================================
export interface SalarySummary extends SalaryReportMeta {
  headcount: number;
  totalGross: number;
  pfEmployee: number;
  pfEmployer: number;
  pfTotal: number;
  esiEmployee: number;
  esiEmployer: number;
  esiTotal: number;
  totalTds: number;
  totalNet: number;
  totalEmployerCost: number;
  totalCtc: number;
}

export async function getSalarySummary(input: {
  fy: string;
  month: number;
  includeDraft?: boolean;
}): Promise<SalarySummary> {
  const u = await requireUser();
  const base: SalarySummary = {
    ...emptyMeta(input.fy, input.month),
    headcount: 0, totalGross: 0, pfEmployee: 0, pfEmployer: 0, pfTotal: 0,
    esiEmployee: 0, esiEmployer: 0, esiTotal: 0, totalTds: 0, totalNet: 0,
    totalEmployerCost: 0, totalCtc: 0,
  };
  if (!can(u?.role, "hr:payroll") || !input.fy || !input.month) return base;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    select: {
      label: true,
      status: true,
      payslips: {
        select: {
          gross: true, pf: true, employerPf: true, esi: true, employerEsi: true,
          tds: true, net: true, employerCost: true, ctc: true,
        },
      },
    },
  });
  if (!run) return base;

  const meta: SalaryReportMeta = {
    fy: input.fy, month: input.month, runExists: true,
    runStatus: run.status, runLabel: run.label, draftHidden: false,
  };
  if (!isFinalStatus(run.status) && !input.includeDraft) {
    return { ...base, ...meta, draftHidden: true };
  }

  const agg = run.payslips.reduce(
    (t, p) => ({
      headcount: t.headcount + 1,
      totalGross: t.totalGross + Number(p.gross),
      pfEmployee: t.pfEmployee + Number(p.pf),
      pfEmployer: t.pfEmployer + Number(p.employerPf),
      esiEmployee: t.esiEmployee + Number(p.esi),
      esiEmployer: t.esiEmployer + Number(p.employerEsi),
      totalTds: t.totalTds + Number(p.tds),
      totalNet: t.totalNet + Number(p.net),
      totalEmployerCost: t.totalEmployerCost + Number(p.employerCost),
      totalCtc: t.totalCtc + Number(p.ctc),
    }),
    {
      headcount: 0, totalGross: 0, pfEmployee: 0, pfEmployer: 0, esiEmployee: 0,
      esiEmployer: 0, totalTds: 0, totalNet: 0, totalEmployerCost: 0, totalCtc: 0,
    },
  );

  return {
    ...meta,
    ...agg,
    pfTotal: agg.pfEmployee + agg.pfEmployer,
    esiTotal: agg.esiEmployee + agg.esiEmployer,
  };
}
