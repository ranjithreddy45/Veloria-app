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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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

    if (!hasPermission(session.user.role, "settings:read")) {
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
  entityType: string
): Promise<
  | { success: true; data: { processed: number; updated: number } }
  | { success: false; error: string }
> {
  try {
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
        const leads = await prisma.lead.findMany({
          select: { id: true, contactId: true },
        });

        for (const lead of leads) {
          processed++;
          const fullLead = await prisma.lead.findUnique({ where: { id: lead.id } });
          if (!fullLead) continue;

          const entityData = serialize(fullLead) as unknown as Record<string, unknown>;
          await loadCommunicationCounts(entityData, lead.contactId);

          const result = evaluateScore(entityData, rules, ruleSet.maxScore);

          await prisma.lead.update({
            where: { id: lead.id },
            data: { score: result.total },
          });
          updated++;
        }
        break;
      }
      case "CONTACT": {
        // Contact doesn't have a score field by default, just process
        const contacts = await prisma.contact.findMany({
          select: { id: true },
        });
        processed = contacts.length;
        break;
      }
      case "DEAL": {
        const deals = await prisma.deal.findMany({
          include: { lead: { select: { id: true, contactId: true } } },
        });

        for (const deal of deals) {
          processed++;
          const fullDeal = await prisma.deal.findUnique({
            where: { id: deal.id },
            include: { lead: true },
          });
          if (!fullDeal) continue;

          const entityData = serialize(fullDeal) as unknown as Record<string, unknown>;
          if (fullDeal.lead?.contactId) {
            await loadCommunicationCounts(entityData, fullDeal.lead.contactId);
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
