"use server";

// ============================================================
// BD Reports — row-level lists (pipeline, follow-ups, lost deals)
// ------------------------------------------------------------
// Complements acq-analytics.actions.ts (which returns aggregates). These return
// the detailed tables the BD reports show. Current-state lists (pipeline,
// follow-ups) are "now" snapshots; the lost list honours the date range.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { acqHasAnyAccess } from "@/lib/acq/rbac";
import { resolveBdRange, type BdRangeKey } from "@/lib/acq/analytics-range";
import { Prisma, type AcqDealStage } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireBd() {
  const session = await auth();
  const user = session?.user as { id: string; role?: string } | undefined;
  if (!user?.id || !acqHasAnyAccess(user.role)) return null;
  return user;
}

const STAGE_PROBABILITY: Record<string, number> = {
  QUALIFIED: 0.1, EVALUATION: 0.2, EVALUATION_COMPLETED: 0.3, PROPOSAL_SENT: 0.45,
  NEGOTIATION: 0.6, CONTRACT_SENT: 0.8, SIGNED: 0.95, WON: 1, LOST: 0, ON_HOLD: 0.15,
};
const ACTIVE_STAGES: AcqDealStage[] = ["QUALIFIED", "EVALUATION", "EVALUATION_COMPLETED", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_SENT", "SIGNED", "ON_HOLD"];

const STAGE_LABEL: Record<string, string> = {
  QUALIFIED: "Qualified", EVALUATION: "Evaluation", EVALUATION_COMPLETED: "Evaluation done",
  PROPOSAL_SENT: "Proposal sent", NEGOTIATION: "Negotiation", CONTRACT_SENT: "Contract sent",
  SIGNED: "Signed", WON: "Won", LOST: "Lost", ON_HOLD: "On hold",
};
const LOST_REASON_LABEL: Record<string, string> = {
  HIGH_COMMISSION: "High commission", COMPETITOR_SELECTED: "Competitor selected",
  WANTED_OUTRIGHT_RENT: "Wanted outright rent", LOCKIN_TOO_LONG: "Lock-in too long",
  BUDGET_PRICING: "Budget / pricing", NO_RESPONSE: "No response",
  VENUE_QUALITY_BELOW_STANDARD: "Venue quality below standard", OTHER: "Other",
};

const dealValue = (d: { projectedFeeValue: Prisma.Decimal | null; taFees: Prisma.Decimal | null }) =>
  Number(d.projectedFeeValue ?? d.taFees ?? 0) || 0;

interface ReportParams { rangeKey?: BdRangeKey; from?: string | null; to?: string | null; employeeIds?: string[] | null }

// ------------------------------------------------------------
// Active pipeline (deal tracker)
// ------------------------------------------------------------
export async function getBdPipeline(params: { employeeIds?: string[] | null }): Promise<Result<unknown>> {
  const user = await requireBd();
  if (!user) return { success: false, error: "Unauthorized" };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;

  const deals = await prisma.acqDeal.findMany({
    where: { deletedAt: null, stage: { in: ACTIVE_STAGES }, ...(empIds ? { bdExecutiveId: { in: empIds } } : {}) },
    select: {
      id: true, name: true, ownerName: true, propertyType: true, city: true,
      seatingTheatre: true, seatingFloating: true, stage: true, expectedCloseDate: true,
      projectedFeeValue: true, taFees: true, updatedAt: true,
      bdExecutive: { select: { name: true } },
      lead: { select: { mobilePrimary: true, email: true, nextFollowupAt: true, firstContactAt: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const rows = deals.map((d) => {
    const prob = STAGE_PROBABILITY[d.stage] ?? 0;
    const value = dealValue(d);
    return {
      id: d.id, name: d.name, client: d.ownerName, contact: d.lead?.mobilePrimary ?? "—",
      propertyType: d.propertyType, city: d.city,
      seating: d.seatingTheatre ?? d.seatingFloating ?? null,
      stage: d.stage, stageLabel: STAGE_LABEL[d.stage] ?? d.stage,
      owner: d.bdExecutive?.name ?? "—",
      expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString() : null,
      lastContact: d.lead?.firstContactAt ? d.lead.firstContactAt.toISOString() : null,
      nextFollowup: d.lead?.nextFollowupAt ? d.lead.nextFollowupAt.toISOString() : null,
      probability: Math.round(prob * 100),
      value, weightedValue: Math.round(value * prob),
    };
  });

  const totalWeighted = rows.reduce((s, r) => s + r.weightedValue, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  return { success: true, data: { rows, totalWeighted, totalValue, count: rows.length } };
}

// ------------------------------------------------------------
// Follow-up & activity tracker (now-based snapshots)
// ------------------------------------------------------------
export async function getBdFollowupTracker(params: { employeeIds?: string[] | null }): Promise<Result<unknown>> {
  const user = await requireBd();
  if (!user) return { success: false, error: "Unauthorized" };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;
  const emp = empIds ? { bdExecutiveId: { in: empIds } } : {};
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [overdue, dueSoon, atRisk] = await Promise.all([
    // Overdue follow-ups: nextFollowupAt in the past, lead still open
    prisma.acqLead.findMany({
      where: { deletedAt: null, status: { in: ["NEW", "CONTACTED"] }, nextFollowupAt: { lt: now }, ...emp },
      select: { id: true, ownerName: true, propertyName: true, mobilePrimary: true, nextFollowupAt: true, bdExecutive: { select: { name: true } } },
      orderBy: { nextFollowupAt: "asc" }, take: 200,
    }),
    // Due in next 24h
    prisma.acqLead.findMany({
      where: { deletedAt: null, status: { in: ["NEW", "CONTACTED"] }, nextFollowupAt: { gte: now, lte: in24h }, ...emp },
      select: { id: true, ownerName: true, propertyName: true, mobilePrimary: true, nextFollowupAt: true, bdExecutive: { select: { name: true } } },
      orderBy: { nextFollowupAt: "asc" }, take: 200,
    }),
    // At-risk: open leads with no activity in 7+ days
    prisma.acqLead.findMany({
      where: {
        deletedAt: null, status: { in: ["NEW", "CONTACTED"] }, createdAt: { lt: sevenDaysAgo },
        activities: { none: { createdAt: { gte: sevenDaysAgo } } }, ...emp,
      },
      select: { id: true, ownerName: true, propertyName: true, mobilePrimary: true, createdAt: true, firstContactAt: true, bdExecutive: { select: { name: true } } },
      orderBy: { createdAt: "asc" }, take: 200,
    }),
  ]);

  const map = (l: { id: string; ownerName: string; propertyName: string; mobilePrimary: string; nextFollowupAt?: Date | null; createdAt?: Date; bdExecutive: { name: string | null } | null }) => ({
    id: l.id, client: l.ownerName, property: l.propertyName, contact: l.mobilePrimary,
    when: (l.nextFollowupAt ?? l.createdAt)?.toISOString() ?? null,
    owner: l.bdExecutive?.name ?? "—",
  });

  return {
    success: true,
    data: { overdue: overdue.map(map), dueSoon: dueSoon.map(map), atRisk: atRisk.map(map),
      counts: { overdue: overdue.length, dueSoon: dueSoon.length, atRisk: atRisk.length } },
  };
}

// ------------------------------------------------------------
// Lost-deal analysis (range list + 6-month win-rate trend)
// ------------------------------------------------------------
export async function getBdLostAnalysis(params: ReportParams): Promise<Result<unknown>> {
  const user = await requireBd();
  if (!user) return { success: false, error: "Unauthorized" };
  const range = resolveBdRange(params.rangeKey ?? "month", params.from, params.to);
  const empIds = params.employeeIds?.length ? params.employeeIds : null;
  const emp = empIds ? { bdExecutiveId: { in: empIds } } : {};

  const lost = await prisma.acqDeal.findMany({
    where: { deletedAt: null, stage: "LOST", updatedAt: { gte: range.start, lte: range.end }, ...emp },
    select: {
      id: true, name: true, ownerName: true, city: true, lostReason: true,
      projectedFeeValue: true, taFees: true, updatedAt: true, bdExecutive: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" }, take: 500,
  });

  const rows = lost.map((d) => ({
    id: d.id, name: d.name, client: d.ownerName, city: d.city,
    reason: d.lostReason ?? "OTHER", reasonLabel: LOST_REASON_LABEL[d.lostReason ?? "OTHER"],
    value: dealValue(d), owner: d.bdExecutive?.name ?? "—", lostOn: d.updatedAt.toISOString(),
  }));

  // 6-month win-rate trend (won vs lost by wonAt/updatedAt month) — ignores the
  // range so the trend line always shows recent history.
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [wonRecent, lostRecent] = await Promise.all([
    prisma.acqDeal.findMany({ where: { deletedAt: null, stage: "WON", wonAt: { gte: sixMonthsAgo }, ...emp }, select: { wonAt: true } }),
    prisma.acqDeal.findMany({ where: { deletedAt: null, stage: "LOST", updatedAt: { gte: sixMonthsAgo }, ...emp }, select: { updatedAt: true } }),
  ]);
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const trendMap = new Map<string, { won: number; lost: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    trendMap.set(monthKey(d), { won: 0, lost: 0 });
  }
  for (const w of wonRecent) if (w.wonAt) { const k = monthKey(w.wonAt); const e = trendMap.get(k); if (e) e.won++; }
  for (const l of lostRecent) { const k = monthKey(l.updatedAt); const e = trendMap.get(k); if (e) e.lost++; }
  const trend = [...trendMap.entries()].map(([month, v]) => ({
    month, won: v.won, lost: v.lost,
    winRate: v.won + v.lost ? Math.round((v.won / (v.won + v.lost)) * 100) : 0,
  }));

  const byReason = new Map<string, { count: number; value: number }>();
  for (const r of rows) { const c = byReason.get(r.reason) ?? { count: 0, value: 0 }; c.count++; c.value += r.value; byReason.set(r.reason, c); }
  const reasons = [...byReason.entries()]
    .map(([reason, v]) => ({ reason, label: LOST_REASON_LABEL[reason] ?? reason, count: v.count, value: v.value }))
    .sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: { rows, reasons, trend, totalCount: rows.length, totalValue: rows.reduce((s, r) => s + r.value, 0), range: { label: range.label } },
  };
}
