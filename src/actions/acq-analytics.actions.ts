"use server";

// ============================================================
// BD Analytics — dashboard + reports aggregation engine
// ------------------------------------------------------------
// One place that reads the Acq* models and returns every metric the BD
// dashboard and reports need, filtered by a resolved date range and an optional
// set of BD-executive ids. All money is returned as plain numbers (rupees).
// Additive: no schema change; reads existing data only.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { acqHasAnyAccess } from "@/lib/acq/rbac";
import { resolveBdRange, type BdRangeKey } from "@/lib/acq/analytics-range";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireBd() {
  const session = await auth();
  const user = session?.user as { id: string; role?: string } | undefined;
  if (!user?.id || !acqHasAnyAccess(user.role)) return null;
  return user;
}

// Lead sources bucketed into "campaign" (marketing-driven) vs "cold" (everything
// else). Not exported (use-server rule); surfaced via the returned data.
const CAMPAIGN_SOURCES = new Set(["WEBSITE", "SOCIAL_MEDIA"]);

// Win-probability by deal stage — drives the weighted pipeline forecast.
const STAGE_PROBABILITY: Record<string, number> = {
  QUALIFIED: 0.1,
  EVALUATION: 0.2,
  EVALUATION_COMPLETED: 0.3,
  PROPOSAL_SENT: 0.45,
  NEGOTIATION: 0.6,
  CONTRACT_SENT: 0.8,
  SIGNED: 0.95,
  WON: 1,
  LOST: 0,
  ON_HOLD: 0.15,
};

// Ordered funnel stages for the lead→win overview.
const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "siteVisit", label: "Site Visit Done" },
  { key: "proposal", label: "Proposal Sent" },
  { key: "negotiation", label: "Negotiation" },
  { key: "signed", label: "Agreement Signed" },
  { key: "won", label: "Won" },
];

const LOST_REASON_LABEL: Record<string, string> = {
  HIGH_COMMISSION: "High commission",
  COMPETITOR_SELECTED: "Competitor selected",
  WANTED_OUTRIGHT_RENT: "Wanted outright rent",
  LOCKIN_TOO_LONG: "Lock-in too long",
  BUDGET_PRICING: "Budget / pricing",
  NO_RESPONSE: "No response",
  VENUE_QUALITY_BELOW_STANDARD: "Venue quality below standard",
  OTHER: "Other",
};

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  BROKER: "Broker",
  COLD_CALL: "Cold call",
  SOCIAL_MEDIA: "Social media",
  WALK_IN: "Walk-in",
  OTHER: "Other",
};

const dealValue = (d: { projectedFeeValue: Prisma.Decimal | null; taFees: Prisma.Decimal | null }) =>
  Number(d.projectedFeeValue ?? d.taFees ?? 0) || 0;

export interface BdRangeParams {
  rangeKey?: BdRangeKey;
  from?: string | null;
  to?: string | null;
  employeeIds?: string[] | null;
}

export interface BdEmployeeMetrics {
  userId: string;
  name: string;
  leadsCold: number;
  leadsCampaign: number;
  leadsTotal: number;
  dealsCreated: number;
  dealsQualified: number;
  dealsWon: number;
  dealsLost: number;
  callsMade: number;
  notesFollowups: number;
  siteVisitsDone: number;
  taskScore: number;
}

// ------------------------------------------------------------
// BD executives (for the employee filter)
// ------------------------------------------------------------
export async function getBdExecutives(): Promise<Result<{ id: string; name: string }[]>> {
  const user = await requireBd();
  if (!user) return { success: false, error: "Unauthorized" };

  const [byRole, leadOwners, dealOwners] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["BD_EXECUTIVE", "BD_HEAD"] }, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.acqLead.findMany({
      where: { deletedAt: null },
      distinct: ["bdExecutiveId"],
      select: { bdExecutive: { select: { id: true, name: true } } },
    }),
    prisma.acqDeal.findMany({
      where: { deletedAt: null },
      distinct: ["bdExecutiveId"],
      select: { bdExecutive: { select: { id: true, name: true } } },
    }),
  ]);

  const map = new Map<string, string>();
  for (const u of byRole) map.set(u.id, u.name ?? "Unnamed");
  for (const r of leadOwners) if (r.bdExecutive) map.set(r.bdExecutive.id, r.bdExecutive.name ?? "Unnamed");
  for (const r of dealOwners) if (r.bdExecutive) map.set(r.bdExecutive.id, r.bdExecutive.name ?? "Unnamed");

  const list = [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

// ------------------------------------------------------------
// Main analytics aggregate (dashboard + report summaries)
// ------------------------------------------------------------
export async function getBdAnalytics(params: BdRangeParams): Promise<Result<unknown>> {
  const user = await requireBd();
  if (!user) return { success: false, error: "Unauthorized" };

  const range = resolveBdRange(params.rangeKey ?? "month", params.from, params.to);
  const inRange = { gte: range.start, lte: range.end };
  const empIds = params.employeeIds && params.employeeIds.length ? params.employeeIds : null;
  const empFilter = empIds ? { in: empIds } : undefined;

  // ---- Raw pulls (parallel) ---------------------------------
  const [leads, dealsCreated, dealsWon, dealsLost, activities, siteVisits, dealNotes, velos] =
    await Promise.all([
      // Leads created in range (for source split + created counts + funnel cohort)
      prisma.acqLead.findMany({
        where: { deletedAt: null, createdAt: inRange, ...(empFilter ? { bdExecutiveId: empFilter } : {}) },
        select: {
          id: true, leadSource: true, status: true, bdExecutiveId: true,
          firstContactAt: true, createdAt: true,
          deal: { select: { stage: true } },
        },
      }),
      // Deals created in range
      prisma.acqDeal.findMany({
        where: { deletedAt: null, createdAt: inRange, ...(empFilter ? { bdExecutiveId: empFilter } : {}) },
        select: { id: true, bdExecutiveId: true, projectedFeeValue: true, taFees: true },
      }),
      // Deals won in range (by wonAt)
      prisma.acqDeal.findMany({
        where: { deletedAt: null, stage: "WON", wonAt: inRange, ...(empFilter ? { bdExecutiveId: empFilter } : {}) },
        select: { id: true, bdExecutiveId: true, projectedFeeValue: true, taFees: true, wonAt: true },
      }),
      // Deals lost in range (by updatedAt — no dedicated lostAt)
      prisma.acqDeal.findMany({
        where: { deletedAt: null, stage: "LOST", updatedAt: inRange, ...(empFilter ? { bdExecutiveId: empFilter } : {}) },
        select: { id: true, bdExecutiveId: true, lostReason: true, projectedFeeValue: true, taFees: true },
      }),
      // Activities in range (calls, notes) — attributed to actorId
      prisma.acqLeadActivity.findMany({
        where: { createdAt: inRange, ...(empFilter ? { actorId: empFilter } : {}) },
        select: { channel: true, actorId: true },
      }),
      // Site visits completed in range — attributed to assignedToId
      prisma.acqSiteVisit.findMany({
        where: { status: "COMPLETED", completedAt: inRange, ...(empFilter ? { assignedToId: empFilter } : {}) },
        select: { assignedToId: true },
      }),
      // Deal notes in range — attributed to authorId
      prisma.acqDealNote.findMany({
        where: { createdAt: inRange, ...(empFilter ? { authorId: empFilter } : {}) },
        select: { authorId: true },
      }),
      // Velos points awarded in range — the leaderboard "task score"
      prisma.velosLedger.findMany({
        where: { awardedAt: inRange, ...(empFilter ? { userId: empFilter } : {}) },
        select: { userId: true, points: true },
      }),
    ]);

  // ---- Per-employee accumulation ----------------------------
  const rows = new Map<string, BdEmployeeMetrics>();
  const ensure = (id: string | null | undefined): BdEmployeeMetrics | null => {
    if (!id) return null;
    let r = rows.get(id);
    if (!r) {
      r = {
        userId: id, name: "", leadsCold: 0, leadsCampaign: 0, leadsTotal: 0,
        dealsCreated: 0, dealsQualified: 0, dealsWon: 0, dealsLost: 0,
        callsMade: 0, notesFollowups: 0, siteVisitsDone: 0, taskScore: 0,
      };
      rows.set(id, r);
    }
    return r;
  };

  const sourceCounts = new Map<string, number>();
  for (const l of leads) {
    const r = ensure(l.bdExecutiveId);
    sourceCounts.set(l.leadSource, (sourceCounts.get(l.leadSource) ?? 0) + 1);
    if (r) {
      r.leadsTotal++;
      if (CAMPAIGN_SOURCES.has(l.leadSource)) r.leadsCampaign++;
      else r.leadsCold++;
      if (l.status === "QUALIFIED") r.dealsQualified++;
    }
  }
  for (const d of dealsCreated) { const r = ensure(d.bdExecutiveId); if (r) r.dealsCreated++; }

  let wonValue = 0;
  for (const d of dealsWon) { const r = ensure(d.bdExecutiveId); if (r) r.dealsWon++; wonValue += dealValue(d); }

  let lostValue = 0;
  const lossReasonAgg = new Map<string, { count: number; value: number }>();
  for (const d of dealsLost) {
    const r = ensure(d.bdExecutiveId); if (r) r.dealsLost++;
    const v = dealValue(d); lostValue += v;
    const key = d.lostReason ?? "OTHER";
    const cur = lossReasonAgg.get(key) ?? { count: 0, value: 0 };
    cur.count++; cur.value += v; lossReasonAgg.set(key, cur);
  }

  for (const a of activities) {
    const r = ensure(a.actorId); if (!r) continue;
    if (a.channel === "CALL") r.callsMade++;
    if (a.channel === "NOTE" || a.channel === "WHATSAPP" || a.channel === "EMAIL") r.notesFollowups++;
  }
  for (const n of dealNotes) { const r = ensure(n.authorId); if (r) r.notesFollowups++; }
  for (const v of siteVisits) { const r = ensure(v.assignedToId); if (r) r.siteVisitsDone++; }
  for (const p of velos) { const r = ensure(p.userId); if (r) r.taskScore += p.points; }

  // ---- Names ------------------------------------------------
  const ids = [...rows.keys()];
  if (ids.length) {
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameMap = new Map(users.map((u) => [u.id, u.name ?? "Unnamed"]));
    for (const r of rows.values()) r.name = nameMap.get(r.userId) ?? "Unknown";
  }

  const employees = [...rows.values()].sort((a, b) => b.leadsTotal - a.leadsTotal);

  // ---- Totals -----------------------------------------------
  const sum = (f: (r: BdEmployeeMetrics) => number) => employees.reduce((s, r) => s + f(r), 0);
  const totals = {
    leadsCold: sum((r) => r.leadsCold),
    leadsCampaign: sum((r) => r.leadsCampaign),
    leadsTotal: sum((r) => r.leadsTotal),
    dealsCreated: sum((r) => r.dealsCreated),
    dealsQualified: sum((r) => r.dealsQualified),
    dealsWon: sum((r) => r.dealsWon),
    dealsLost: sum((r) => r.dealsLost),
    callsMade: sum((r) => r.callsMade),
    notesFollowups: sum((r) => r.notesFollowups),
    siteVisitsDone: sum((r) => r.siteVisitsDone),
    taskScore: sum((r) => r.taskScore),
    wonValue,
    lostValue,
  };

  // ---- Funnel (cohort of leads created in range) ------------
  const siteVisitLeadIds = new Set(
    (await prisma.acqSiteVisit.findMany({
      where: { status: "COMPLETED", lead: { createdAt: inRange, ...(empFilter ? { bdExecutiveId: empFilter } : {}) } },
      select: { leadId: true },
    })).map((s) => s.leadId)
  );
  const stageAtLeast = (stage: string | undefined, floor: string[]) => !!stage && floor.includes(stage);
  const funnel = FUNNEL_STAGES.map((s) => {
    let count = 0;
    for (const l of leads) {
      const st = l.deal?.stage;
      switch (s.key) {
        case "leads": count++; break;
        case "contacted": if (l.firstContactAt || l.status !== "NEW") count++; break;
        case "qualified": if (l.status === "QUALIFIED") count++; break;
        case "siteVisit": if (siteVisitLeadIds.has(l.id)) count++; break;
        case "proposal": if (stageAtLeast(st, ["PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_SENT", "SIGNED", "WON"])) count++; break;
        case "negotiation": if (stageAtLeast(st, ["NEGOTIATION", "CONTRACT_SENT", "SIGNED", "WON"])) count++; break;
        case "signed": if (stageAtLeast(st, ["SIGNED", "WON"])) count++; break;
        case "won": if (st === "WON") count++; break;
      }
    }
    return { ...s, count };
  });

  // ---- Source split -----------------------------------------
  const leadSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, label: SOURCE_LABEL[source] ?? source, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Loss reasons -----------------------------------------
  const lossReasons = [...lossReasonAgg.entries()]
    .map(([reason, v]) => ({ reason, label: LOST_REASON_LABEL[reason] ?? reason, count: v.count, value: v.value }))
    .sort((a, b) => b.count - a.count);

  // ---- Leaderboard (by task score) --------------------------
  const leaderboard = [...employees]
    .map((r) => ({ userId: r.userId, name: r.name, taskScore: r.taskScore }))
    .sort((a, b) => b.taskScore - a.taskScore);

  // ---- Conversion + cycle time ------------------------------
  const leadToQualified = totals.leadsTotal ? totals.dealsQualified / totals.leadsTotal : 0;
  const qualifiedToWon = totals.dealsQualified ? totals.dealsWon / totals.dealsQualified : 0;
  const closedDeals = totals.dealsWon + totals.dealsLost;
  const winRate = closedDeals ? totals.dealsWon / closedDeals : 0;

  return {
    success: true,
    data: {
      range: { key: range.key, label: range.label, from: range.fromDate, to: range.toDate },
      totals,
      employees,
      leaderboard,
      leadSources,
      funnel,
      lossReasons,
      conversion: { leadToQualified, qualifiedToWon, winRate },
    },
  };
}
