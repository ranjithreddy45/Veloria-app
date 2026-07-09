"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Statutory registers — the monthly PF/ESI/PT/TDS challan register
// (what HR files from) plus a per-employee FY TDS summary for Form-16.
// Guarded by hr:payroll. Read-only (no persistence).
// ============================================================

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

export interface StatutoryRegisterRow {
  employeeId: string;
  empCode: string;
  name: string;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  net: number;
}
export interface StatutoryRegister {
  fy: string;
  month: number;
  runLabel: string | null;
  runStatus: string | null;
  rows: StatutoryRegisterRow[];
  totals: { gross: number; pf: number; esi: number; pt: number; tds: number; net: number; headcount: number };
}

// ------------------------------------------------------------
// getStatutoryRegister — per-employee + totals for a run month.
// ------------------------------------------------------------
export async function getStatutoryRegister(input: {
  fy: string;
  month: number;
}): Promise<StatutoryRegister> {
  const u = await requireUser();
  const empty: StatutoryRegister = {
    fy: input.fy,
    month: input.month,
    runLabel: null,
    runStatus: null,
    rows: [],
    totals: { gross: 0, pf: 0, esi: 0, pt: 0, tds: 0, net: 0, headcount: 0 },
  };
  if (!can(u?.role, "hr:payroll")) return empty;
  if (!input.fy || !input.month) return empty;

  const run = await prisma.hrPayrollRun.findFirst({
    where: { fy: input.fy, month: input.month },
    include: {
      payslips: {
        orderBy: { empCodeSnap: "asc" },
        select: {
          employeeId: true,
          empCodeSnap: true,
          nameSnap: true,
          gross: true,
          pf: true,
          esi: true,
          pt: true,
          tds: true,
          net: true,
        },
      },
    },
  });
  if (!run) return empty;

  const rows: StatutoryRegisterRow[] = run.payslips.map((p) => ({
    employeeId: p.employeeId,
    empCode: p.empCodeSnap,
    name: p.nameSnap,
    gross: Number(p.gross),
    pf: Number(p.pf),
    esi: Number(p.esi),
    pt: Number(p.pt),
    tds: Number(p.tds),
    net: Number(p.net),
  }));

  const totals = rows.reduce(
    (t, r) => ({
      gross: t.gross + r.gross,
      pf: t.pf + r.pf,
      esi: t.esi + r.esi,
      pt: t.pt + r.pt,
      tds: t.tds + r.tds,
      net: t.net + r.net,
      headcount: t.headcount + 1,
    }),
    { gross: 0, pf: 0, esi: 0, pt: 0, tds: 0, net: 0, headcount: 0 },
  );

  return { fy: input.fy, month: input.month, runLabel: run.label, runStatus: run.status, rows, totals };
}

/** Distinct FY + month options that actually have payroll runs (for pickers). */
export async function listPayrollRunPeriods() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const runs = await prisma.hrPayrollRun.findMany({
    orderBy: [{ fy: "desc" }, { month: "desc" }],
    select: { fy: true, month: true, label: true, status: true, headcount: true },
  });
  return runs;
}

export interface EmployeeTdsSummary {
  employeeId: string;
  fy: string;
  found: boolean;
  months: number; // number of payslips counted in the FY
  grossTotal: number;
  pfTotal: number;
  ptTotal: number;
  tdsTotal: number;
}

// ------------------------------------------------------------
// getEmployeeTdsSummary — FY gross/TDS totals for Form-16 Part B.
// ------------------------------------------------------------
export async function getEmployeeTdsSummary(
  employeeId: string,
  fy: string,
): Promise<EmployeeTdsSummary> {
  const u = await requireUser();
  const empty: EmployeeTdsSummary = {
    employeeId,
    fy,
    found: false,
    months: 0,
    grossTotal: 0,
    pfTotal: 0,
    ptTotal: 0,
    tdsTotal: 0,
  };
  if (!can(u?.role, "hr:payroll")) return empty;
  if (!employeeId || !fy) return empty;

  const slips = await prisma.hrPayslip.findMany({
    where: { employeeId, run: { fy } },
    select: { gross: true, pf: true, pt: true, tds: true },
  });
  if (slips.length === 0) return empty;

  const totals = slips.reduce(
    (t, s) => ({
      grossTotal: t.grossTotal + Number(s.gross),
      pfTotal: t.pfTotal + Number(s.pf),
      ptTotal: t.ptTotal + Number(s.pt),
      tdsTotal: t.tdsTotal + Number(s.tds),
    }),
    { grossTotal: 0, pfTotal: 0, ptTotal: 0, tdsTotal: 0 },
  );

  return {
    employeeId,
    fy,
    found: true,
    months: slips.length,
    grossTotal: Math.round(totals.grossTotal),
    pfTotal: Math.round(totals.pfTotal),
    ptTotal: Math.round(totals.ptTotal),
    tdsTotal: Math.round(totals.tdsTotal),
  };
}
