"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  addPhaseSchema,
  updatePhaseSchema,
  type AddPhaseInput,
  type UpdatePhaseInput,
} from "@/schemas/execution-plan.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Add Phase to Execution Plan
// ============================================================

export async function addPhase(planId: string, data: AddPhaseInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addPhaseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify plan exists
    const plan = await prisma.executionPlan.findUnique({
      where: { id: planId },
      select: { id: true, bookingId: true },
    });

    if (!plan) {
      return { success: false as const, error: "Execution plan not found" };
    }

    // Get max order of existing phases
    const maxOrder = await prisma.executionPhase.aggregate({
      where: { planId },
      _max: { order: true },
    });

    const phaseData = parsed.data;

    const phase = await prisma.executionPhase.create({
      data: {
        name: phaseData.name,
        phase: phaseData.phase,
        order: phaseData.order ?? (maxOrder._max.order ?? -1) + 1,
        plannedStart: phaseData.plannedStart ?? null,
        plannedEnd: phaseData.plannedEnd ?? null,
        status: "NOT_STARTED",
        planId,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ExecutionPhase",
      entityId: phase.id,
      changes: { name: phaseData.name, phase: phaseData.phase },
    });

    revalidatePath(`/bookings/${plan.bookingId}/execution`);
    return { success: true as const, data: serialize(phase) };
  } catch (error) {
    console.error("[ADD_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to add phase" };
  }
}

// ============================================================
// Update Phase
// ============================================================

export async function updatePhase(phaseId: string, data: UpdatePhaseInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updatePhaseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionPhase.findUnique({
      where: { id: phaseId },
      include: { plan: { select: { bookingId: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Phase not found" };
    }

    const phaseData = parsed.data;

    // Handle actualStart/actualEnd based on status changes
    const statusUpdates: Record<string, unknown> = {};
    if (phaseData.status && phaseData.status !== existing.status) {
      if (phaseData.status === "IN_PROGRESS" && !existing.actualStart) {
        statusUpdates.actualStart = new Date();
      }
      if (phaseData.status === "COMPLETED") {
        statusUpdates.actualEnd = new Date();
      }
    }

    const phase = await prisma.executionPhase.update({
      where: { id: phaseId },
      data: {
        ...(phaseData.name !== undefined && { name: phaseData.name }),
        ...(phaseData.plannedStart !== undefined && {
          plannedStart: phaseData.plannedStart ?? null,
        }),
        ...(phaseData.plannedEnd !== undefined && {
          plannedEnd: phaseData.plannedEnd ?? null,
        }),
        ...(phaseData.status !== undefined && { status: phaseData.status }),
        ...statusUpdates,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ExecutionPhase",
      entityId: phase.id,
      changes: {
        ...phaseData,
        ...(phaseData.status && phaseData.status !== existing.status
          ? { statusFrom: existing.status, statusTo: phaseData.status }
          : {}),
      },
    });

    revalidatePath(`/bookings/${existing.plan.bookingId}/execution`);
    return { success: true as const, data: serialize(phase) };
  } catch (error) {
    console.error("[UPDATE_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to update phase" };
  }
}

// ============================================================
// Remove Phase
// ============================================================

export async function removePhase(phaseId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionPhase.findUnique({
      where: { id: phaseId },
      include: { plan: { select: { id: true, bookingId: true, status: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Phase not found" };
    }

    if (existing.plan.status !== "PLANNING") {
      return {
        success: false as const,
        error: "Cannot remove phase when plan is not in PLANNING status",
      };
    }

    await prisma.executionPhase.delete({
      where: { id: phaseId },
    });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "ExecutionPhase",
      entityId: phaseId,
      changes: { name: existing.name, phase: existing.phase },
    });

    revalidatePath(`/bookings/${existing.plan.bookingId}/execution`);
    return { success: true as const, data: { id: phaseId } };
  } catch (error) {
    console.error("[REMOVE_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to remove phase" };
  }
}

// ============================================================
// Reorder Phases
// ============================================================

export async function reorderPhases(
  planId: string,
  items: { id: string; order: number }[]
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify plan exists
    const plan = await prisma.executionPlan.findUnique({
      where: { id: planId },
      select: { id: true, bookingId: true },
    });

    if (!plan) {
      return { success: false as const, error: "Execution plan not found" };
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.executionPhase.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ExecutionPlan",
      entityId: planId,
      changes: { reorderedPhases: items.length },
    });

    revalidatePath(`/bookings/${plan.bookingId}/execution`);
    return { success: true as const, data: { planId } };
  } catch (error) {
    console.error("[REORDER_PHASES_ERROR]", error);
    return { success: false as const, error: "Failed to reorder phases" };
  }
}
