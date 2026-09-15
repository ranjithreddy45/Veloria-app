"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { decryptField } from "@/lib/hr/crypto";
import { resolveStatConfig } from "@/lib/hr/stat-config";
import { DEFAULT_STAT_CONFIG, type StatConfig } from "@/lib/hr/payroll-calc";
import {
  buildPfEcrFile,
  buildEsiReturnFile,
  buildTds24qFile,
  quarterMonths,
  calendarYearFor,
  type ExportFile,
  type EcrMemberInput,
  type EsiMemberInput,
  type TdsMonthInput,
} from "@/lib/hr/statutory-exports";

// ============================================================
// Statutory FILING exports — PF ECR, ESI monthly contribution, TDS 24Q helper.
// ------------------------------------------------------------
// Reads ONLY finalised (LOCKED / PAID) payroll runs: a draft can still change,
// and a filed return must tie to frozen payslips. All formatting lives in the
// pure lib (src/lib/hr/statutory-exports.ts); this layer resolves the data,
// applies per-entity statutory config, and decrypts PAN — the one encrypted
// field these files need — strictly inside the action, never on the client.
// Every export writes an activity-log row (bulk PII leaves the system).
// Guarded by hr:payroll.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const FINAL_STATUSES = ["LOCKED", "PAID"] as const;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

function validFy(fy: unknown): fy is string {
  return typeof fy === "string" && /^\d{4}-\d{2}$/.test(fy);
}
function validMonth(m: unknown): m is number {
  return Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12;
}

/** Amount of a coded earnings line frozen on a payslip (0 when absent). */
function lineAmount(earnings: unknown, code: string): number {
  if (!Array.isArray(earnings)) return 0;
  const hit = (earnings as { code?: string; amount?: unknown }[]).find((l) => l?.code === code);
  return Number(hit?.amount ?? 0) || 0;
}

/** Sum of EARNING lines on a salary structure = FULL contractual monthly gross. */
function structureGross(lines: unknown): number {
  if (!Array.isArray(lines)) return 0;
  return (lines as { kind?: string; monthly?: unknown }[])
    .filter((l) => l?.kind === "EARNING")
    .reduce((s, l) => s + (Number(l.monthly ?? 0) || 0), 0);
}

/**
 * Locate the finalised run for a period. Distinguishes "still DRAFT" from
 * "no run at all" so HR gets an actionable message.
 */
async function findFinalRun(fy: string, month: number) {
  const runs = await prisma.hrPayrollRun.findMany({
    where: { fy, month },
    select: { id: true, label: true, status: true },
  });
  const final = runs.find((r) => (FINAL_STATUSES as readonly string[]).includes(r.status));
  if (final) return { run: final, error: null as string | null };
  const label = `${MONTH_ABBR[month - 1]} ${calendarYearFor(fy, month)}`;
  if (runs.length > 0)
    return { run: null, error: `The ${label} payroll run is still DRAFT — lock it before exporting a return.` };
  return { run: null, error: `No payroll run exists for ${label}.` };
}

/** Employee master + statutory IDs for a set of payslips, keyed by employeeId. */
async function loadEmployees(employeeIds: string[]) {
  const rows = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      legalEntityId: true,
      dateOfExit: true,
      statutory: { select: { uan: true, esi: true, panEnc: true } },
    },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

/** Statutory config per legal entity, resolved once each (code defaults when unset). */
async function loadConfigs(entityIds: (string | null | undefined)[]) {
  const map = new Map<string, StatConfig>();
  for (const id of new Set(entityIds.filter((x): x is string => !!x))) {
    map.set(id, (await resolveStatConfig(id)).cfg);
  }
  return (entityId: string | null | undefined): StatConfig =>
    (entityId && map.get(entityId)) || DEFAULT_STAT_CONFIG;
}

/** Best-effort audit trail — a filing export is a bulk statutory-ID reveal. */
async function logExport(userId: string, kind: string, entityId: string, meta: Record<string, unknown>) {
  try {
    await prisma.activityLog.create({
      data: { action: "STATUTORY_EXPORTED", entityType: "PAYROLL_RUN", entityId, changes: { kind, ...meta }, userId },
    });
  } catch (err) {
    console.error("[STATUTORY_EXPORT_LOG_ERR]", err);
  }
}

// ------------------------------------------------------------
// 1) PF ECR text file
// ------------------------------------------------------------
export async function buildPfEcr(input: { fy: string; month: number }): Promise<Result<ExportFile>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  const month = Number(input?.month);
  if (!validFy(input?.fy) || !validMonth(month)) return { success: false, error: "Pick a valid financial year and month." };
  const fy = input.fy;

  const { run, error } = await findFinalRun(fy, month);
  if (!run) return { success: false, error: error ?? "Payroll run not found." };

  const slips = await prisma.hrPayslip.findMany({
    where: { runId: run.id },
    orderBy: { empCodeSnap: "asc" },
    select: {
      employeeId: true,
      empCodeSnap: true,
      nameSnap: true,
      gross: true,
      earnings: true,
      lopDays: true,
      pf: true,
      employerEps: true,
      employerEpf: true,
    },
  });
  if (slips.length === 0) return { success: false, error: `${run.label} has no payslips.` };

  const emps = await loadEmployees(slips.map((s) => s.employeeId));
  const cfgFor = await loadConfigs([...emps.values()].map((e) => e.legalEntityId));

  // PF-applicable arrears paid in THIS run fold into the PF wage base before the
  // ceiling (exactly as computePayslip did), so EPF wages reconcile to the
  // contribution frozen on the payslip.
  const arrears = await prisma.hrArrear.findMany({
    where: { runId: run.id, status: "PAID", pfApplicable: true },
    select: { employeeId: true, amount: true },
  });
  const pfArrearByEmp = new Map<string, number>();
  for (const a of arrears) pfArrearByEmp.set(a.employeeId, (pfArrearByEmp.get(a.employeeId) ?? 0) + Number(a.amount));

  const skipped: string[] = [];
  const members: (EcrMemberInput & { entityId: string | null })[] = [];
  for (const s of slips) {
    const e = emps.get(s.employeeId);
    const uan = e?.statutory?.uan ?? null;
    const pf = Number(s.pf);
    const erEps = Number(s.employerEps);
    const erEpf = Number(s.employerEpf);
    // No PF leg at all and no UAN → not a PF member (exempt / not enrolled).
    if (pf <= 0 && erEps <= 0 && erEpf <= 0 && !uan) {
      skipped.push(`${s.empCodeSnap} ${s.nameSnap}`);
      continue;
    }
    members.push({
      entityId: e?.legalEntityId ?? null,
      empCode: s.empCodeSnap,
      name: s.nameSnap,
      uan,
      grossWages: Number(s.gross),
      pfWageBase: lineAmount(s.earnings, "BASIC") + (pfArrearByEmp.get(s.employeeId) ?? 0),
      employeePf: pf,
      employerEps: erEps,
      employerEpf: erEpf,
      ncpDays: Number(s.lopDays),
      refundOfAdvances: 0,
    });
  }

  const file = buildPfEcrFile({
    fy,
    month,
    members,
    cfgFor: (m) => {
      const c = cfgFor((m as typeof members[number]).entityId);
      return {
        pfRatePct: c.pfRatePct,
        pfWageCeiling: c.pfWageCeiling,
        pfOnFullBasic: c.pfOnFullBasic,
        epsWageCeiling: c.epsWageCeiling,
        epsApplicable: c.epsApplicable,
        edliWageCeiling: c.edliWageCeiling,
      };
    },
  });
  if (skipped.length)
    file.warnings.push(`Not in the ECR (no PF contribution and no UAN — verify they are genuinely PF-exempt): ${skipped.join(", ")}.`);

  await logExport(u!.id, "PF_ECR", run.id, { fy, month, rows: file.rowCount });
  return { success: true, data: file };
}

// ------------------------------------------------------------
// 2) ESI monthly contribution upload
// ------------------------------------------------------------
export async function buildEsiReturn(input: { fy: string; month: number }): Promise<Result<ExportFile>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  const month = Number(input?.month);
  if (!validFy(input?.fy) || !validMonth(month)) return { success: false, error: "Pick a valid financial year and month." };
  const fy = input.fy;

  const { run, error } = await findFinalRun(fy, month);
  if (!run) return { success: false, error: error ?? "Payroll run not found." };

  const slips = await prisma.hrPayslip.findMany({
    where: { runId: run.id },
    orderBy: { empCodeSnap: "asc" },
    select: {
      employeeId: true,
      empCodeSnap: true,
      nameSnap: true,
      gross: true,
      earnings: true,
      paidDays: true,
      lopDays: true,
      esi: true,
      employerEsi: true,
    },
  });
  if (slips.length === 0) return { success: false, error: `${run.label} has no payslips.` };

  const emps = await loadEmployees(slips.map((s) => s.employeeId));
  const cfgFor = await loadConfigs([...emps.values()].map((e) => e.legalEntityId));

  // ESI-applicable arrears paid in this run are ESI wages (engine: esiBase = gross + arrEsi).
  const arrears = await prisma.hrArrear.findMany({
    where: { runId: run.id, status: "PAID", esiApplicable: true },
    select: { employeeId: true, amount: true },
  });
  const esiArrearByEmp = new Map<string, number>();
  for (const a of arrears) esiArrearByEmp.set(a.employeeId, (esiArrearByEmp.get(a.employeeId) ?? 0) + Number(a.amount));

  // Coverage is decided on the FULL contractual gross. Reconstruct it from the
  // paid/LOP split; for a zero-pay month fall back to the current structure.
  const zeroPayIds = slips.filter((s) => Number(s.paidDays) <= 0).map((s) => s.employeeId);
  const structGross = new Map<string, number>();
  if (zeroPayIds.length) {
    const structs = await prisma.hrSalaryStructure.findMany({
      where: { isCurrent: true, employeeId: { in: zeroPayIds } },
      select: { employeeId: true, lines: true },
    });
    for (const st of structs) structGross.set(st.employeeId, structureGross(st.lines));
  }

  const monthEnd = new Date(Date.UTC(calendarYearFor(fy, month), month, 0, 23, 59, 59));
  const members: (EsiMemberInput & { entityId: string | null })[] = slips.map((s) => {
    const e = emps.get(s.employeeId);
    const gross = Number(s.gross);
    const regularGross = gross - lineAmount(s.earnings, "ARREAR") - lineAmount(s.earnings, "REIMB");
    const paidDays = Number(s.paidDays);
    const base = paidDays + Number(s.lopDays);
    const eligibilityWage =
      paidDays > 0 && base > 0 ? (regularGross * base) / paidDays : (structGross.get(s.employeeId) ?? regularGross);
    const exit = e?.dateOfExit && e.dateOfExit <= monthEnd ? e.dateOfExit : null;
    return {
      entityId: e?.legalEntityId ?? null,
      empCode: s.empCodeSnap,
      name: s.nameSnap,
      ipNumber: e?.statutory?.esi ?? null,
      paidDays,
      esiWages: regularGross + (esiArrearByEmp.get(s.employeeId) ?? 0),
      eligibilityWage,
      employeeEsi: Number(s.esi),
      employerEsi: Number(s.employerEsi),
      lastWorkingDay: exit,
    };
  });

  const file = buildEsiReturnFile({
    fy,
    month,
    members,
    cfgFor: (m) => ({ esiGrossCeiling: cfgFor((m as typeof members[number]).entityId).esiGrossCeiling }),
  });

  await logExport(u!.id, "ESI_MC", run.id, { fy, month, rows: file.rowCount });
  return { success: true, data: file };
}

// ------------------------------------------------------------
// 3) TDS Form 24Q annexure helper (quarter)
// ------------------------------------------------------------
export async function buildTds24q(input: { fy: string; quarter: number }): Promise<Result<ExportFile>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  const quarter = Number(input?.quarter);
  if (!validFy(input?.fy) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4)
    return { success: false, error: "Pick a valid financial year and quarter (1–4)." };
  const fy = input.fy;
  const months = quarterMonths(quarter);

  const runs = await prisma.hrPayrollRun.findMany({
    where: { fy, month: { in: months } },
    orderBy: { month: "asc" },
    select: { id: true, month: true, label: true, status: true },
  });
  const finalRuns = runs.filter((r) => (FINAL_STATUSES as readonly string[]).includes(r.status));
  if (finalRuns.length === 0)
    return { success: false, error: `No finalised (locked/paid) payroll runs in FY ${fy} Q${quarter}.` };

  const slips = await prisma.hrPayslip.findMany({
    where: { runId: { in: finalRuns.map((r) => r.id) } },
    orderBy: [{ runId: "asc" }, { empCodeSnap: "asc" }],
    select: { runId: true, employeeId: true, empCodeSnap: true, nameSnap: true, gross: true, earnings: true, tds: true },
  });
  const emps = await loadEmployees([...new Set(slips.map((s) => s.employeeId))]);

  // PAN is encrypted at rest — decrypt here, once per employee, and hand the
  // plain value straight to the formatter. It is never returned separately.
  const panByEmp = new Map<string, string | null>();
  for (const [id, e] of emps) panByEmp.set(id, decryptField(e.statutory?.panEnc));

  const monthInputs: TdsMonthInput[] = finalRuns.map((r) => ({
    month: r.month,
    dateOfPayment: null, // the app does not record the actual credit date
    rows: slips
      .filter((s) => s.runId === r.id)
      .map((s) => ({
        empCode: s.empCodeSnap,
        name: s.nameSnap,
        pan: panByEmp.get(s.employeeId) ?? null,
        // Salary paid = gross less bill-backed reimbursements (not salary).
        amountPaid: Number(s.gross) - lineAmount(s.earnings, "REIMB"),
        tdsDeducted: Number(s.tds),
      })),
  }));

  const file = buildTds24qFile({ fy, quarter, months: monthInputs });
  for (const r of runs) {
    if (!(FINAL_STATUSES as readonly string[]).includes(r.status))
      file.warnings.unshift(`${r.label} is still DRAFT — excluded from the quarter; lock it and regenerate.`);
  }

  await logExport(u!.id, "TDS_24Q", finalRuns.map((r) => r.id).join(","), { fy, quarter, rows: file.rowCount });
  return { success: true, data: file };
}
