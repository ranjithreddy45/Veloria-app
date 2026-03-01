"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import {
  assignmentRuleSchema,
  type AssignmentRuleInput,
  type AssignmentRuleCondition,
} from "@/schemas/assignment-rule.schema";

// ============================================================
// Types
// ============================================================

export interface AssignmentRuleData {
  id: string;
  name: string;
  entityType: string;
  isActive: boolean;
  priority: number;
  conditions: AssignmentRuleCondition[];
  assignToUserId: string | null;
  assignToUser: { id: string; name: string | null; email: string } | null;
  assignToTeam: string[];
  assignmentMethod: string;
  lastAssignedIdx: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CRUD
// ============================================================

export async function getAssignmentRules(): Promise<
  | { success: true; data: AssignmentRuleData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const rules = await prisma.assignmentRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        assignToUser: { select: { id: true, name: true, email: true } },
      },
    });

    return { success: true as const, data: serialize(rules) as unknown as AssignmentRuleData[] };
  } catch (error) {
    console.error("getAssignmentRules error:", error);
    return { success: false as const, error: "Failed to load rules" };
  }
}

export async function createAssignmentRule(
  input: AssignmentRuleInput
): Promise<
  | { success: true; data: AssignmentRuleData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignmentRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const rule = await prisma.assignmentRule.create({
      data: {
        name: data.name,
        entityType: data.entityType,
        isActive: data.isActive,
        priority: data.priority,
        conditions: data.conditions as unknown as object,
        assignToUserId: data.assignToUserId ?? null,
        assignToTeam: data.assignToTeam,
        assignmentMethod: data.assignmentMethod,
      },
      include: {
        assignToUser: { select: { id: true, name: true, email: true } },
      },
    });

    logActivity({
      action: "CREATE_ASSIGNMENT_RULE",
      entityType: "assignment_rule",
      entityId: rule.id,
      changes: { name: rule.name },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(rule) as unknown as AssignmentRuleData };
  } catch (error) {
    console.error("createAssignmentRule error:", error);
    return { success: false as const, error: "Failed to create rule" };
  }
}

export async function updateAssignmentRule(
  id: string,
  input: AssignmentRuleInput
): Promise<
  | { success: true; data: AssignmentRuleData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignmentRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const rule = await prisma.assignmentRule.update({
      where: { id },
      data: {
        name: data.name,
        entityType: data.entityType,
        isActive: data.isActive,
        priority: data.priority,
        conditions: data.conditions as unknown as object,
        assignToUserId: data.assignToUserId ?? null,
        assignToTeam: data.assignToTeam,
        assignmentMethod: data.assignmentMethod,
      },
      include: {
        assignToUser: { select: { id: true, name: true, email: true } },
      },
    });

    return { success: true as const, data: serialize(rule) as unknown as AssignmentRuleData };
  } catch (error) {
    console.error("updateAssignmentRule error:", error);
    return { success: false as const, error: "Failed to update rule" };
  }
}

export async function deleteAssignmentRule(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    await prisma.assignmentRule.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("deleteAssignmentRule error:", error);
    return { success: false as const, error: "Failed to delete rule" };
  }
}

export async function toggleAssignmentRule(
  id: string,
  isActive: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    await prisma.assignmentRule.update({
      where: { id },
      data: { isActive },
    });

    return { success: true as const };
  } catch (error) {
    console.error("toggleAssignmentRule error:", error);
    return { success: false as const, error: "Failed to toggle rule" };
  }
}

// ============================================================
// Evaluate Assignment Rules
// ============================================================

export async function evaluateAssignmentRules(
  leadData: Record<string, unknown>
): Promise<string | null> {
  try {
    const rules = await prisma.assignmentRule.findMany({
      where: { entityType: "LEAD", isActive: true },
      orderBy: { priority: "asc" },
    });

    for (const rule of rules) {
      const conditions = rule.conditions as unknown as AssignmentRuleCondition[];
      let allMatch = true;

      for (const condition of conditions) {
        const fieldValue = leadData[condition.field];
        const condValue = condition.value;

        switch (condition.operator) {
          case "equals":
            if (String(fieldValue) !== String(condValue)) allMatch = false;
            break;
          case "contains":
            if (!String(fieldValue ?? "").toLowerCase().includes(String(condValue).toLowerCase()))
              allMatch = false;
            break;
          case "in":
            if (Array.isArray(condValue) && !condValue.includes(String(fieldValue)))
              allMatch = false;
            break;
          case "gt":
            if (Number(fieldValue) <= Number(condValue)) allMatch = false;
            break;
          case "gte":
            if (Number(fieldValue) < Number(condValue)) allMatch = false;
            break;
          case "lt":
            if (Number(fieldValue) >= Number(condValue)) allMatch = false;
            break;
          case "lte":
            if (Number(fieldValue) > Number(condValue)) allMatch = false;
            break;
          default:
            allMatch = false;
        }

        if (!allMatch) break;
      }

      if (allMatch) {
        if (rule.assignmentMethod === "DIRECT" && rule.assignToUserId) {
          return rule.assignToUserId;
        }

        if (rule.assignmentMethod === "ROUND_ROBIN" && rule.assignToTeam.length > 0) {
          const nextIdx = (rule.lastAssignedIdx + 1) % rule.assignToTeam.length;
          const assigneeId = rule.assignToTeam[nextIdx];

          // Update the round-robin index
          await prisma.assignmentRule.update({
            where: { id: rule.id },
            data: { lastAssignedIdx: nextIdx },
          });

          return assigneeId;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("evaluateAssignmentRules error:", error);
    return null;
  }
}
