"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { evaluateScore } from "@/lib/scoring-engine";
import {
  scoringRuleSchema,
  scoringRuleSetSchema,
  type ScoringRuleInput,
  type ScoringRuleSetInput,
} from "@/schemas/scoring-rule.schema";

// ============================================================
// Types
// ============================================================

export interface ScoringRuleSetData {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  isActive: boolean;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
  _count?: { rules: number };
  rules?: ScoringRuleData[];
}

export interface ScoringRuleData {
  id: string;
  name: string;
  category: string;
  points: number;
  conditions: Record<string, unknown>[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  ruleSetId: string;
}

export interface ScoreResult {
  total: number;
  breakdown: Array<{
    name: string;
    points: number;
    applied: boolean;
    earnedPoints: number;
  }>;
}

// ============================================================
// Rule Set CRUD
// ============================================================

export async function getScoringRuleSets(): Promise<
  | { success: true; data: ScoringRuleSetData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const sets = await prisma.scoringRuleSet.findMany({
      orderBy: [{ entityType: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { rules: true } } },
    });

    return { success: true as const, data: serialize(sets) as unknown as ScoringRuleSetData[] };
  } catch (error) {
    console.error("getScoringRuleSets error:", error);
    return { success: false as const, error: "Failed to load scoring rule sets" };
  }
}

export async function getScoringRuleSet(id: string): Promise<
  | { success: true; data: ScoringRuleSetData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const set = await prisma.scoringRuleSet.findUnique({
      where: { id },
      include: {
        rules: { orderBy: { order: "asc" } },
        _count: { select: { rules: true } },
      },
    });

    if (!set) {
      return { success: false as const, error: "Scoring rule set not found" };
    }

    return { success: true as const, data: serialize(set) as unknown as ScoringRuleSetData };
  } catch (error) {
    console.error("getScoringRuleSet error:", error);
    return { success: false as const, error: "Failed to load scoring rule set" };
  }
}

export async function createScoringRuleSet(
  input: ScoringRuleSetInput
): Promise<
  | { success: true; data: ScoringRuleSetData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scoringRuleSetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const set = await prisma.scoringRuleSet.create({
      data: {
        name: data.name,
        entityType: data.entityType,
        description: data.description ?? null,
        isActive: data.isActive,
        maxScore: data.maxScore,
      },
      include: { _count: { select: { rules: true } } },
    });

    logActivity({
      userId: session.user.id,
      action: "CREATE_SCORING_RULE_SET",
      entityType: "scoring_rule_set",
      entityId: set.id,
      changes: { name: set.name },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: serialize(set) as unknown as ScoringRuleSetData };
  } catch (error) {
    console.error("createScoringRuleSet error:", error);
    return { success: false as const, error: "Failed to create scoring rule set" };
  }
}

export async function updateScoringRuleSet(
  id: string,
  input: ScoringRuleSetInput
): Promise<
  | { success: true; data: ScoringRuleSetData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scoringRuleSetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const set = await prisma.scoringRuleSet.update({
      where: { id },
      data: {
        name: data.name,
        entityType: data.entityType,
        description: data.description ?? null,
        isActive: data.isActive,
        maxScore: data.maxScore,
      },
      include: { _count: { select: { rules: true } } },
    });

    logActivity({
      userId: session.user.id,
      action: "UPDATE_SCORING_RULE_SET",
      entityType: "scoring_rule_set",
      entityId: set.id,
      changes: { name: set.name },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: serialize(set) as unknown as ScoringRuleSetData };
  } catch (error) {
    console.error("updateScoringRuleSet error:", error);
    return { success: false as const, error: "Failed to update scoring rule set" };
  }
}

export async function deleteScoringRuleSet(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.scoringRuleSet.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "DELETE_SCORING_RULE_SET",
      entityType: "scoring_rule_set",
      entityId: id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const };
  } catch (error) {
    console.error("deleteScoringRuleSet error:", error);
    return { success: false as const, error: "Failed to delete scoring rule set" };
  }
}

export async function toggleScoringRuleSet(
  id: string,
  isActive: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.scoringRuleSet.update({
      where: { id },
      data: { isActive },
    });

    return { success: true as const };
  } catch (error) {
    console.error("toggleScoringRuleSet error:", error);
    return { success: false as const, error: "Failed to toggle scoring rule set" };
  }
}

// ============================================================
// Rule CRUD
// ============================================================

export async function createScoringRule(
  ruleSetId: string,
  input: ScoringRuleInput
): Promise<
  | { success: true; data: ScoringRuleData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scoringRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const rule = await prisma.scoringRule.create({
      data: {
        name: data.name,
        category: data.category,
        points: data.points,
        conditions: data.conditions as unknown as object,
        isActive: data.isActive,
        order: data.order,
        ruleSetId,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "CREATE_SCORING_RULE",
      entityType: "scoring_rule",
      entityId: rule.id,
      changes: { name: rule.name, ruleSetId },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: serialize(rule) as unknown as ScoringRuleData };
  } catch (error) {
    console.error("createScoringRule error:", error);
    return { success: false as const, error: "Failed to create scoring rule" };
  }
}

export async function updateScoringRule(
  id: string,
  input: ScoringRuleInput
): Promise<
  | { success: true; data: ScoringRuleData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scoringRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const rule = await prisma.scoringRule.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        points: data.points,
        conditions: data.conditions as unknown as object,
        isActive: data.isActive,
        order: data.order,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "UPDATE_SCORING_RULE",
      entityType: "scoring_rule",
      entityId: rule.id,
      changes: { name: rule.name },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: serialize(rule) as unknown as ScoringRuleData };
  } catch (error) {
    console.error("updateScoringRule error:", error);
    return { success: false as const, error: "Failed to update scoring rule" };
  }
}

export async function deleteScoringRule(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.scoringRule.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "DELETE_SCORING_RULE",
      entityType: "scoring_rule",
      entityId: id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const };
  } catch (error) {
    console.error("deleteScoringRule error:", error);
    return { success: false as const, error: "Failed to delete scoring rule" };
  }
}

export async function reorderScoringRules(
  ruleSetId: string,
  orderedIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.scoringRule.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return { success: true as const };
  } catch (error) {
    console.error("reorderScoringRules error:", error);
    return { success: false as const, error: "Failed to reorder rules" };
  }
}

// ============================================================
// Evaluate Scoring Rules
// ============================================================

async function loadEntityData(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case "LEAD": {
      const lead = await prisma.lead.findUnique({ where: { id: entityId } });
      if (!lead) return null;
      const data = serialize(lead) as unknown as Record<string, unknown>;
      // Load communication count for the lead's contact
      const contactId = lead.contactId;
      await loadCommunicationCounts(data, contactId);
      return data;
    }
    case "CONTACT": {
      const contact = await prisma.contact.findUnique({ where: { id: entityId } });
      if (!contact) return null;
      const data = serialize(contact) as unknown as Record<string, unknown>;
      await loadCommunicationCounts(data, entityId);
      return data;
    }
    case "DEAL": {
      const deal = await prisma.deal.findUnique({
        where: { id: entityId },
        include: { lead: true },
      });
      if (!deal) return null;
      const data = serialize(deal) as unknown as Record<string, unknown>;
      // Load communication count via the lead's contact
      const contactId = deal.lead?.contactId;
      if (contactId) {
        await loadCommunicationCounts(data, contactId);
      }
      return data;
    }
    default:
      return null;
  }
}

async function loadCommunicationCounts(
  data: Record<string, unknown>,
  contactId: string
): Promise<void> {
  const now = new Date();

  // Load counts for common timeframes: 7, 14, 30, 60, 90 days
  const timeframes = [7, 14, 30, 60, 90];

  await Promise.all(
    timeframes.map(async (days) => {
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const count = await prisma.communication.count({
        where: {
          contactId,
          createdAt: { gte: since },
        },
      });
      data[`_communicationCount_${days}`] = count;
    })
  );
}

const COMMUNICATION_TIMEFRAMES = [7, 14, 30, 60, 90];

type CommunicationCounts = Record<string, number>;

// Batched version of loadCommunicationCounts: instead of 5 count queries per
// contact, fire one grouped query per timeframe across all contactIds and bucket
// the results. Returns a map of contactId -> { _communicationCount_<days>: n }.
async function loadCommunicationCountsBatch(
  contactIds: string[]
): Promise<Map<string, CommunicationCounts>> {
  const result = new Map<string, CommunicationCounts>();
  const uniqueIds = Array.from(new Set(contactIds.filter(Boolean)));

  // Seed every contact with zeroed buckets so missing rows read as 0.
  for (const id of uniqueIds) {
    const buckets: CommunicationCounts = {};
    for (const days of COMMUNICATION_TIMEFRAMES) {
      buckets[`_communicationCount_${days}`] = 0;
    }
    result.set(id, buckets);
  }

  if (uniqueIds.length === 0) {
    return result;
  }

  const now = new Date();

  await Promise.all(
    COMMUNICATION_TIMEFRAMES.map(async (days) => {
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const grouped = await prisma.communication.groupBy({
        by: ["contactId"],
        where: {
          contactId: { in: uniqueIds },
          createdAt: { gte: since },
        },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (!row.contactId) continue;
        const buckets = result.get(row.contactId);
        if (buckets) {
          buckets[`_communicationCount_${days}`] = row._count._all;
        }
      }
    })
  );

  return result;
}

// Merge pre-computed communication counts onto an entity data record.
function applyCommunicationCounts(
  data: Record<string, unknown>,
  counts: CommunicationCounts | undefined
): void {
  if (!counts) {
    for (const days of COMMUNICATION_TIMEFRAMES) {
      data[`_communicationCount_${days}`] = 0;
    }
    return;
  }
  for (const [key, value] of Object.entries(counts)) {
    data[key] = value;
  }
}

export async function evaluateScoringRules(
  entityType: string,
  entityId: string
): Promise<
  | { success: true; data: ScoreResult }
  | { success: false; error: string }
  | null
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Find active rule set for the entity type
    const ruleSet = await prisma.scoringRuleSet.findFirst({
      where: { entityType, isActive: true },
      include: {
        rules: { orderBy: { order: "asc" } },
      },
    });

    // If no active rule set, return null so caller can fall back to hardcoded scoring
    if (!ruleSet) {
      return null;
    }

    // Load entity data
    const entityData = await loadEntityData(entityType, entityId);
    if (!entityData) {
      return { success: false as const, error: "Entity not found" };
    }

    // Evaluate using the pure scoring engine
    const rules = ruleSet.rules.map((r) => ({
      name: r.name,
      category: r.category,
      points: r.points,
      conditions: r.conditions as unknown as unknown[],
      isActive: r.isActive,
    }));

    const result = evaluateScore(entityData, rules, ruleSet.maxScore);

    return { success: true as const, data: result };
  } catch (error) {
    console.error("evaluateScoringRules error:", error);
    return { success: false as const, error: "Failed to evaluate scoring rules" };
  }
}

// ============================================================
// Bulk Recalculate Scores
// ============================================================

export async function bulkRecalculateScores(
  entityType: string
): Promise<
  | { success: true; data: { processed: number; updated: number } }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    return await recalculateScoresForEntityType(entityType);
  } catch (error) {
    console.error("bulkRecalculateScores error:", error);
    return { success: false as const, error: "Failed to recalculate scores" };
  }
}

// Session-free core, callable from cron (which has no user session). Does the
// actual recalculation; auth is the caller's responsibility.
export async function recalculateScoresForEntityType(
  entityType: string,
  internalToken?: string
): Promise<
  | { success: true; data: { processed: number; updated: number } }
  | { success: false; error: string }
> {
  try {
    // Authorization gate. This is a "use server" export, so it is directly
    // dispatchable by any client — without a guard, anyone could trigger a
    // full-table rescan + mass score write (RBAC bypass + resource exhaustion).
    // Two legitimate callers:
    //   1) the score-decay cron — has no user session, so it proves itself by
    //      passing the server-only CRON_SECRET (unforgeable from a client, which
    //      cannot read the env var);
    //   2) an authenticated staff user with settings:read (e.g. via bulkRecalculateScores).
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && internalToken === cronSecret;
    if (!isCron) {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false as const, error: "Unauthorized" };
      }
      if (!hasPermission(session.user.role, "settings:read")) {
        return { success: false as const, error: "Insufficient permissions" };
      }
    }

    // Find active rule set for the entity type
    const ruleSet = await prisma.scoringRuleSet.findFirst({
      where: { entityType, isActive: true },
      include: {
        rules: { orderBy: { order: "asc" } },
      },
    });

    if (!ruleSet) {
      return { success: true as const, data: { processed: 0, updated: 0 } };
    }

    const rules = ruleSet.rules.map((r) => ({
      name: r.name,
      category: r.category,
      points: r.points,
      conditions: r.conditions as unknown as unknown[],
      isActive: r.isActive,
    }));

    let processed = 0;
    let updated = 0;

    switch (entityType) {
      case "LEAD": {
        // Fetch full rows up front so we don't re-fetch each lead inside the loop.
        // Exclude soft-deleted leads (they must not be rescored or resurface).
        const leads = await prisma.lead.findMany({ where: { deletedAt: null } });

        // Resolve communication counts for every contact in a single batched pass.
        const countsByContact = await loadCommunicationCountsBatch(
          leads.map((l) => l.contactId)
        );

        const scoreUpdates: Array<{ id: string; score: number }> = [];

        for (const lead of leads) {
          processed++;

          const entityData = serialize(lead) as unknown as Record<string, unknown>;
          applyCommunicationCounts(entityData, countsByContact.get(lead.contactId));

          const result = evaluateScore(entityData, rules, ruleSet.maxScore);

          scoreUpdates.push({ id: lead.id, score: result.total });
          updated++;
        }

        // Batch the score writes into a single transaction.
        if (scoreUpdates.length > 0) {
          await prisma.$transaction(
            scoreUpdates.map((u) =>
              prisma.lead.update({
                where: { id: u.id },
                data: { score: u.score },
              })
            )
          );
        }
        break;
      }
      case "CONTACT": {
        // Contact doesn't have a score field by default, just process
        const contacts = await prisma.contact.findMany({
          where: { deletedAt: null },
          select: { id: true },
        });
        processed = contacts.length;
        break;
      }
      case "DEAL": {
        // Fetch full rows (with lead) up front so we don't re-fetch each deal inside the loop.
        const deals = await prisma.deal.findMany({
          include: { lead: true },
        });

        // Resolve communication counts for every related contact in one batched pass.
        const dealContactIds = deals
          .map((d) => d.lead?.contactId)
          .filter((id): id is string => Boolean(id));
        const countsByContact = await loadCommunicationCountsBatch(dealContactIds);

        for (const deal of deals) {
          processed++;

          const entityData = serialize(deal) as unknown as Record<string, unknown>;
          if (deal.lead?.contactId) {
            applyCommunicationCounts(entityData, countsByContact.get(deal.lead.contactId));
          }

          evaluateScore(entityData, rules, ruleSet.maxScore);
          updated++;
        }
        break;
      }
    }

    return { success: true as const, data: { processed, updated } };
  } catch (error) {
    console.error("bulkRecalculateScores error:", error);
    return { success: false as const, error: "Failed to recalculate scores" };
  }
}
