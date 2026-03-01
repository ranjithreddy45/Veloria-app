import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Escalation Engine — Cron-triggered overdue task checker
// ============================================================
// This is a plain library file (NOT "use server").
// Called from the cron API route with no auth check.

export async function checkAllOverdueEscalations(): Promise<{
  totalChecked: number;
  newEscalations: number;
}> {
  const now = new Date();
  let totalChecked = 0;
  let newEscalations = 0;

  // Find all LIVE execution plans
  const livePlans = await prisma.executionPlan.findMany({
    where: { status: "LIVE" },
    select: { id: true, bookingId: true },
  });

  for (const plan of livePlans) {
    // Find overdue tasks for this plan
    const overdueTasks = await prisma.executionTask.findMany({
      where: {
        phase: {
          planId: plan.id,
        },
        slaFinishBy: { lt: now },
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      include: {
        assignee: {
          select: { id: true, name: true },
        },
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

    totalChecked += overdueTasks.length;

    for (const task of overdueTasks) {
      const delayMinutes = Math.floor(
        (now.getTime() - task.slaFinishBy!.getTime()) / 60000
      );

      // Find matching active escalation rules for this task's category and priority
      const matchingRules = await prisma.escalationRule.findMany({
        where: {
          category: task.category,
          priority: task.priority,
          isActive: true,
        },
        orderBy: { delayThresholdMinutes: "asc" },
      });

      for (const rule of matchingRules) {
        if (delayMinutes < rule.delayThresholdMinutes) {
          continue;
        }

        // Check if escalation already exists for this task + rule combination
        const existingEscalation = await prisma.escalation.findFirst({
          where: {
            taskId: task.id,
            ruleId: rule.id,
          },
        });

        if (existingEscalation) {
          continue;
        }

        const reason = `Task "${task.title}" is overdue by ${delayMinutes} minutes. Category: ${task.category}, Priority: ${task.priority}. Auto-escalated by system.`;

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

        // Send SLA_WARNING to the task assignee if exists
        if (task.assigneeId) {
          notify({
            userId: task.assigneeId,
            type: "SLA_WARNING",
            title: `SLA Warning: ${task.title}`,
            message: `Your task "${task.title}" for ${bookingName} is overdue by ${delayMinutes} minutes and has been escalated to ${rule.level}.`,
            actionUrl,
          });
        }

        logActivity({
          userId: "system",
          action: "created",
          entityType: "Escalation",
          entityId: escalation.id,
          changes: {
            taskId: task.id,
            ruleId: rule.id,
            level: rule.level,
            delayMinutes,
            auto: true,
          },
        });

        newEscalations++;
      }
    }
  }

  return { totalChecked, newEscalations };
}
