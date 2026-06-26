"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  addExecutionTaskSchema,
  updateExecutionTaskSchema,
  updateTaskStatusSchema,
  assignTaskSchema,
  addProofSchema,
  type AddExecutionTaskInput,
  type UpdateExecutionTaskInput,
  type AddProofInput,
} from "@/schemas/execution-task.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Add Execution Task to Phase
// ============================================================

export async function addExecutionTask(
  phaseId: string,
  data: AddExecutionTaskInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addExecutionTaskSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify phase exists
    const phase = await prisma.executionPhase.findUnique({
      where: { id: phaseId },
      include: { plan: { select: { bookingId: true } } },
    });

    if (!phase) {
      return { success: false as const, error: "Phase not found" };
    }

    // Get max order of existing tasks
    const maxOrder = await prisma.executionTask.aggregate({
      where: { phaseId },
      _max: { order: true },
    });

    const taskData = parsed.data;

    const task = await prisma.executionTask.create({
      data: {
        title: taskData.title,
        description: taskData.description || null,
        category: taskData.category,
        priority: taskData.priority,
        status: "NOT_STARTED",
        estimatedMinutes: taskData.estimatedMinutes ?? null,
        slaStartBy: taskData.slaStartBy ?? null,
        slaFinishBy: taskData.slaFinishBy ?? null,
        isMandatory: taskData.isMandatory,
        requiresApproval: taskData.requiresApproval,
        requiresProof: taskData.requiresProof,
        assigneeId: taskData.assigneeId || null,
        vendorId: taskData.vendorId || null,
        dependsOnTaskId: taskData.dependsOnTaskId || null,
        order: taskData.order ?? (maxOrder._max.order ?? -1) + 1,
        phaseId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        vendor: {
          select: { id: true, name: true },
        },
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { title: taskData.title, category: taskData.category },
    });

    revalidatePath(`/bookings/${phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[ADD_EXECUTION_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to add execution task" };
  }
}

// ============================================================
// Update Execution Task
// ============================================================

export async function updateExecutionTask(
  taskId: string,
  data: UpdateExecutionTaskInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateExecutionTaskSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    const taskData = parsed.data;

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: {
        ...(taskData.title !== undefined && { title: taskData.title }),
        ...(taskData.description !== undefined && {
          description: taskData.description || null,
        }),
        ...(taskData.category !== undefined && { category: taskData.category }),
        ...(taskData.priority !== undefined && { priority: taskData.priority }),
        ...(taskData.estimatedMinutes !== undefined && {
          estimatedMinutes: taskData.estimatedMinutes ?? null,
        }),
        ...(taskData.slaStartBy !== undefined && {
          slaStartBy: taskData.slaStartBy ?? null,
        }),
        ...(taskData.slaFinishBy !== undefined && {
          slaFinishBy: taskData.slaFinishBy ?? null,
        }),
        ...(taskData.isMandatory !== undefined && {
          isMandatory: taskData.isMandatory,
        }),
        ...(taskData.requiresApproval !== undefined && {
          requiresApproval: taskData.requiresApproval,
        }),
        ...(taskData.requiresProof !== undefined && {
          requiresProof: taskData.requiresProof,
        }),
        ...(taskData.assigneeId !== undefined && {
          assigneeId: taskData.assigneeId || null,
        }),
        ...(taskData.vendorId !== undefined && {
          vendorId: taskData.vendorId || null,
        }),
        ...(taskData.dependsOnTaskId !== undefined && {
          dependsOnTaskId: taskData.dependsOnTaskId || null,
        }),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: taskData,
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[UPDATE_EXECUTION_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to update execution task" };
  }
}

// ============================================================
// Update Execution Task Status
// ============================================================

export async function updateExecutionTaskStatus(
  taskId: string,
  data: { status: string; delayReason?: string }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateTaskStatusSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: {
        phase: { include: { plan: { select: { bookingId: true } } } },
        proofs: true,
      },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    const { status, delayReason } = parsed.data;

    // Build status-dependent updates
    const statusUpdates: Record<string, unknown> = { status };

    if (status === "IN_PROGRESS" && !existing.actualStart) {
      statusUpdates.actualStart = new Date();
    }
    if (status === "COMPLETED") {
      // Mirror completeTask() sign-off gates so this path cannot bypass them.
      if (existing.requiresProof && existing.proofs.length === 0) {
        return {
          success: false as const,
          error: "Task requires proof before it can be completed",
        };
      }
      statusUpdates.actualEnd = new Date();
      // Completion of an approval-required task must re-enter the approval
      // workflow (approveTask sets isApproved=true) rather than stay approved.
      if (existing.requiresApproval) {
        statusUpdates.isApproved = false;
      }
    }
    if (status === "DELAYED" || status === "BLOCKED") {
      statusUpdates.delayReason = delayReason || null;
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: statusUpdates,
    });

    // Create TaskTimeLog entry
    await prisma.taskTimeLog.create({
      data: {
        action: status.toLowerCase(),
        taskId,
        userId: session.user.id,
        timestamp: new Date(),
      },
    });

    // If BLOCKED, notify relevant people
    if (status === "BLOCKED") {
      notify({
        userId: session.user.id,
        type: "EXECUTION_TASK_BLOCKED" as never,
        title: "Task Blocked",
        message: `Task "${existing.title}" has been blocked. Reason: ${delayReason || "No reason provided"}`,
        actionUrl: `/bookings/${existing.phase.plan.bookingId}/execution`,
      });
    }

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { from: existing.status, to: status },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[UPDATE_EXECUTION_TASK_STATUS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update execution task status",
    };
  }
}

// ============================================================
// Assign Execution Task
// ============================================================

export async function assignExecutionTask(
  taskId: string,
  data: { assigneeId?: string; vendorId?: string }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = assignTaskSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: {
        ...(parsed.data.assigneeId !== undefined && {
          assigneeId: parsed.data.assigneeId || null,
        }),
        ...(parsed.data.vendorId !== undefined && {
          vendorId: parsed.data.vendorId || null,
        }),
      },
    });

    // Notify assignee if provided
    if (parsed.data.assigneeId) {
      notify({
        userId: parsed.data.assigneeId,
        type: "TASK_ASSIGNED" as never,
        title: "Task Assigned",
        message: `You have been assigned to task "${existing.title}".`,
        actionUrl: `/bookings/${existing.phase.plan.bookingId}/execution`,
      });
    }

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: {
        assigneeId: parsed.data.assigneeId,
        vendorId: parsed.data.vendorId,
      },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[ASSIGN_EXECUTION_TASK_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to assign execution task",
    };
  }
}

// ============================================================
// Start Task
// ============================================================

export async function startTask(taskId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    if (existing.status !== "NOT_STARTED") {
      return {
        success: false as const,
        error: "Task can only be started from NOT_STARTED status",
      };
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
        actualStart: new Date(),
      },
    });

    // Create TaskTimeLog
    await prisma.taskTimeLog.create({
      data: {
        action: "started",
        taskId,
        userId: session.user.id,
        timestamp: new Date(),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { from: "NOT_STARTED", to: "IN_PROGRESS" },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[START_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to start task" };
  }
}

// ============================================================
// Complete Task
// ============================================================

export async function completeTask(taskId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: {
        phase: { include: { plan: { select: { bookingId: true } } } },
        proofs: true,
      },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    if (existing.status !== "IN_PROGRESS") {
      return {
        success: false as const,
        error: "Task can only be completed from IN_PROGRESS status",
      };
    }

    // If requiresProof, check task has at least one proof
    if (existing.requiresProof && existing.proofs.length === 0) {
      return {
        success: false as const,
        error: "Task requires proof before it can be completed",
      };
    }

    // If requiresApproval, set COMPLETED but isApproved = false
    const updateData: Record<string, unknown> = {
      status: "COMPLETED",
      actualEnd: new Date(),
    };

    if (existing.requiresApproval) {
      updateData.isApproved = false;
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: updateData,
    });

    // Create TaskTimeLog
    await prisma.taskTimeLog.create({
      data: {
        action: "completed",
        taskId,
        userId: session.user.id,
        timestamp: new Date(),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { from: "IN_PROGRESS", to: "COMPLETED" },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[COMPLETE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to complete task" };
  }
}

// ============================================================
// Block Task
// ============================================================

export async function blockTask(taskId: string, reason: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: {
        status: "BLOCKED",
        delayReason: reason,
      },
    });

    // Create TaskTimeLog
    await prisma.taskTimeLog.create({
      data: {
        action: "blocked",
        taskId,
        userId: session.user.id,
        timestamp: new Date(),
      },
    });

    // Notify via EXECUTION_TASK_BLOCKED
    notify({
      userId: session.user.id,
      type: "EXECUTION_TASK_BLOCKED" as never,
      title: "Task Blocked",
      message: `Task "${existing.title}" has been blocked. Reason: ${reason}`,
      actionUrl: `/bookings/${existing.phase.plan.bookingId}/execution`,
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { from: existing.status, to: "BLOCKED", reason },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[BLOCK_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to block task" };
  }
}

// ============================================================
// Approve Task
// ============================================================

export async function approveTask(taskId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:approve")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    if (!existing.requiresApproval) {
      return {
        success: false as const,
        error: "Task does not require approval",
      };
    }

    if (existing.status !== "COMPLETED") {
      return {
        success: false as const,
        error: "Task must be completed before it can be approved",
      };
    }

    const task = await prisma.executionTask.update({
      where: { id: taskId },
      data: {
        isApproved: true,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ExecutionTask",
      entityId: task.id,
      changes: { approved: true, approvedBy: session.user.id },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(task) };
  } catch (error) {
    console.error("[APPROVE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to approve task" };
  }
}

// ============================================================
// Add Task Proof
// ============================================================

export async function addTaskProof(taskId: string, data: AddProofInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addProofSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    const proof = await prisma.taskProof.create({
      data: {
        type: parsed.data.type,
        content: parsed.data.content,
        notes: parsed.data.notes || null,
        taskId,
        submittedById: session.user.id,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "TaskProof",
      entityId: proof.id,
      changes: { type: parsed.data.type, taskId },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(proof) };
  } catch (error) {
    console.error("[ADD_TASK_PROOF_ERROR]", error);
    return { success: false as const, error: "Failed to add task proof" };
  }
}

// ============================================================
// Add Execution Checklist
// ============================================================

export async function addExecutionChecklist(taskId: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionTask.findUnique({
      where: { id: taskId },
      include: { phase: { include: { plan: { select: { bookingId: true } } } } },
    });

    if (!existing) {
      return { success: false as const, error: "Execution task not found" };
    }

    // Get max order of existing checklists
    const maxOrder = await prisma.executionChecklist.aggregate({
      where: { taskId },
      _max: { order: true },
    });

    const checklist = await prisma.executionChecklist.create({
      data: {
        title,
        isCompleted: false,
        order: (maxOrder._max.order ?? -1) + 1,
        taskId,
      },
    });

    revalidatePath(`/bookings/${existing.phase.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(checklist) };
  } catch (error) {
    console.error("[ADD_EXECUTION_CHECKLIST_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to add execution checklist item",
    };
  }
}

// ============================================================
// Toggle Execution Checklist
// ============================================================

export async function toggleExecutionChecklist(checklistId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionChecklist.findUnique({
      where: { id: checklistId },
      include: {
        task: {
          include: {
            phase: { include: { plan: { select: { bookingId: true } } } },
          },
        },
      },
    });

    if (!existing) {
      return {
        success: false as const,
        error: "Checklist item not found",
      };
    }

    const checklist = await prisma.executionChecklist.update({
      where: { id: checklistId },
      data: {
        isCompleted: !existing.isCompleted,
        completedAt: !existing.isCompleted ? new Date() : null,
        completedById: !existing.isCompleted ? session.user.id : null,
      },
    });

    revalidatePath(
      `/bookings/${existing.task.phase.plan.bookingId}/execution`
    );
    return { success: true as const, data: serialize(checklist) };
  } catch (error) {
    console.error("[TOGGLE_EXECUTION_CHECKLIST_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to toggle checklist item",
    };
  }
}

// ============================================================
// Get Event Control Dashboard
// ============================================================

export async function getEventControlDashboard(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const plan = await prisma.executionPlan.findUnique({
      where: { bookingId },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            tasks: {
              orderBy: { order: "asc" },
              include: {
                assignee: {
                  select: { id: true, name: true, email: true, image: true },
                },
                escalations: true,
              },
            },
          },
        },
      },
    });

    if (!plan) {
      return { success: true as const, data: null };
    }

    // Flatten all tasks
    const allTasks = plan.phases.flatMap((phase) => phase.tasks);

    const now = new Date();

    // Compute task counts
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(
      (t) => t.status === "COMPLETED"
    ).length;
    const inProgressTasks = allTasks.filter(
      (t) => t.status === "IN_PROGRESS"
    ).length;
    const blockedTasks = allTasks.filter((t) => t.status === "BLOCKED").length;
    const delayedTasks = allTasks.filter((t) => t.status === "DELAYED").length;

    // Compute per-phase progress
    const phaseProgress = plan.phases.map((phase) => {
      const phaseTasks = phase.tasks;
      const total = phaseTasks.length;
      const completed = phaseTasks.filter(
        (t) => t.status === "COMPLETED"
      ).length;
      return {
        id: phase.id,
        name: phase.name,
        phase: phase.phase,
        status: phase.status,
        totalTasks: total,
        completedTasks: completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    // Get upcoming tasks (NOT_STARTED with slaStartBy in the near future)
    const upcomingTasks = allTasks
      .filter((t) => t.status === "NOT_STARTED" && t.slaStartBy)
      .sort(
        (a, b) =>
          new Date(a.slaStartBy!).getTime() -
          new Date(b.slaStartBy!).getTime()
      )
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        slaStartBy: t.slaStartBy,
        assignee: t.assignee,
      }));

    // Get overdue tasks (slaFinishBy < now and status not COMPLETED)
    const overdueTasks = allTasks
      .filter(
        (t) =>
          t.slaFinishBy &&
          new Date(t.slaFinishBy) < now &&
          t.status !== "COMPLETED"
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        slaFinishBy: t.slaFinishBy,
        assignee: t.assignee,
      }));

    // Get active escalations count
    const activeEscalations = allTasks.reduce(
      (count, t) => count + t.escalations.length,
      0
    );

    const dashboard = {
      planId: plan.id,
      planStatus: plan.status,
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      delayedTasks,
      overallProgress:
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0,
      phaseProgress,
      upcomingTasks,
      overdueTasks,
      activeEscalations,
    };

    return { success: true as const, data: serialize(dashboard) };
  } catch (error) {
    console.error("[GET_EVENT_CONTROL_DASHBOARD_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch event control dashboard",
    };
  }
}
