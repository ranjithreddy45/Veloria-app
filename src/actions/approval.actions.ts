"use server";

import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
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

    if (!hasPermission(session.user.role, "settings:update")) {
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

    revalidatePath("/settings/approval-rules");
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

    if (!hasPermission(session.user.role, "settings:update")) {
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

    revalidatePath("/settings/approval-rules");
    revalidatePath(`/settings/approval-rules/${id}`);
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

    if (!hasPermission(session.user.role, "settings:update")) {
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

    revalidatePath("/settings/approval-rules");
    revalidatePath(`/settings/approval-rules/${id}`);
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

    if (!hasPermission(session.user.role, "settings:update")) {
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

    revalidatePath("/settings/approval-rules");
    revalidatePath(`/settings/approval-rules/${id}`);
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
      // Chain steps are ordered by `order`, which may be non-contiguous —
      // select by matching `order` to currentStep, not by array index.
      const currentChainStep = request.rule.approverChain.find(
        (s) => s.order === request.currentStep
      );
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

    const userId = session.user.id;
    const userRole = (session.user as { role?: string }).role ?? "";

    // Lighter than getMyPendingApprovals: skip the user-enrichment pipeline and
    // only load the fields needed to decide whether the user is the active
    // approver, then count the matches. Powers the nav badge.
    const pendingRequests = await prisma.approvalRequest.findMany({
      where: { status: "PENDING_APPROVAL" },
      select: {
        currentStep: true,
        rule: {
          select: {
            approverChain: {
              orderBy: { order: "asc" },
              select: { order: true, approverType: true, approverId: true },
            },
          },
        },
        decisions: {
          orderBy: { decidedAt: "asc" },
          select: { action: true, delegatedToId: true },
        },
      },
    });

    const count = pendingRequests.filter((request) => {
      // Chain steps are ordered by `order` (possibly non-contiguous) — match
      // by `order`, not array index.
      const currentChainStep = request.rule.approverChain.find(
        (s) => s.order === request.currentStep
      );
      if (!currentChainStep) return false;

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
    }).length;

    return { success: true as const, data: count };
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

    // Authorization: an approval request exposes the submitter's identity and
    // the full decision/chain history. Only parties to the request may view it —
    // the submitter, any approver in the chain (USER by id or ROLE by role), a
    // user who was delegated a step, or an admin. Authentication alone is not
    // sufficient (would be IDOR — any user could read any request by id).
    const viewerId = session.user.id;
    const viewerRole = (session.user as { role?: string }).role ?? "";
    const isAdmin = viewerRole === "SUPER_ADMIN" || viewerRole === "ADMIN";
    const isSubmitter = request.submittedById === viewerId;
    const isChainApprover = request.rule.approverChain.some(
      (s) =>
        (s.approverType === "USER" && s.approverId === viewerId) ||
        (s.approverType === "ROLE" && s.approverId === viewerRole)
    );
    const isDelegate = request.decisions.some(
      (d) => d.action === "DELEGATE" && d.delegatedToId === viewerId
    );
    if (!isAdmin && !isSubmitter && !isChainApprover && !isDelegate) {
      return { success: false as const, error: "You are not authorized to view this approval request." };
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

// Prisma include that loads everything needed to authorize an approval action.
const APPROVER_INCLUDE = {
  rule: { include: { approverChain: { orderBy: { order: "asc" as const } } } },
  decisions: { orderBy: { decidedAt: "asc" as const } },
};

// Returns an error string if `userId`/`userRole` is NOT the authorized approver
// for the request's current chain step (or an admin / a valid delegate), else
// null. Mirrors getMyPendingApprovals' visibility logic — the UI hiding a
// button is not server-side authorization.
function approverAuthError(
  request: {
    currentStep: number;
    submittedById: string;
    rule: { approverChain: { order: number; approverType: string; approverId: string }[] };
    decisions: { action: string; delegatedToId: string | null }[];
  },
  userId: string,
  userRole: string
): string | null {
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  // Integrity: no one approves their own request — except SUPER_ADMIN, who is
  // never gated by the approval process in any module.
  if (request.submittedById === userId && userRole !== "SUPER_ADMIN")
    return "You can't act on your own approval request.";
  // Chain steps are ordered by `order` (possibly non-contiguous) — select by
  // matching `order` to currentStep, not by array index.
  const step = request.rule.approverChain.find((s) => s.order === request.currentStep);
  const last = request.decisions[request.decisions.length - 1];
  const delegatedToMe = last?.action === "DELEGATE" && last.delegatedToId === userId;
  const isStepApprover =
    !!step &&
    ((step.approverType === "USER" && step.approverId === userId) ||
      (step.approverType === "ROLE" && step.approverId === userRole));
  if (delegatedToMe || isStepApprover || isAdmin) return null;
  return "You are not authorized to act on this approval step.";
}

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
      include: APPROVER_INCLUDE,
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    const authErr = approverAuthError(request, session.user.id, (session.user as { role?: string }).role ?? "");
    if (authErr) return { success: false as const, error: authErr };

    const expectedStep = request.currentStep;
    const chain = request.rule.approverChain;
    // Chain step `order` values may be non-contiguous (e.g. [0, 5, 10]).
    // `currentStep` stores the `order` of the active step, not an array index —
    // so the next step must be found by the next-greater `order`, never by
    // arithmetic (+1) or array length. `chain` is ordered by `order` asc, so the
    // first step whose order exceeds expectedStep is the next approver.
    const nextStep = chain.find((s) => s.order > expectedStep) ?? null;
    const isLastStep = nextStep === null;
    const nextStepOrder = nextStep?.order ?? null;

    // Atomically claim AND apply this step's transition in one compare-and-set
    // keyed on (id, currentStep, status). Concurrent approvals (or a
    // double-submit) on the same PENDING_APPROVAL request all read the same
    // currentStep, but only the first writer's updateMany matches the guard and
    // performs the state change; every later writer sees count 0 and bails.
    // This prevents two approvers from both recording an APPROVE decision and
    // both advancing the chain (double-skipping a middle step, or double-firing
    // the submitter notification / APPROVAL_COMPLETED log on the final step).
    // The transition mirrors advanceApprovalChain so behavior is unchanged; we
    // run only its post-transition side effects below, exactly once.
    // Wrap the compare-and-set transition AND its decision/audit row in one
    // transaction so a half-commit can't advance/approve the request while
    // losing the corresponding decision record. notify/logActivity stay
    // outside the transaction.
    const claimCount = await prisma.$transaction(async (tx) => {
      const claim = await tx.approvalRequest.updateMany({
        where: { id: requestId, currentStep: expectedStep, status: "PENDING_APPROVAL" },
        data: isLastStep
          ? { status: "APPROVED", resolvedAt: new Date() }
          : { currentStep: nextStepOrder as number },
      });
      if (claim.count === 0) {
        return 0;
      }

      // Create the approval decision (only the winning writer reaches here)
      await tx.approvalDecision.create({
        data: {
          action: "APPROVE",
          comment: comment ?? null,
          stepOrder: expectedStep,
          requestId,
          decidedById: session.user.id,
        },
      });

      return claim.count;
    });

    if (claimCount === 0) {
      return { success: false as const, error: "Request is no longer pending" };
    }

    // Post-transition side effects (the state change itself already happened
    // atomically above, exactly once).
    if (isLastStep) {
      // Fully approved — notify the submitter and log completion.
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
    } else {
      // Advanced to the next step — notify the next approver(s).
      if (nextStep) {
        const metadata = request.metadata as Record<string, unknown> | null;
        const entityLabel =
          (metadata?.name as string) ||
          (metadata?.eventName as string) ||
          (metadata?.title as string) ||
          request.entityId;
        if (nextStep.approverType === "USER") {
          notify({
            userId: nextStep.approverId,
            type: "LEAD_ASSIGNED",
            title: "New Approval Required",
            message: `${request.entityType} "${entityLabel}" requires your approval.`,
            actionUrl: `/approvals/${requestId}`,
          });
        } else if (nextStep.approverType === "ROLE") {
          const roleUsers = await prisma.user.findMany({
            where: {
              role: nextStep.approverId as import("@prisma/client").UserRole,
              isActive: true,
            },
            select: { id: true },
          });
          for (const u of roleUsers) {
            notify({
              userId: u.id,
              type: "LEAD_ASSIGNED",
              title: "New Approval Required",
              message: `${request.entityType} "${entityLabel}" requires your approval.`,
              actionUrl: `/approvals/${requestId}`,
            });
          }
        }
      }
    }

    logActivity({
      action: "APPROVE_REQUEST",
      entityType: "ApprovalRequest",
      entityId: requestId,
      changes: { action: "APPROVE", step: expectedStep },
      userId: session.user.id,
    });

    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
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
      include: APPROVER_INCLUDE,
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    const authErr = approverAuthError(request, session.user.id, (session.user as { role?: string }).role ?? "");
    if (authErr) return { success: false as const, error: authErr };

    const expectedStep = request.currentStep;

    // Atomically claim the rejection. Compare-and-set keyed on
    // (id, currentStep, status): only the first writer flips the request to
    // REJECTED; concurrent rejections / double-submits see count 0 and bail, so
    // the reject decision and the submitter notification fire exactly once.
    // Wrap the compare-and-set transition AND its decision/audit row in one
    // transaction so a half-commit can't reject the request while losing the
    // corresponding decision record. notify/logActivity stay outside.
    const claimCount = await prisma.$transaction(async (tx) => {
      const claim = await tx.approvalRequest.updateMany({
        where: { id: requestId, currentStep: expectedStep, status: "PENDING_APPROVAL" },
        data: {
          status: "REJECTED",
          resolvedAt: new Date(),
        },
      });
      if (claim.count === 0) {
        return 0;
      }

      // Create the reject decision (only the winning writer reaches here)
      await tx.approvalDecision.create({
        data: {
          action: "REJECT",
          comment,
          stepOrder: expectedStep,
          requestId,
          decidedById: session.user.id,
        },
      });

      return claim.count;
    });

    if (claimCount === 0) {
      return { success: false as const, error: "Request is no longer pending" };
    }

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

    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
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

    if (delegateToUserId === session.user.id) {
      return { success: false as const, error: "You cannot delegate to yourself" };
    }

    const delegatedUser = await prisma.user.findUnique({
      where: { id: delegateToUserId },
      select: { id: true },
    });
    if (!delegatedUser) {
      return { success: false as const, error: "User not found" };
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: APPROVER_INCLUDE,
    });

    if (!request) {
      return { success: false as const, error: "Approval request not found" };
    }

    if (request.status !== "PENDING_APPROVAL") {
      return { success: false as const, error: "Request is no longer pending" };
    }

    const authErr = approverAuthError(request, session.user.id, (session.user as { role?: string }).role ?? "");
    if (authErr) return { success: false as const, error: authErr };

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

    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
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

    revalidatePath("/approvals");
    revalidatePath(`/approvals/${requestId}`);
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
