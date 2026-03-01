"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createExecutionPlanSchema,
  updatePlanStatusSchema,
  type CreateExecutionPlanInput,
} from "@/schemas/execution-plan.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Execution Plan by Booking ID
// ============================================================

export async function getExecutionPlan(bookingId: string) {
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
                vendor: {
                  select: { id: true, name: true },
                },
                checklistItems: {
                  orderBy: { order: "asc" },
                },
                proofs: true,
                timeLogs: {
                  orderBy: { timestamp: "asc" },
                },
                escalations: true,
              },
            },
          },
        },
        sopTemplate: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!plan) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[GET_EXECUTION_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to fetch execution plan" };
  }
}

// ============================================================
// Create Execution Plan
// ============================================================

export async function createExecutionPlan(data: CreateExecutionPlanInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createExecutionPlanSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { id: true, date: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check no existing plan for this booking
    const existing = await prisma.executionPlan.findUnique({
      where: { bookingId: parsed.data.bookingId },
    });

    if (existing) {
      return {
        success: false as const,
        error: "Execution plan already exists for this booking",
      };
    }

    const plan = await prisma.executionPlan.create({
      data: {
        bookingId: parsed.data.bookingId,
        sopTemplateId: parsed.data.sopTemplateId || null,
        eventDate: parsed.data.eventDate,
        startTime: parsed.data.startTime ?? null,
        endTime: parsed.data.endTime ?? null,
        notes: parsed.data.notes || null,
        status: "PLANNING",
        createdById: session.user.id,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ExecutionPlan",
      entityId: plan.id,
      changes: { bookingId: parsed.data.bookingId },
    });

    revalidatePath(`/bookings/${parsed.data.bookingId}/execution`);
    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[CREATE_EXECUTION_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to create execution plan" };
  }
}

// ============================================================
// Update Execution Plan Status
// ============================================================

export async function updateExecutionPlanStatus(
  planId: string,
  status: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updatePlanStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.executionPlan.findUnique({
      where: { id: planId },
      include: {
        phases: { select: { id: true, status: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Execution plan not found" };
    }

    // If going to LIVE, set all NOT_STARTED phases to IN_PROGRESS
    if (parsed.data.status === "LIVE") {
      const notStartedPhaseIds = existing.phases
        .filter((p) => p.status === "NOT_STARTED")
        .map((p) => p.id);

      if (notStartedPhaseIds.length > 0) {
        await prisma.executionPhase.updateMany({
          where: { id: { in: notStartedPhaseIds } },
          data: { status: "IN_PROGRESS", actualStart: new Date() },
        });
      }
    }

    const plan = await prisma.executionPlan.update({
      where: { id: planId },
      data: { status: parsed.data.status },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ExecutionPlan",
      entityId: plan.id,
      changes: { from: existing.status, to: parsed.data.status },
    });

    if (parsed.data.status === "LIVE") {
      notify({
        userId: session.user.id,
        type: "SYSTEM",
        title: "Execution Plan Live",
        message: `Execution plan for booking has been set to LIVE.`,
        actionUrl: `/bookings/${existing.bookingId}/execution`,
      });
    }

    revalidatePath(`/bookings/${existing.bookingId}/execution`);
    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[UPDATE_EXECUTION_PLAN_STATUS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update execution plan status",
    };
  }
}

// ============================================================
// Delete Execution Plan
// ============================================================

export async function deleteExecutionPlan(planId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.executionPlan.findUnique({
      where: { id: planId },
      select: { id: true, status: true, bookingId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Execution plan not found" };
    }

    if (existing.status !== "PLANNING") {
      return {
        success: false as const,
        error: "Cannot delete a plan that is not in PLANNING status",
      };
    }

    await prisma.executionPlan.delete({
      where: { id: planId },
    });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "ExecutionPlan",
      entityId: planId,
      changes: { bookingId: existing.bookingId },
    });

    revalidatePath(`/bookings/${existing.bookingId}/execution`);
    return { success: true as const, data: { id: planId } };
  } catch (error) {
    console.error("[DELETE_EXECUTION_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to delete execution plan" };
  }
}
