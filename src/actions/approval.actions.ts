"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import {
  approvalRuleSchema,
  approvalChainStepSchema,
  approvalDecisionSchema,
  type ApprovalRuleInput,
  type ApprovalChainStepInput,
  type ApprovalDecisionInput,
  type ApprovalCondition,
} from "@/schemas/approval.schema";
import {
  advanceApprovalChain,
} from "@/lib/approval-engine";
import { z } from "zod";

// ============================================================
// Types
// ============================================================

export interface ApprovalRuleData {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  conditions: ApprovalCondition[];
  createdAt: string;
  updatedAt: string;
  approverChain: ApprovalChainStepData[];
  _count?: { requests: number };
}

export interface ApprovalChainStepData {
  id: string;
  order: number;
  approverType: string;
  approverId: string;
  isOptional: boolean;
}

export interface ApprovalRequestData {
  id: string;
  status: string;
  entityType: string;
  entityId: string;
  currentStep: number;
  submittedAt: string;
  resolvedAt: string | null;
  metadata: Record<string, unknown> | null;
  ruleId: string;
  submittedById: string;
  rule: {
    id: string;
    name: string;
    entityType: string;
    approverChain: ApprovalChainStepData[];
  };
  submittedBy?: { id: string; name: string | null; email: string };
  decisions: ApprovalDecisionData[];
}

export interface ApprovalDecisionData {
  id: string;
  action: string;
  comment: string | null;
  stepOrder: number;
  decidedAt: string;
  requestId: string;
  decidedById: string;
  delegatedToId: string | null;
  decidedBy?: { id: string; name: string | null; email: string };
  delegatedTo?: { id: string; name: string | null; email: string } | null;
}

// ============================================================
// Helper: Enrich request with user data
// ============================================================

async function enrichRequestWithUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any
): Promise<ApprovalRequestData> {
  // Collect all user IDs we need to look up
  const userIds = new Set<string>();
  if (request.submittedById) userIds.add(request.submittedById);
  for (const decision of request.decisions ?? []) {
    if (decision.decidedById) userIds.add(decision.decidedById);
    if (decision.delegatedToId) userIds.add(decision.delegatedToId);
  }

  // Batch-fetch users
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const serialized = serialize(request);

  return {
    ...serialized,
    submittedBy: userMap.get(request.submittedById) ?? undefined,
    decisions: (serialized.decisions ?? []).map((d: ApprovalDecisionData) => ({
      ...d,
      decidedBy: userMap.get(d.decidedById) ?? undefined,
      delegatedTo: d.delegatedToId ? userMap.get(d.delegatedToId) ?? null : null,
    })),
  } as ApprovalRequestData;
}

// ============================================================
// Approval Rules CRUD
// ============================================================

export async function getApprovalRules(): Promise<
  | { success: true; data: ApprovalRuleData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const rules = await prisma.approvalRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        approverChain: { orderBy: { order: "asc" } },
        _count: { select: { requests: true } },
      },
    });

    return { success: true as const, data: serialize(rules) as unknown as ApprovalRuleData[] };
  } catch (error) {
    console.error("getApprovalRules error:", error);
    return { success: false as const, error: "Failed to load approval rules" };
  }
}

export async function getApprovalRule(
  id: string
): Promise<
  | { success: true; data: ApprovalRuleData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const rule = await prisma.approvalRule.findUnique({
      where: { id },
      include: {
        approverChain: { orderBy: { order: "asc" } },
        _count: { select: { requests: true } },
      },
    });

    if (!rule) {
      return { success: false as const, error: "Approval rule not found" };
    }

    return { success: true as const, data: serialize(rule) as unknown as ApprovalRuleData };
  } catch (error) {
    console.error("getApprovalRule error:", error);
    return { success: false as const, error: "Failed to load approval rule" };
  }
}

export async function createApprovalRule(
  input: ApprovalRuleInput,
  chainSteps: ApprovalChainStepInput[]
): Promise<
  | { success: true; data: ApprovalRuleData }
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

    const parsed = approvalRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    // Validate chain steps
    const stepsSchema = z.array(approvalChainStepSchema);
    const stepsParsed = stepsSchema.safeParse(chainSteps);
    if (!stepsParsed.success) {
      return { success: false as const, error: stepsParsed.error.issues[0]?.message ?? "Invalid chain steps" };
    }

    const data = parsed.data;
    const steps = stepsParsed.data;

    const rule = await prisma.$transaction(async (tx) => {
      const created = await tx.approvalRule.create({
        data: {
          name: data.name,
          entityType: data.entityType,
          description: data.description ?? null,
          isActive: data.isActive,
          priority: data.priority,
          conditions: data.conditions as unknown as object,
          approverChain: {
            create: steps.map((step) => ({
              order: step.order,
              approverType: step.approverType,
              approverId: step.approverId,
              isOptional: step.isOptional,
            })),
          },
        },
        include: {
          approverChain: { orderBy: { order: "asc" } },
          _count: { select: { requests: true } },
        },
      });

      return created;
    });

    logActivity({
      action: "CREATE_APPROVAL_RULE",
      entityType: "ApprovalRule",
      entityId: rule.id,
      changes: { name: rule.name, entityType: rule.entityType },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(rule) as unknown as ApprovalRuleData };
  } catch (error) {
    console.error("createApprovalRule error:", error);
    return { success: false as const, error: "Failed to create approval rule" };
  }
}

export async function updateApprovalRule(
  id: string,
  input: ApprovalRuleInput,
  chainSteps: ApprovalChainStepInput[]
): Promise<
  | { success: true; data: ApprovalRuleData }
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

    const parsed = approvalRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const stepsSchema = z.array(approvalChainStepSchema);
    const stepsParsed = stepsSchema.safeParse(chainSteps);
    if (!stepsParsed.success) {
      return { success: false as const, error: stepsParsed.error.issues[0]?.message ?? "Invalid chain steps" };
    }

    const data = parsed.data;
    const steps = stepsParsed.data;

    const rule = await prisma.$transaction(async (tx) => {
      // Delete existing chain steps
      await tx.approvalChainStep.deleteMany({ where: { ruleId: id } });

      // Update rule and create new chain steps
      const updated = await tx.approvalRule.update({
        where: { id },
        data: {
          name: data.name,
          entityType: data.entityType,
          description: data.description ?? null,
          isActive: data.isActive,
          priority: data.priority,
          conditions: data.conditions as unknown as object,
          approverChain: {
            create: steps.map((step) => ({
              order: step.order,
              approverType: step.approverType,
              approverId: step.approverId,
              isOptional: step.isOptional,
            })),
          },
        },
        include: {
          approverChain: { orderBy: { order: "asc" } },
          _count: { select: { requests: true } },
        },
      });

      return updated;
    });

    logActivity({
      action: "UPDATE_APPROVAL_RULE",
      entityType: "ApprovalRule",
      entityId: rule.id,
      changes: { name: rule.name },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(rule) as unknown as ApprovalRuleData };
  } catch (error) {
    console.error("updateApprovalRule error:", error);
    return { success: false as const, error: "Failed to update approval rule" };
  }
}

export async function deleteApprovalRule(
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

    await prisma.approvalRule.delete({ where: { id } });

    logActivity({
      action: "DELETE_APPROVAL_RULE",
      entityType: "ApprovalRule",
      entityId: id,
      changes: {},
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("deleteApprovalRule error:", error);
    return { success: false as const, error: "Failed to delete approval rule" };
  }
}

export async function toggleApprovalRule(
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

    await prisma.approvalRule.update({
      where: { id },
      data: { isActive },
    });

    logActivity({
      action: "TOGGLE_APPROVAL_RULE",
      entityType: "ApprovalRule",
      entityId: id,
      changes: { isActive },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("toggleApprovalRule error:", error);
    return { success: false as const, error: "Failed to toggle approval rule" };
  }
}

// ============================================================
// Approval Queue
// ============================================================

export async function getMyPendingApprovals(): Promise<
  | { success: true; data: ApprovalRequestData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const userRole = (session.user as { role?: string }).role ?? "";

    // Get all pending requests
    const pendingRequests = await prisma.approvalRequest.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: {
        rule: {
          include: {
            approverChain: { orderBy: { order: "asc" } },
          },
        },
        decisions: {
          orderBy: { decidedAt: "asc" },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    // Filter to requests where the current user is the active approver
    const myApprovals = pendingRequests.filter((request) => {
      const currentChainStep = request.rule.approverChain[request.currentStep];
      if (!currentChainStep) return false;

      // Check for delegation — if the last decision is a DELEGATE to this user
      const lastDecision = request.decisions[request.decisions.length - 1];
      if (lastDecision?.action === "DELEGATE" && lastDecision.delegatedToId === userId) {
        return true;
      }

      if (currentChainStep.approverType === "USER") {
        return currentChainStep.approverId === userId;
      }

      if (currentChainStep.approverType === "ROLE") {
        return currentChainStep.approverId === userRole;
      }

      return false;
    });

    // Enrich each request with user data
    const enriched = await Promise.all(
      myApprovals.map((req) => enrichRequestWithUsers(req))
    );

    return {
      success: true as const,
      data: enriched,
    };
  } catch (error) {
    console.error("getMyPendingApprovals error:", error);
    return { success: false as const, error: "Failed to load pending approvals" };
  }
}

export async function getPendingApprovalsCount(): Promise<
  | { success: true; data: number }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const result = await getMyPendingApprovals();
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    return { success: true as const, data: result.data.length };
  } catch (error) {
    console.error("getPendingApprovalsCount error:", error);
    return { success: false as const, error: "Failed to count pending approvals" };
  }
}

export async function getApprovalRequest(
  id: string
): Promise<
  | { success: true; data: ApprovalRequestData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        rule: {
          include: {
            approverChain: { orderBy: { order: "asc" } },
          },
        },
        decisions: {
          orderBy: { decidedAt: "asc" },
        },
      },
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    const enriched = await enrichRequestWithUsers(request);

    return {
      success: true as const,
      data: enriched,
    };
  } catch (error) {
    console.error("getApprovalRequest error:", error);
    return { success: false as const, error: "Failed to load approval request" };
  }
}

// ============================================================
// Approval Decisions
// ============================================================

export async function approveRequest(
  requestId: string,
  comment?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = approvalDecisionSchema.safeParse({
      action: "APPROVE",
      comment: comment ?? null,
    });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        rule: {
          include: { approverChain: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    // Create the approval decision
    await prisma.approvalDecision.create({
      data: {
        action: "APPROVE",
        comment: comment ?? null,
        stepOrder: request.currentStep,
        requestId,
        decidedById: session.user.id,
      },
    });

    // Advance the chain
    await advanceApprovalChain(requestId);

    logActivity({
      action: "APPROVE_REQUEST",
      entityType: "ApprovalRequest",
      entityId: requestId,
      changes: { action: "APPROVE", step: request.currentStep },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("approveRequest error:", error);
    return { success: false as const, error: "Failed to approve request" };
  }
}

export async function rejectRequest(
  requestId: string,
  comment: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = approvalDecisionSchema.safeParse({
      action: "REJECT",
      comment,
    });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    if (!comment?.trim()) {
      return { success: false as const, error: "A comment is required when rejecting" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    // Create the reject decision
    await prisma.approvalDecision.create({
      data: {
        action: "REJECT",
        comment,
        stepOrder: request.currentStep,
        requestId,
        decidedById: session.user.id,
      },
    });

    // Update request status
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
      },
    });

    // Notify submitter
    notify({
      userId: request.submittedById,
      type: "SYSTEM",
      title: "Approval Rejected",
      message: `Your ${request.entityType.toLowerCase()} approval request has been rejected.`,
      actionUrl: `/approvals/${requestId}`,
    });

    logActivity({
      action: "REJECT_REQUEST",
      entityType: "ApprovalRequest",
      entityId: requestId,
      changes: { action: "REJECT", comment },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("rejectRequest error:", error);
    return { success: false as const, error: "Failed to reject request" };
  }
}

export async function delegateRequest(
  requestId: string,
  delegateToUserId: string,
  comment?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = approvalDecisionSchema.safeParse({
      action: "DELEGATE",
      comment: comment ?? null,
      delegatedToId: delegateToUserId,
    });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    if (!delegateToUserId) {
      return { success: false as const, error: "Delegate user is required" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    // Create the delegate decision
    await prisma.approvalDecision.create({
      data: {
        action: "DELEGATE",
        comment: comment ?? null,
        stepOrder: request.currentStep,
        requestId,
        decidedById: session.user.id,
        delegatedToId: delegateToUserId,
      },
    });

    // Notify delegate
    notify({
      userId: delegateToUserId,
      type: "SYSTEM",
      title: "Approval Delegated to You",
      message: `An approval for ${request.entityType.toLowerCase()} has been delegated to you.`,
      actionUrl: `/approvals/${requestId}`,
    });

    logActivity({
      action: "DELEGATE_REQUEST",
      entityType: "ApprovalRequest",
      entityId: requestId,
      changes: { action: "DELEGATE", delegateToUserId },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("delegateRequest error:", error);
    return { success: false as const, error: "Failed to delegate request" };
  }
}

export async function cancelApprovalRequest(
  requestId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.submittedById !== session.user.id) {
      return { success: false as const, error: "Only the submitter can cancel a request" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Only pending requests can be cancelled" };
    }

    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        resolvedAt: new Date(),
      },
    });

    logActivity({
      action: "CANCEL_APPROVAL_REQUEST",
      entityType: "ApprovalRequest",
      entityId: requestId,
      changes: { status: "CANCELLED" },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("cancelApprovalRequest error:", error);
    return { success: false as const, error: "Failed to cancel request" };
  }
}

// ============================================================
// Approval History
// ============================================================

export async function getApprovalHistory(params?: {
  entityType?: string;
  entityId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<
  | {
      success: true;
      data: {
        requests: ApprovalRequestData[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.entityType) {
      where.entityType = params.entityType;
    }
    if (params?.entityId) {
      where.entityId = params.entityId;
    }
    if (params?.status) {
      where.status = params.status;
    }

    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          rule: {
            include: {
              approverChain: { orderBy: { order: "asc" } },
            },
          },
          decisions: {
            orderBy: { decidedAt: "asc" },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    // Enrich each request with user data
    const enriched = await Promise.all(
      requests.map((req) => enrichRequestWithUsers(req))
    );

    return {
      success: true as const,
      data: {
        requests: enriched,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error("getApprovalHistory error:", error);
    return { success: false as const, error: "Failed to load approval history" };
  }
}
