"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { getKraTemplate, type KraRole } from "@/lib/kra/templates";
import { computeScorecard, type KraMetricValue } from "@/lib/kra/scoring";
import { resolveAutoMetrics } from "@/lib/kra/auto-metrics";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Managers who can create/evaluate scorecards. Sales Head/GM aren't distinct
// roles in this app, so admins + BD Head + HR manager hold the evaluator seat.
const KRA_MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "BD_HEAD", "SALES_HEAD", "HR_MANAGER"];
const SALES_ROLES = ["SALES_EXEC", "BD_EXECUTIVE"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canManage = (r?: string) => !!r && KRA_MANAGE_ROLES.includes(r);

// Derive the metrics map the engine scores from: auto snapshot + manual entries
// + payment_full_pct (gate input) derived from the A3 Accounts-attested band.
function buildMetrics(role: string, auto: Record<string, unknown>, manual: Record<string, unknown>): Record<string, KraMetricValue> {
  const merged: Record<string, KraMetricValue> = { ...(auto as Record<string, KraMetricValue>), ...(manual as Record<string, KraMetricValue>) };
  if (role === "CORPORATE_SALES" || role === "INSIDE_SALES") {
    const a3 = manual["A3"];
    // Only ALL_ON_TIME reflects true 100% pre-event on-time collection; any
    // recovered/balance band must fall below the gate threshold.
    if (a3 !== undefined && a3 !== null && a3 !== "") merged["payment_full_pct"] = a3 === "ALL_ON_TIME" ? 100 : 0;
  }
  return merged;
}

function recompute(role: string, rampMonth: number, auto: Record<string, unknown>, manual: Record<string, unknown>) {
  const template = getKraTemplate(role)!;
  const metrics = buildMetrics(role, auto, manual);
  return computeScorecard(template, metrics, rampMonth);
}

async function userName(id: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return u?.name || u?.email || "Employee";
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getKraEmployees(): Promise<Result<{ id: string; name: string; role: string }[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canManage(u.role)) return { success: false, error: "Not authorized" };
  const rows = await prisma.user.findMany({
    where: { isActive: true, role: { in: SALES_ROLES as unknown as never } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name || r.email || "—", role: r.role as string })) };
}

type ScorecardDTO = ReturnType<typeof toDTO>;
function toDTO(s: {
  id: string; employeeId: string; role: string; period: string; rampMonth: number; status: string;
  autoMetrics: unknown; manualEntries: unknown; lineItems: unknown; gateDetail: unknown;
  totalScore: number; totalMax: number; gatePassed: boolean; band: string | null; basePct: number;
  multiplierFactor: number | null; finalPayoutPct: number; managerNote: string | null;
  submittedAt: Date | null; acknowledgedAt: Date | null; updatedAt: Date;
}, employeeName?: string) {
  return {
    id: s.id, employeeId: s.employeeId, employeeName: employeeName ?? null, role: s.role, period: s.period,
    rampMonth: s.rampMonth, status: s.status,
    autoMetrics: s.autoMetrics as Record<string, number | null>,
    manualEntries: s.manualEntries as Record<string, string | number>,
    lineItems: s.lineItems as unknown[],
    gateDetail: s.gateDetail as unknown,
    totalScore: s.totalScore, totalMax: s.totalMax, gatePassed: s.gatePassed, band: s.band,
    basePct: s.basePct, multiplierFactor: s.multiplierFactor, finalPayoutPct: s.finalPayoutPct,
    managerNote: s.managerNote, submittedAt: s.submittedAt?.toISOString() ?? null,
    acknowledgedAt: s.acknowledgedAt?.toISOString() ?? null, updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getKraScorecard(id: string): Promise<Result<ScorecardDTO>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const s = await prisma.kraScorecard.findUnique({ where: { id } });
  if (!s) return { success: false, error: "Scorecard not found" };
  if (!canManage(u.role) && s.employeeId !== u.id) return { success: false, error: "Not authorized" };
  return { success: true, data: toDTO(s, await userName(s.employeeId)) };
}

export async function listKraScorecards(opts?: { period?: string }): Promise<Result<ScorecardDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const where: Record<string, unknown> = {};
  if (opts?.period) where.period = opts.period;
  if (!canManage(u.role)) where.employeeId = u.id; // reps see only their own
  const rows = await prisma.kraScorecard.findMany({ where, orderBy: [{ period: "desc" }, { totalScore: "desc" }] });
  const names = new Map<string, string>();
  for (const r of rows) if (!names.has(r.employeeId)) names.set(r.employeeId, await userName(r.employeeId));
  return { success: true, data: rows.map((r) => toDTO(r, names.get(r.employeeId))) };
}

// ------------------------------------------------------------
// Generate / recompute (manager)
// ------------------------------------------------------------
export async function generateKraScorecard(input: { employeeId: string; role: string; period: string; rampMonth?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canManage(u.role)) return { success: false, error: "Not authorized" };
  const template = getKraTemplate(input.role);
  if (!template) return { success: false, error: "Unknown KRA role" };
  if (!/^\d{4}-\d{2}$/.test(input.period)) return { success: false, error: "Period must be YYYY-MM" };

  const existing = await prisma.kraScorecard.findUnique({ where: { employeeId_period: { employeeId: input.employeeId, period: input.period } } });
  if (existing) return { success: true, data: { id: existing.id } }; // idempotent — open the existing one

  const ramp = input.rampMonth ?? 3;
  const auto = await resolveAutoMetrics(input.employeeId, input.role as KraRole, input.period);
  const manual: Record<string, unknown> = {};
  const r = recompute(input.role, ramp, auto, manual);

  const created = await prisma.kraScorecard.create({
    data: {
      employeeId: input.employeeId, role: input.role, period: input.period, rampMonth: ramp, status: "DRAFT",
      autoMetrics: auto as object, manualEntries: manual as object, lineItems: r.lineItems as object, gateDetail: r.gate as object,
      totalScore: r.totalScore, totalMax: r.totalMax, gatePassed: r.gate.passed, band: r.band.grade,
      basePct: r.band.basePct, multiplierFactor: r.multiplier?.factor ?? null, finalPayoutPct: r.finalPayoutPct,
      createdById: u.id,
    },
    select: { id: true },
  });
  revalidatePath("/performance/kra");
  return { success: true, data: { id: created.id } };
}

export async function recomputeKraAuto(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canManage(u.role)) return { success: false, error: "Not authorized" };
  const s = await prisma.kraScorecard.findUnique({ where: { id } });
  if (!s) return { success: false, error: "Scorecard not found" };
  if (s.status === "ACKNOWLEDGED") return { success: false, error: "An acknowledged scorecard is locked." };
  const auto = await resolveAutoMetrics(s.employeeId, s.role as KraRole, s.period);
  const r = recompute(s.role, s.rampMonth, auto, s.manualEntries as Record<string, unknown>);
  await persist(id, auto, s.manualEntries as Record<string, unknown>, r);
  revalidatePath(`/performance/kra/${id}`);
  return { success: true, data: { id } };
}

export async function saveKraManualEntries(id: string, entries: Record<string, string | number>, managerNote?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canManage(u.role)) return { success: false, error: "Not authorized" };
  const s = await prisma.kraScorecard.findUnique({ where: { id } });
  if (!s) return { success: false, error: "Scorecard not found" };
  if (s.status === "ACKNOWLEDGED") return { success: false, error: "An acknowledged scorecard is locked." };
  // Re-resolve auto metrics fresh so newly-added gates/KPIs (e.g. the quality
  // defect-free gate) are always present — a stale persisted snapshot could be
  // missing keys and spuriously fail the gate.
  const auto = await resolveAutoMetrics(s.employeeId, s.role as KraRole, s.period);
  const merged = { ...(s.manualEntries as Record<string, unknown>), ...entries };
  const r = recompute(s.role, s.rampMonth, auto, merged);
  await persist(id, auto, merged, r, managerNote);
  revalidatePath(`/performance/kra/${id}`);
  return { success: true, data: { id } };
}

async function persist(id: string, auto: Record<string, unknown>, manual: Record<string, unknown>, r: ReturnType<typeof computeScorecard>, managerNote?: string) {
  await prisma.kraScorecard.update({
    where: { id },
    data: {
      autoMetrics: auto as object, manualEntries: manual as object, lineItems: r.lineItems as object, gateDetail: r.gate as object,
      totalScore: r.totalScore, totalMax: r.totalMax, gatePassed: r.gate.passed, band: r.band.grade,
      basePct: r.band.basePct, multiplierFactor: r.multiplier?.factor ?? null, finalPayoutPct: r.finalPayoutPct,
      ...(managerNote !== undefined ? { managerNote: managerNote || null } : {}),
    },
  });
}

// ------------------------------------------------------------
// Lifecycle
// ------------------------------------------------------------
export async function submitKraScorecard(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canManage(u.role)) return { success: false, error: "Not authorized" };
  const s = await prisma.kraScorecard.findUnique({ where: { id } });
  if (!s) return { success: false, error: "Scorecard not found" };
  if (s.status !== "DRAFT") return { success: false, error: "Only a draft can be submitted." };
  await prisma.kraScorecard.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  notify({ userId: s.employeeId, type: "SYSTEM", title: "Your KRA scorecard is ready", message: `${s.period}: score ${s.totalScore}/100, grade ${s.band ?? "—"}. Please review & acknowledge.`, actionUrl: `/performance/kra/${id}` });
  revalidatePath(`/performance/kra/${id}`);
  revalidatePath("/performance/kra");
  return { success: true, data: { id } };
}

export async function acknowledgeKraScorecard(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const s = await prisma.kraScorecard.findUnique({ where: { id } });
  if (!s) return { success: false, error: "Scorecard not found" };
  if (s.employeeId !== u.id) return { success: false, error: "Only the employee can acknowledge their own scorecard." };
  if (s.status !== "SUBMITTED") return { success: false, error: "Only a submitted scorecard can be acknowledged." };
  await prisma.kraScorecard.update({ where: { id }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
  revalidatePath(`/performance/kra/${id}`);
  revalidatePath("/performance/kra");
  return { success: true, data: { id } };
}
