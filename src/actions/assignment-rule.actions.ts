"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
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

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
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

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
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
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

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

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
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

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
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

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
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
// evaluateAssignmentRules moved to @/lib/assignment/evaluate.
// It must be callable from unauthenticated server contexts (webhooks, the
// public landing form), so it cannot carry an auth gate — and an ungated
// export from a "use server" file is a publicly invokable endpoint. As a lib
// function it is unreachable from the network. (Audit fix.)
// ============================================================
