"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  workflowSchema,
  executeWorkflowContextSchema,
  type WorkflowInput,
  type ExecuteWorkflowContext,
} from "@/schemas/workflow.schema";
import type { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";

// ============================================================
// Get Workflows (List with log counts)
// ============================================================

export async function getWorkflows() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const workflows = await prisma.workflow.findMany({
      include: {
        _count: {
          select: { logs: true },
        },
        logs: {
          orderBy: { executedAt: "desc" },
          take: 1,
          select: { executedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = workflows.map((w) => ({
      ...w,
      lastRun: w.logs[0]?.executedAt ?? null,
      logs: undefined,
    }));

    return { success: true as const, data: serialize(data) };
  } catch (error) {
    console.error("[GET_WORKFLOWS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch workflows" };
  }
}

// ============================================================
// Get Single Workflow (with recent logs)
// ============================================================

export async function getWorkflow(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { executedAt: "desc" },
          take: 50,
        },
        _count: {
          select: { logs: true },
        },
      },
    });

    if (!workflow) {
      return { success: false as const, error: "Workflow not found" };
    }

    return { success: true as const, data: serialize(workflow) };
  } catch (error) {
    console.error("[GET_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to fetch workflow" };
  }
}

// ============================================================
// Create Workflow
// ============================================================

export async function createWorkflow(data: WorkflowInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = workflowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const workflowData = parsed.data;

    const workflow = await prisma.workflow.create({
      data: {
        name: workflowData.name,
        trigger: workflowData.trigger,
        actions: workflowData.actions as unknown as Prisma.InputJsonValue[],
        isActive: workflowData.isActive ?? true,
        delayMinutes: workflowData.delayMinutes ?? null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Workflow",
      entityId: workflow.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Workflow Created",
      message: `Workflow "${workflow.name}" has been created.`,
      actionUrl: `/settings/workflows/${workflow.id}`,
    });

    revalidatePath("/settings/workflows");
    return { success: true as const, data: serialize(workflow) };
  } catch (error) {
    console.error("[CREATE_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to create workflow" };
  }
}

// ============================================================
// Update Workflow
// ============================================================

export async function updateWorkflow(id: string, data: WorkflowInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = workflowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Workflow not found" };
    }

    const workflowData = parsed.data;

    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        name: workflowData.name,
        trigger: workflowData.trigger,
        actions: workflowData.actions as unknown as Prisma.InputJsonValue[],
        isActive: workflowData.isActive ?? existing.isActive,
        delayMinutes: workflowData.delayMinutes ?? null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Workflow",
      entityId: workflow.id,
    });

    revalidatePath("/settings/workflows");
    revalidatePath(`/settings/workflows/${id}`);
    return { success: true as const, data: serialize(workflow) };
  } catch (error) {
    console.error("[UPDATE_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to update workflow" };
  }
}

// ============================================================
// Delete Workflow
// ============================================================

export async function deleteWorkflow(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Workflow not found" };
    }

    await prisma.workflow.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Workflow",
      entityId: id,
    });

    revalidatePath("/settings/workflows");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to delete workflow" };
  }
}

// ============================================================
// Toggle Workflow Active State
// ============================================================

export async function toggleWorkflow(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Workflow not found" };
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Workflow",
      entityId: id,
      changes: { isActive: workflow.isActive },
    });

    revalidatePath("/settings/workflows");
    revalidatePath(`/settings/workflows/${id}`);
    return { success: true as const, data: serialize(workflow) };
  } catch (error) {
    console.error("[TOGGLE_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to toggle workflow" };
  }
}

// ============================================================
// Execute Workflow (fire-and-forget action logging)
// ============================================================

export async function executeWorkflow(
  workflowId: string,
  context?: ExecuteWorkflowContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (context) {
      const parsed = executeWorkflowContextSchema.safeParse(context);
      if (!parsed.success) {
        return {
          success: false as const,
          error: "Invalid execution context",
        };
      }
    }

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      return { success: false as const, error: "Workflow not found" };
    }

    if (!workflow.isActive) {
      return { success: false as const, error: "Workflow is not active" };
    }

    const actions = workflow.actions as Array<{ type: string; config: Record<string, unknown> }>;

    // Execute each action and log the result
    const logs = [];
    for (const action of actions) {
      try {
        // For now, just log them as SUCCESS
        // In the future, this is where actual action execution would happen
        // (e.g., sending emails, creating tasks, etc.)
        const log = await prisma.workflowLog.create({
          data: {
            workflowId,
            action: action.type,
            status: "SUCCESS",
            bookingId: context?.bookingId ?? null,
            contactId: context?.contactId ?? null,
          },
        });
        logs.push(log);
      } catch (actionError) {
        // Log failed action
        const log = await prisma.workflowLog.create({
          data: {
            workflowId,
            action: action.type,
            status: "FAILED",
            error: actionError instanceof Error ? actionError.message : "Unknown error",
            bookingId: context?.bookingId ?? null,
            contactId: context?.contactId ?? null,
          },
        });
        logs.push(log);
      }
    }

    await logActivity({
      userId: session.user.id as string,
      action: "executed",
      entityType: "Workflow",
      entityId: workflowId,
      changes: {
        actionsCount: actions.length,
        bookingId: context?.bookingId,
        contactId: context?.contactId,
      },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Workflow Executed",
      message: `Workflow "${workflow.name}" has been executed with ${actions.length} action(s).`,
      actionUrl: `/settings/workflows/${workflowId}`,
    });

    revalidatePath(`/settings/workflows/${workflowId}`);
    return { success: true as const, data: serialize(logs) };
  } catch (error) {
    console.error("[EXECUTE_WORKFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to execute workflow" };
  }
}

// ============================================================
// Get Workflow Logs (with optional filtering)
// ============================================================

export async function getWorkflowLogs(params?: {
  workflowId?: string;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const limit = params?.limit ?? 50;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.workflowId) {
      where.workflowId = params.workflowId;
    }

    const logs = await prisma.workflowLog.findMany({
      where,
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { executedAt: "desc" },
      take: limit,
    });

    return { success: true as const, data: serialize(logs) };
  } catch (error) {
    console.error("[GET_WORKFLOW_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch workflow logs" };
  }
}
