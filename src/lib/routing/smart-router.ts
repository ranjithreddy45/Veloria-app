// ============================================================
// SMART routing — workload- & skill-aware lead-rep selector
// ============================================================
// Plain library (NOT "use server"): the core selector invoked from inside
// evaluateAssignmentRules() when a matching rule's method is "SMART". It is
// the single integration seam for SMART routing and is on the hot
// runSpeedToLead/lead-capture path, so it NEVER throws — every public fn
// swallows its errors and returns a safe value (null / 0) so the caller can
// fall back to ROUND_ROBIN and leads are never dropped.
//
// Selection: among the candidate reps (a rule's assignToTeam, or all active
// sales reps if the team is empty), keep only the eligible ones —
//   • status ONLINE or BUSY (AWAY/OFFLINE are out)
//   • a fresh heartbeat (lastSeenAt within autoOfflineAfterMin) OR manual ONLINE
//   • openLeadCount strictly below capacityLimit
//   • backing User is active (never assign to a disabled rep)
// then score each by availability + remaining capacity + skill match
// (eventType in eventTypeSkills, language overlap) and return the top rep,
// tie-broken on lowest openLeadCount then most recent lastSeenAt.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface SmartScoreBreakdown {
  availability: number;
  capacity: number;
  skill: number;
  language: number;
  total: number;
}

export interface SmartChoice {
  assigneeId: string;
  matchedEventType: boolean;
  matchedLanguage: boolean;
  repLoadAtDecision: number;
  scoreBreakdown: SmartScoreBreakdown;
}

export interface ChooseSmartAssigneeArgs {
  /** Candidate pool (AssignmentRule.assignToTeam). Empty → all active sales reps. */
  team?: string[] | null;
  /** Lead event type to skill-match against RepAvailability.eventTypeSkills. */
  eventType?: string | null;
  /** Optional language hints to overlap against RepAvailability.languages. */
  languageHints?: string[] | null;
}

const DEFAULT_AUTO_OFFLINE_MIN = 15;

// Sales roles eligible for SMART routing when no explicit team is configured.
const SALES_ROLES: UserRole[] = ["SALES_EXEC", "SALES_HEAD", "ADMIN", "SUPER_ADMIN"];

// ------------------------------------------------------------
// Scoring
// ------------------------------------------------------------

function statusWeight(status: string): number {
  // ONLINE preferred over BUSY; AWAY/OFFLINE are filtered out before scoring.
  if (status === "ONLINE") return 1;
  if (status === "BUSY") return 0.6;
  return 0;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// ------------------------------------------------------------
// chooseSmartAssignee — the selector
// ------------------------------------------------------------

/**
 * Pick the available, lightest-loaded, best-matched rep. Returns null when no
 * rep is eligible (caller falls back to ROUND_ROBIN). Never throws.
 */
export async function chooseSmartAssignee(
  args: ChooseSmartAssigneeArgs
): Promise<SmartChoice | null> {
  try {
    const team = (args.team ?? []).filter(Boolean);
    const wantedEventType = args.eventType ? normalize(args.eventType) : "";
    const wantedLanguages = (args.languageHints ?? [])
      .map(normalize)
      .filter(Boolean);

    // ---- Resolve the candidate userIds. --------------------------------
    let candidateIds: string[];
    if (team.length > 0) {
      candidateIds = team;
    } else {
      const reps = await prisma.user.findMany({
        where: { isActive: true, role: { in: SALES_ROLES } },
        select: { id: true },
        take: 500,
      });
      candidateIds = reps.map((r) => r.id);
    }
    if (candidateIds.length === 0) return null;

    // ---- Single findMany over the candidate pool (keep the hot path lean).
    const rows = await prisma.repAvailability.findMany({
      where: { userId: { in: candidateIds } },
      select: {
        userId: true,
        status: true,
        openLeadCount: true,
        capacityLimit: true,
        eventTypeSkills: true,
        languages: true,
        lastSeenAt: true,
        autoOfflineAfterMin: true,
      },
    });
    if (rows.length === 0) return null;

    // ---- Guard against disabled users that still have an availability row.
    const activeUsers = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) }, isActive: true },
      select: { id: true },
    });
    const activeSet = new Set(activeUsers.map((u) => u.id));

    const now = Date.now();
    let best: SmartChoice | null = null;
    let bestSort: { score: number; load: number; seen: number } | null = null;

    for (const rep of rows) {
      if (!activeSet.has(rep.userId)) continue;

      // Eligibility — active status only.
      if (rep.status !== "ONLINE" && rep.status !== "BUSY") continue;

      // Fresh heartbeat OR a deliberate ONLINE flag keeps them eligible.
      const limitMin = rep.autoOfflineAfterMin ?? DEFAULT_AUTO_OFFLINE_MIN;
      const fresh =
        !!rep.lastSeenAt &&
        rep.lastSeenAt.getTime() >= now - limitMin * 60 * 1000;
      if (!fresh && rep.status !== "ONLINE") continue;

      // Capacity — strictly below the soft cap.
      const load = rep.openLeadCount ?? 0;
      const cap = rep.capacityLimit ?? 50;
      if (load >= cap) continue;

      // ---- Score. ------------------------------------------------------
      const availability = statusWeight(rep.status);
      const remaining = cap > 0 ? (cap - load) / cap : 0; // 0..1
      const skills = (rep.eventTypeSkills ?? []).map(normalize);
      const matchedEventType =
        !!wantedEventType && skills.includes(wantedEventType);
      const repLangs = (rep.languages ?? []).map(normalize);
      const matchedLanguage =
        wantedLanguages.length > 0 &&
        wantedLanguages.some((l) => repLangs.includes(l));

      const breakdown: SmartScoreBreakdown = {
        availability: availability * 3,
        capacity: remaining * 2,
        skill: matchedEventType ? 4 : 0,
        language: matchedLanguage ? 1 : 0,
        total: 0,
      };
      breakdown.total =
        breakdown.availability +
        breakdown.capacity +
        breakdown.skill +
        breakdown.language;

      const sortKey = {
        score: breakdown.total,
        load,
        seen: rep.lastSeenAt ? rep.lastSeenAt.getTime() : 0,
      };

      // Tie-break: higher score, then lower load, then more recent heartbeat.
      const better =
        !bestSort ||
        sortKey.score > bestSort.score ||
        (sortKey.score === bestSort.score && sortKey.load < bestSort.load) ||
        (sortKey.score === bestSort.score &&
          sortKey.load === bestSort.load &&
          sortKey.seen > bestSort.seen);

      if (better) {
        bestSort = sortKey;
        best = {
          assigneeId: rep.userId,
          matchedEventType,
          matchedLanguage,
          repLoadAtDecision: load,
          scoreBreakdown: breakdown,
        };
      }
    }

    return best;
  } catch (e) {
    console.error("[chooseSmartAssignee] error:", e);
    return null;
  }
}

// ------------------------------------------------------------
// recordRoutingDecision — best-effort audit row
// ------------------------------------------------------------

export interface RecordRoutingDecisionArgs {
  leadId: string;
  assignedToId: string | null;
  method?: string; // SMART | ROUND_ROBIN | DIRECT
  matchedEventType?: boolean;
  matchedLanguage?: boolean;
  repLoadAtDecision?: number;
  ruleId?: string | null;
  scoreBreakdown?: Record<string, unknown>;
}

/**
 * Write a LeadRoutingDecision audit row. Best-effort — a logging failure must
 * never block the assignment. Also optimistically bumps the chosen rep's
 * openLeadCount so two near-simultaneous leads don't pile onto the same rep
 * before the cron reconciler runs.
 */
export async function recordRoutingDecision(
  args: RecordRoutingDecisionArgs
): Promise<void> {
  try {
    await prisma.leadRoutingDecision.create({
      data: {
        leadId: args.leadId,
        assignedToId: args.assignedToId ?? null,
        method: args.method ?? "SMART",
        matchedEventType: args.matchedEventType ?? false,
        matchedLanguage: args.matchedLanguage ?? false,
        repLoadAtDecision: args.repLoadAtDecision ?? 0,
        ruleId: args.ruleId ?? null,
        scoreBreakdown: (args.scoreBreakdown ?? {}) as object,
      },
    });
  } catch (e) {
    console.error("[recordRoutingDecision] audit write failed:", e);
  }

  // Optimistic load increment (fairness between cron reconciles).
  if (args.assignedToId) {
    try {
      await prisma.repAvailability.updateMany({
        where: { userId: args.assignedToId },
        data: { openLeadCount: { increment: 1 } },
      });
    } catch (e) {
      console.error("[recordRoutingDecision] load bump failed:", e);
    }
  }
}

// ------------------------------------------------------------
// refreshRepOpenLeadCounts — authoritative reconciler (cron)
// ------------------------------------------------------------

/**
 * Recompute openLeadCount per rep from live open-lead counts
 * (status NEW/CONTACTED/QUALIFIED, not soft-deleted). The cron is the
 * authoritative reconciler against optimistic increments. Never throws;
 * returns the number of RepAvailability rows updated.
 */
export async function refreshRepOpenLeadCounts(): Promise<number> {
  try {
    const reps = await prisma.repAvailability.findMany({
      select: { id: true, userId: true, openLeadCount: true },
    });
    if (reps.length === 0) return 0;

    // One grouped count over open leads, keyed by assignee.
    const grouped = await prisma.lead.groupBy({
      by: ["assignedToId"],
      where: {
        deletedAt: null,
        assignedToId: { in: reps.map((r) => r.userId) },
        status: { in: ["NEW", "CONTACTED", "QUALIFIED"] },
      },
      _count: { _all: true },
    });

    const countByUser = new Map<string, number>();
    for (const g of grouped) {
      if (g.assignedToId) countByUser.set(g.assignedToId, g._count._all);
    }

    let updated = 0;
    for (const rep of reps) {
      const live = countByUser.get(rep.userId) ?? 0;
      if (live !== rep.openLeadCount) {
        await prisma.repAvailability.update({
          where: { id: rep.id },
          data: { openLeadCount: live },
        });
        updated++;
      }
    }
    return updated;
  } catch (e) {
    console.error("[refreshRepOpenLeadCounts] error:", e);
    return 0;
  }
}
