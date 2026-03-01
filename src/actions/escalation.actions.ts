"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createEscalationRuleSchema,
  updateEscalationRuleSchema,
  resolveEscalationSchema,
  type CreateEscalationRuleInput,
  type UpdateEscalationRuleInput,
  type ResolveEscalationInput,
} from "@/schemas/escalation.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Escalation Rules
// ============================================================

export async function getEscalationRules() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rules = await prisma.escalationRule.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { escalations: true },
        },
      },
    });

    return { success: true as const, data: serialize(rules) };
  } catch (error) {
    console.error("[GET_ESCALATION_RULES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch escalation rules" };
  }
}

// ============================================================
// Get Escalation Rule by ID
// ============================================================

export async function getEscalationRuleById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rule = await prisma.escalationRule.findUnique({
      where: { id },
      include: {
        escalations: {
          orderBy: { createdAt: "desc" },
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                category: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    if (!rule) {
      return { success: false as const, error: "Escalation rule not found" };
    }

    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[GET_ESCALATION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch escalation rule" };
  }
}

// ============================================================
// Create Escalation Rule
// ============================================================

export async function createEscalationRule(data: CreateEscalationRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createEscalationRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const ruleData = parsed.data;

    const rule = await prisma.escalationRule.create({
      data: {
        name: ruleData.name,
        category: ruleData.category,
        priority: ruleData.priority,
        delayThresholdMinutes: ruleData.delayThresholdMinutes,
        level: ruleData.level,
        notifyUserIds: ruleData.notifyUserIds,
        notifyRoles: ruleData.notifyRoles,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "EscalationRule",
      entityId: rule.id,
      changes: { name: rule.name, level: rule.level },
    });

    revalidatePath("/settings/escalation-rules");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[CREATE_ESCALATION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to create escalation rule" };
  }
}

// ============================================================
// Update Escalation Rule
// ============================================================

export async function updateEscalationRule(id: string, data: UpdateEscalationRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateEscalationRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.escalationRule.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Escalation rule not found" };
    }

    const rule = await prisma.escalationRule.update({
      where: { id },
      data: parsed.data,
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "EscalationRule",
      entityId: rule.id,
      changes: parsed.data,
    });

    revalidatePath("/settings/escalation-rules");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[UPDATE_ESCALATION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to update escalation rule" };
  }
}

// ============================================================
// Delete Escalation Rule
// ============================================================

export async function deleteEscalationRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.escalationRule.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Escalation rule not found" };
    }

    await prisma.escalationRule.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "EscalationRule",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/settings/escalation-rules");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_ESCALATION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to delete escalation rule" };
  }
}

// ============================================================
// Trigger Escalation
// ============================================================

export async function triggerEscalation(taskId: string, ruleId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const task = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: {
        phase: {
          include: {
            plan: {
              include: {
                booking: {
                  select: { id: true, eventName: true, bookingNumber: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      return { success: false as const, error: "Task not found" };
    }

    // Calculate delay in minutes
    const referenceTime = task.slaFinishBy ?? task.slaStartBy;
    if (!referenceTime) {
      return { success: false as const, error: "Task has no SLA deadline to calculate delay" };
    }

    const delayMinutes = Math.floor(
      (Date.now() - referenceTime.getTime()) / 60000
    );

    // Find matching rule
    let rule;
    if (ruleId) {
      rule = await prisma.escalationRule.findUnique({ where: { id: ruleId } });
      if (!rule) {
        return { success: false as const, error: "Escalation rule not found" };
      }
    } else {
      rule = await prisma.escalationRule.findFirst({
        where: {
          category: task.category,
          priority: task.priority,
          isActive: true,
          delayThresholdMinutes: { lte: delayMinutes },
        },
        orderBy: { delayThresholdMinutes: "asc" },
      });
    }

    if (!rule) {
      return { success: false as const, error: "No matching escalation rule found" };
    }

    const reason = `Task "${task.title}" is overdue by ${delayMinutes} minutes. Category: ${task.category}, Priority: ${task.priority}.`;

    const escalation = await prisma.escalation.create({
      data: {
        taskId: task.id,
        ruleId: rule.id,
        level: rule.level,
        reason,
        delayMinutes,
        status: "PENDING_ESCALATION",
      },
    });

    // Notify users specified in the rule
    const bookingName = task.phase?.plan?.booking?.eventName ?? "Unknown Event";
    for (const userId of rule.notifyUserIds) {
      notify({
        userId,
        type: "TASK_ESCALATED",
        title: `Escalation: ${task.title}`,
        message: `Task "${task.title}" for ${bookingName} has been escalated (${rule.level}). Overdue by ${delayMinutes} minutes.`,
        actionUrl: `/execution/${task.phase?.plan?.booking?.id}`,
      });
    }

    // Notify users matching the rule's notifyRoles
    if (rule.notifyRoles.length > 0) {
      const roleUsers = await prisma.user.findMany({
        where: { role: { in: rule.notifyRoles as import("@prisma/client").UserRole[] }, isActive: true },
        select: { id: true },
      });

      for (const user of roleUsers) {
        if (!rule.notifyUserIds.includes(user.id)) {
          notify({
            userId: user.id,
            type: "TASK_ESCALATED",
            title: `Escalation: ${task.title}`,
            message: `Task "${task.title}" for ${bookingName} has been escalated (${rule.level}). Overdue by ${delayMinutes} minutes.`,
            actionUrl: `/execution/${task.phase?.plan?.booking?.id}`,
          });
        }
      }
    }

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Escalation",
      entityId: escalation.id,
      changes: { taskId, level: rule.level, delayMinutes },
    });

    revalidatePath("/execution");
    return { success: true as const, data: serialize(escalation) };
  } catch (error) {
    console.error("[TRIGGER_ESCALATION_ERROR]", error);
    return { success: false as const, error: "Failed to trigger escalation" };
  }
}

// ============================================================
// Acknowledge Escalation
// ============================================================

export async function acknowledgeEscalation(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const escalation = await prisma.escalation.findUnique({
      where: { id },
      include: {
        task: {
          select: { id: true, title: true },
        },
      },
    });

    if (!escalation) {
      return { success: false as const, error: "Escalation not found" };
    }

    if (escalation.status !== "PENDING_ESCALATION") {
      return {
        success: false as const,
        error: "Escalation is not in pending status",
      };
    }

    const updated = await prisma.escalation.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: session.user.id,
      },
    });

    notify({
      userId: session.user.id,
      type: "ESCALATION_ACKNOWLEDGED",
      title: `Escalation Acknowledged`,
      message: `Escalation for task "${escalation.task.title}" has been acknowledged.`,
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Escalation",
      entityId: id,
      changes: { status: "ACKNOWLEDGED" },
    });

    revalidatePath("/execution");
    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[ACKNOWLEDGE_ESCALATION_ERROR]", error);
    return { success: false as const, error: "Failed to acknowledge escalation" };
  }
}

// ============================================================
// Resolve Escalation
// ============================================================

export async function resolveEscalation(id: string, data: ResolveEscalationInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = resolveEscalationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const escalation = await prisma.escalation.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            phase: {
              include: {
                plan: {
                  select: { bookingId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!escalation) {
      return { success: false as const, error: "Escalation not found" };
    }

    const updated = await prisma.escalation.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: session.user.id,
        resolutionNotes: parsed.data.resolutionNotes,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Escalation",
      entityId: id,
      changes: { status: "RESOLVED", resolutionNotes: parsed.data.resolutionNotes },
    });

    revalidatePath("/execution");
    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[RESOLVE_ESCALATION_ERROR]", error);
    return { success: false as const, error: "Failed to resolve escalation" };
  }
}

// ============================================================
// Get Task Escalations
// ============================================================

export async function getTaskEscalations(taskId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const escalations = await prisma.escalation.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      include: {
        acknowledgedBy: {
          select: { id: true, name: true, email: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
        rule: {
          select: { id: true, name: true, level: true },
        },
      },
    });

    return { success: true as const, data: serialize(escalations) };
  } catch (error) {
    console.error("[GET_TASK_ESCALATIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch task escalations" };
  }
}

// ============================================================
// Get Active Escalations
// ============================================================

export async function getActiveEscalations(bookingId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: { in: ["PENDING_ESCALATION", "ACKNOWLEDGED"] },
    };

    if (bookingId) {
      where.task = {
        phase: {
          plan: {
            bookingId,
          },
        },
      };
    }

    const escalations = await prisma.escalation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            category: true,
            priority: true,
            assignee: {
              select: { id: true, name: true, email: true },
            },
            phase: {
              select: { name: true },
            },
          },
        },
        rule: {
          select: { id: true, name: true, level: true },
        },
      },
    });

    return { success: true as const, data: serialize(escalations) };
  } catch (error) {
    console.error("[GET_ACTIVE_ESCALATIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch active escalations" };
  }
}

// ============================================================
// Check and Escalate Overdue Tasks
// ============================================================

export async function checkAndEscalateOverdueTasks(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "escalations:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();

    // Find all overdue tasks for this booking
    const overdueTasks = await prisma.executionTask.findMany({
      where: {
        phase: {
          plan: {
            bookingId,
            status: "LIVE",
          },
        },
        slaFinishBy: { lt: now },
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      include: {
        phase: {
          include: {
            plan: {
              include: {
                booking: {
                  select: { id: true, eventName: true },
                },
              },
            },
          },
        },
      },
    });

    let newEscalationCount = 0;

    for (const task of overdueTasks) {
      const delayMinutes = Math.floor(
        (now.getTime() - task.slaFinishBy!.getTime()) / 60000
      );

      // Find matching active rules
      const matchingRules = await prisma.escalationRule.findMany({
        where: {
          category: task.category,
          priority: task.priority,
          isActive: true,
          delayThresholdMinutes: { lte: delayMinutes },
        },
        orderBy: { delayThresholdMinutes: "asc" },
      });

      for (const rule of matchingRules) {
        // Check if escalation already exists at this level for this task
        const existingEscalation = await prisma.escalation.findFirst({
          where: {
            taskId: task.id,
            ruleId: rule.id,
          },
        });

        if (!existingEscalation) {
          const reason = `Task "${task.title}" is overdue by ${delayMinutes} minutes. Category: ${task.category}, Priority: ${task.priority}. Auto-escalated.`;

          const escalation = await prisma.escalation.create({
            data: {
              taskId: task.id,
              ruleId: rule.id,
              level: rule.level,
              reason,
              delayMinutes,
              status: "PENDING_ESCALATION",
            },
          });

          const bookingName = task.phase?.plan?.booking?.eventName ?? "Unknown Event";
          const actionUrl = `/execution/${task.phase?.plan?.booking?.id}`;

          // Notify users specified in the rule
          for (const userId of rule.notifyUserIds) {
            notify({
              userId,
              type: "TASK_ESCALATED",
              title: `Escalation: ${task.title}`,
              message: `Task "${task.title}" for ${bookingName} has been escalated (${rule.level}). Overdue by ${delayMinutes} minutes.`,
              actionUrl,
            });
          }

          // Notify users matching the rule's notifyRoles
          if (rule.notifyRoles.length > 0) {
            const roleUsers = await prisma.user.findMany({
              where: { role: { in: rule.notifyRoles as import("@prisma/client").UserRole[] }, isActive: true },
              select: { id: true },
            });

            for (const user of roleUsers) {
              if (!rule.notifyUserIds.includes(user.id)) {
                notify({
                  userId: user.id,
                  type: "TASK_ESCALATED",
                  title: `Escalation: ${task.title}`,
                  message: `Task "${task.title}" for ${bookingName} has been escalated (${rule.level}). Overdue by ${delayMinutes} minutes.`,
                  actionUrl,
                });
              }
            }
          }

          logActivity({
            userId: session.user.id,
            action: "created",
            entityType: "Escalation",
            entityId: escalation.id,
            changes: { taskId: task.id, level: rule.level, delayMinutes, auto: true },
          });

          newEscalationCount++;
        }
      }
    }

    revalidatePath("/execution");
    return {
      success: true as const,
      data: { totalChecked: overdueTasks.length, newEscalations: newEscalationCount },
    };
  } catch (error) {
    console.error("[CHECK_ESCALATE_OVERDUE_ERROR]", error);
    return { success: false as const, error: "Failed to check and escalate overdue tasks" };
  }
}
