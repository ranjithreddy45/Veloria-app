import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import type { ApprovalCondition } from "@/schemas/approval.schema";

// ============================================================
// Approval Engine — Core approval workflow logic
// ============================================================
// This is a plain library file (NOT "use server").
// Provides reusable functions for the approval process.

// ============================================================
// Condition Evaluation (same operator logic as assignment rules)
// ============================================================

function evaluateCondition(
  entityData: Record<string, unknown>,
  condition: ApprovalCondition
): boolean {
  const fieldValue = entityData[condition.field];
  const condValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(fieldValue ?? "") === String(condValue ?? "");
    case "contains":
      return String(fieldValue ?? "")
        .toLowerCase()
        .includes(String(condValue ?? "").toLowerCase());
    case "in": {
      const list = Array.isArray(condValue) ? condValue : [];
      return list.includes(String(fieldValue));
    }
    case "notIn": {
      const list = Array.isArray(condValue) ? condValue : [];
      return !list.includes(String(fieldValue));
    }
    case "gt":
      return Number(fieldValue) > Number(condValue);
    case "gte":
      return Number(fieldValue) >= Number(condValue);
    case "lt":
      return Number(fieldValue) < Number(condValue);
    case "lte":
      return Number(fieldValue) <= Number(condValue);
    default:
      return false;
  }
}

// ============================================================
// Fetch Entity Data
// ============================================================

async function getEntityData(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  try {
    switch (entityType) {
      case "QUOTE": {
        const quote = await prisma.quote.findUnique({ where: { id: entityId } });
        return quote ? (JSON.parse(JSON.stringify(quote)) as Record<string, unknown>) : null;
      }
      case "DEAL": {
        const deal = await prisma.deal.findUnique({ where: { id: entityId } });
        return deal ? (JSON.parse(JSON.stringify(deal)) as Record<string, unknown>) : null;
      }
      case "BOOKING": {
        const booking = await prisma.booking.findUnique({ where: { id: entityId } });
        return booking ? (JSON.parse(JSON.stringify(booking)) as Record<string, unknown>) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ============================================================
// Check if Approval is Required
// ============================================================

export async function checkApprovalRequired(
  entityType: string,
  entityId: string
): Promise<{
  id: string;
  name: string;
  entityType: string;
  conditions: ApprovalCondition[];
  approverChain: { id: string; order: number; approverType: string; approverId: string; isOptional: boolean }[];
} | null> {
  try {
    const entityData = await getEntityData(entityType, entityId);
    if (!entityData) return null;

    // Find all active rules for this entity type, ordered by priority
    const rules = await prisma.approvalRule.findMany({
      where: { entityType, isActive: true },
      orderBy: { priority: "asc" },
      include: {
        approverChain: { orderBy: { order: "asc" } },
      },
    });

    for (const rule of rules) {
      const conditions = rule.conditions as unknown as ApprovalCondition[];

      // If no conditions, rule always matches
      if (!conditions || conditions.length === 0) {
        return {
          id: rule.id,
          name: rule.name,
          entityType: rule.entityType,
          conditions,
          approverChain: rule.approverChain.map((step) => ({
            id: step.id,
            order: step.order,
            approverType: step.approverType,
            approverId: step.approverId,
            isOptional: step.isOptional,
          })),
        };
      }

      // All conditions must match (AND logic)
      let allMatch = true;
      for (const condition of conditions) {
        if (!evaluateCondition(entityData, condition)) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        return {
          id: rule.id,
          name: rule.name,
          entityType: rule.entityType,
          conditions,
          approverChain: rule.approverChain.map((step) => ({
            id: step.id,
            order: step.order,
            approverType: step.approverType,
            approverId: step.approverId,
            isOptional: step.isOptional,
          })),
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[APPROVAL_ENGINE] checkApprovalRequired error:", error);
    return null;
  }
}

// ============================================================
// Submit for Approval
// ============================================================

export async function submitForApproval(
  entityType: string,
  entityId: string,
  ruleId: string,
  userId: string
) {
  try {
    // Get entity snapshot
    const metadata = await getEntityData(entityType, entityId);

    // Create the approval request
    const request = await prisma.approvalRequest.create({
      data: {
        entityType,
        entityId,
        ruleId,
        submittedById: userId,
        currentStep: 0,
        status: "PENDING_APPROVAL",
        metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        rule: {
          include: {
            approverChain: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    // Notify the first approver in the chain
    const firstStep = request.rule.approverChain[0];
    if (firstStep) {
      await notifyApprover(firstStep, request.id, entityType, entityId, metadata);
    }

    logActivity({
      userId,
      action: "SUBMIT_FOR_APPROVAL",
      entityType: "ApprovalRequest",
      entityId: request.id,
      changes: { entityType, entityId, ruleId },
    });

    return request;
  } catch (error) {
    console.error("[APPROVAL_ENGINE] submitForApproval error:", error);
    throw error;
  }
}

// ============================================================
// Advance Approval Chain
// ============================================================

export async function advanceApprovalChain(requestId: string) {
  try {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        rule: {
          include: {
            approverChain: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!request) throw new Error("Approval request not found");

    const chain = request.rule.approverChain;
    const nextStepIndex = request.currentStep + 1;

    if (nextStepIndex < chain.length) {
      // More steps in chain — advance to the next step
      const updatedRequest = await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { currentStep: nextStepIndex },
        include: {
          rule: {
            include: {
              approverChain: { orderBy: { order: "asc" } },
            },
          },
        },
      });

      // Notify next approver
      const nextStep = chain[nextStepIndex];
      if (nextStep) {
        const metadata = request.metadata as Record<string, unknown> | null;
        await notifyApprover(
          nextStep,
          requestId,
          request.entityType,
          request.entityId,
          metadata
        );
      }

      return updatedRequest;
    } else {
      // Last step — mark as approved
      const updatedRequest = await prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          resolvedAt: new Date(),
        },
        include: {
          rule: {
            include: {
              approverChain: { orderBy: { order: "asc" } },
            },
          },
        },
      });

      // Notify the submitter
      notify({
        userId: request.submittedById,
        type: "LEAD_ASSIGNED",
        title: "Approval Granted",
        message: `Your ${request.entityType.toLowerCase()} has been fully approved.`,
        actionUrl: `/approvals/${requestId}`,
      });

      logActivity({
        userId: "system",
        action: "APPROVAL_COMPLETED",
        entityType: "ApprovalRequest",
        entityId: requestId,
        changes: { status: "APPROVED" },
      });

      return updatedRequest;
    }
  } catch (error) {
    console.error("[APPROVAL_ENGINE] advanceApprovalChain error:", error);
    throw error;
  }
}

// ============================================================
// Notify Approver Helper
// ============================================================

async function notifyApprover(
  step: { approverType: string; approverId: string },
  requestId: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> | null
) {
  const entityLabel =
    (metadata?.name as string) ||
    (metadata?.eventName as string) ||
    (metadata?.title as string) ||
    entityId;

  if (step.approverType === "USER") {
    notify({
      userId: step.approverId,
      type: "LEAD_ASSIGNED",
      title: "New Approval Required",
      message: `${entityType} "${entityLabel}" requires your approval.`,
      actionUrl: `/approvals/${requestId}`,
    });
  } else if (step.approverType === "ROLE") {
    // Notify all active users with matching role
    const roleUsers = await prisma.user.findMany({
      where: {
        role: step.approverId as import("@prisma/client").UserRole,
        isActive: true,
      },
      select: { id: true },
    });

    for (const user of roleUsers) {
      notify({
        userId: user.id,
        type: "LEAD_ASSIGNED",
        title: "New Approval Required",
        message: `${entityType} "${entityLabel}" requires your approval.`,
        actionUrl: `/approvals/${requestId}`,
      });
    }
  }
}
