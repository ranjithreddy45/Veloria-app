"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import {
  cadenceSchema,
  cadenceStepSchema,
  type CadenceInput,
  type CadenceStepInput,
  type ExitCriterion,
} from "@/schemas/cadence.schema";

// ============================================================
// Types
// ============================================================

export interface CadenceStepData {
  id: string;
  stepType: string;
  order: number;
  config: Record<string, unknown>;
  delayDays: number;
  delayHours: number;
  createdAt: string;
  updatedAt: string;
  cadenceId: string;
}

export interface CadenceEnrollmentData {
  id: string;
  status: string;
  currentStepOrder: number;
  nextExecuteAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  exitReason: string | null;
  createdAt: string;
  updatedAt: string;
  cadenceId: string;
  entityId: string;
  enrolledById: string;
}

export interface CadenceListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  entityType: string;
  exitCriteria: ExitCriterion[];
  autoEnroll: boolean;
  autoEnrollCriteria: unknown[] | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  _count: { steps: number; enrollments: number };
}

export interface CadenceDetailData extends Omit<CadenceListItem, "_count"> {
  steps: CadenceStepData[];
  enrollments: CadenceEnrollmentData[];
}

// ============================================================
// CRUD — Cadences
// ============================================================

export async function getCadences(): Promise<
  | { success: true; data: CadenceListItem[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const cadences = await prisma.cadence.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { steps: true, enrollments: true } },
      },
    });

    return { success: true as const, data: serialize(cadences) as unknown as CadenceListItem[] };
  } catch (error) {
    console.error("getCadences error:", error);
    return { success: false as const, error: "Failed to load cadences" };
  }
}

export async function getCadence(id: string): Promise<
  | { success: true; data: CadenceDetailData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const cadence = await prisma.cadence.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        steps: { orderBy: { order: "asc" } },
        enrollments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!cadence) {
      return { success: false as const, error: "Cadence not found" };
    }

    return { success: true as const, data: serialize(cadence) as unknown as CadenceDetailData };
  } catch (error) {
    console.error("getCadence error:", error);
    return { success: false as const, error: "Failed to load cadence" };
  }
}

export async function createCadence(
  input: CadenceInput
): Promise<
  | { success: true; data: CadenceListItem }
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

    const parsed = cadenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const cadence = await prisma.cadence.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        status: "DRAFT",
        entityType: data.entityType,
        exitCriteria: data.exitCriteria as unknown as object,
        autoEnroll: data.autoEnroll,
        autoEnrollCriteria: data.autoEnrollCriteria
          ? (data.autoEnrollCriteria as unknown as object)
          : undefined,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { steps: true, enrollments: true } },
      },
    });

    logActivity({
      action: "CREATE_CADENCE",
      entityType: "cadence",
      entityId: cadence.id,
      changes: { name: cadence.name },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(cadence) as unknown as CadenceListItem };
  } catch (error) {
    console.error("createCadence error:", error);
    return { success: false as const, error: "Failed to create cadence" };
  }
}

export async function updateCadence(
  id: string,
  input: CadenceInput
): Promise<
  | { success: true; data: CadenceListItem }
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

    const existing = await prisma.cadence.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Cadence not found" };
    }
    if (!["DRAFT", "PAUSED"].includes(existing.status)) {
      return { success: false as const, error: "Can only edit DRAFT or PAUSED cadences" };
    }

    const parsed = cadenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const cadence = await prisma.cadence.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        entityType: data.entityType,
        exitCriteria: data.exitCriteria as unknown as object,
        autoEnroll: data.autoEnroll,
        autoEnrollCriteria: data.autoEnrollCriteria
          ? (data.autoEnrollCriteria as unknown as object)
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { steps: true, enrollments: true } },
      },
    });

    logActivity({
      action: "UPDATE_CADENCE",
      entityType: "cadence",
      entityId: cadence.id,
      changes: { name: cadence.name },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(cadence) as unknown as CadenceListItem };
  } catch (error) {
    console.error("updateCadence error:", error);
    return { success: false as const, error: "Failed to update cadence" };
  }
}

export async function deleteCadence(
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

    const existing = await prisma.cadence.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Cadence not found" };
    }
    if (!["DRAFT", "ARCHIVED"].includes(existing.status)) {
      return { success: false as const, error: "Can only delete DRAFT or ARCHIVED cadences" };
    }

    await prisma.cadence.delete({ where: { id } });

    logActivity({
      action: "DELETE_CADENCE",
      entityType: "cadence",
      entityId: id,
      changes: { name: existing.name },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("deleteCadence error:", error);
    return { success: false as const, error: "Failed to delete cadence" };
  }
}

export async function toggleCadenceStatus(
  id: string,
  targetStatus: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.cadence.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Cadence not found" };
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["ACTIVE"],
      ACTIVE: ["PAUSED", "ARCHIVED"],
      PAUSED: ["ACTIVE", "ARCHIVED"],
      ARCHIVED: [],
    };

    const allowed = validTransitions[existing.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      return {
        success: false as const,
        error: `Cannot transition from ${existing.status} to ${targetStatus}`,
      };
    }

    await prisma.cadence.update({
      where: { id },
      data: { status: targetStatus },
    });

    logActivity({
      action: "TOGGLE_CADENCE_STATUS",
      entityType: "cadence",
      entityId: id,
      changes: { from: existing.status, to: targetStatus },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("toggleCadenceStatus error:", error);
    return { success: false as const, error: "Failed to update cadence status" };
  }
}

// ============================================================
// CRUD — Steps
// ============================================================

export async function createStep(
  cadenceId: string,
  input: CadenceStepInput
): Promise<
  | { success: true; data: CadenceStepData }
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

    const parsed = cadenceStepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const step = await prisma.cadenceStep.create({
      data: {
        cadenceId,
        stepType: data.stepType,
        order: data.order,
        config: data.config as unknown as object,
        delayDays: data.delayDays,
        delayHours: data.delayHours,
      },
    });

    logActivity({
      action: "CREATE_CADENCE_STEP",
      entityType: "cadence_step",
      entityId: step.id,
      changes: { cadenceId, stepType: data.stepType, order: data.order },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(step) as unknown as CadenceStepData };
  } catch (error) {
    console.error("createStep error:", error);
    return { success: false as const, error: "Failed to create step" };
  }
}

export async function updateStep(
  id: string,
  input: CadenceStepInput
): Promise<
  | { success: true; data: CadenceStepData }
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

    const parsed = cadenceStepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const step = await prisma.cadenceStep.update({
      where: { id },
      data: {
        stepType: data.stepType,
        order: data.order,
        config: data.config as unknown as object,
        delayDays: data.delayDays,
        delayHours: data.delayHours,
      },
    });

    logActivity({
      action: "UPDATE_CADENCE_STEP",
      entityType: "cadence_step",
      entityId: step.id,
      changes: { stepType: data.stepType },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(step) as unknown as CadenceStepData };
  } catch (error) {
    console.error("updateStep error:", error);
    return { success: false as const, error: "Failed to update step" };
  }
}

export async function deleteStep(
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

    await prisma.cadenceStep.delete({ where: { id } });

    logActivity({
      action: "DELETE_CADENCE_STEP",
      entityType: "cadence_step",
      entityId: id,
      changes: {},
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("deleteStep error:", error);
    return { success: false as const, error: "Failed to delete step" };
  }
}

export async function reorderSteps(
  cadenceId: string,
  orderedIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.cadenceStep.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    logActivity({
      action: "REORDER_CADENCE_STEPS",
      entityType: "cadence",
      entityId: cadenceId,
      changes: { orderedIds },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("reorderSteps error:", error);
    return { success: false as const, error: "Failed to reorder steps" };
  }
}

// ============================================================
// Enrollments
// ============================================================

function calculateNextExecuteAt(delayDays: number, delayHours: number): Date {
  const now = new Date();
  now.setDate(now.getDate() + delayDays);
  now.setHours(now.getHours() + delayHours);
  return now;
}

export async function enrollEntity(
  cadenceId: string,
  entityId: string
): Promise<
  | { success: true; data: CadenceEnrollmentData }
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

    const cadence = await prisma.cadence.findUnique({
      where: { id: cadenceId },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    if (!cadence) {
      return { success: false as const, error: "Cadence not found" };
    }
    if (cadence.status !== "ACTIVE") {
      return { success: false as const, error: "Cadence must be ACTIVE to enroll entities" };
    }

    // Check for existing enrollment
    const existing = await prisma.cadenceEnrollment.findUnique({
      where: { cadenceId_entityId: { cadenceId, entityId } },
    });
    if (existing) {
      return { success: false as const, error: "Entity is already enrolled in this cadence" };
    }

    const firstStep = cadence.steps[0];
    const nextExecuteAt = firstStep
      ? calculateNextExecuteAt(firstStep.delayDays, firstStep.delayHours)
      : null;

    const enrollment = await prisma.cadenceEnrollment.create({
      data: {
        cadenceId,
        entityId,
        enrolledById: session.user.id,
        status: "ACTIVE",
        currentStepOrder: 0,
        nextExecuteAt,
      },
    });

    logActivity({
      action: "ENROLL_CADENCE",
      entityType: "cadence_enrollment",
      entityId: enrollment.id,
      changes: { cadenceId, entityId },
      userId: session.user.id,
    });

    return { success: true as const, data: serialize(enrollment) as unknown as CadenceEnrollmentData };
  } catch (error) {
    console.error("enrollEntity error:", error);
    return { success: false as const, error: "Failed to enroll entity" };
  }
}

export async function bulkEnroll(
  cadenceId: string,
  entityIds: string[]
): Promise<
  | { success: true; data: { enrolled: number; skipped: number } }
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

    const cadence = await prisma.cadence.findUnique({
      where: { id: cadenceId },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    if (!cadence) {
      return { success: false as const, error: "Cadence not found" };
    }
    if (cadence.status !== "ACTIVE") {
      return { success: false as const, error: "Cadence must be ACTIVE to enroll entities" };
    }

    const firstStep = cadence.steps[0];
    const nextExecuteAt = firstStep
      ? calculateNextExecuteAt(firstStep.delayDays, firstStep.delayHours)
      : null;

    const result = await prisma.cadenceEnrollment.createMany({
      data: entityIds.map((entityId) => ({
        cadenceId,
        entityId,
        enrolledById: session.user.id,
        status: "ACTIVE" as const,
        currentStepOrder: 0,
        nextExecuteAt,
      })),
      skipDuplicates: true,
    });

    const enrolled = result.count;
    const skipped = entityIds.length - result.count;

    logActivity({
      action: "BULK_ENROLL_CADENCE",
      entityType: "cadence",
      entityId: cadenceId,
      changes: { enrolled, skipped, totalRequested: entityIds.length },
      userId: session.user.id,
    });

    return { success: true as const, data: { enrolled, skipped } };
  } catch (error) {
    console.error("bulkEnroll error:", error);
    return { success: false as const, error: "Failed to bulk enroll" };
  }
}

export async function pauseEnrollment(
  enrollmentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const enrollment = await prisma.cadenceEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      return { success: false as const, error: "Enrollment not found" };
    }
    if (enrollment.status !== "ACTIVE") {
      return { success: false as const, error: "Only ACTIVE enrollments can be paused" };
    }

    await prisma.cadenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "PAUSED", pausedAt: new Date() },
    });

    logActivity({
      action: "PAUSE_ENROLLMENT",
      entityType: "cadence_enrollment",
      entityId: enrollmentId,
      changes: {},
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("pauseEnrollment error:", error);
    return { success: false as const, error: "Failed to pause enrollment" };
  }
}

export async function resumeEnrollment(
  enrollmentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const enrollment = await prisma.cadenceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        cadence: {
          include: { steps: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!enrollment) {
      return { success: false as const, error: "Enrollment not found" };
    }
    if (enrollment.status !== "PAUSED") {
      return { success: false as const, error: "Only PAUSED enrollments can be resumed" };
    }

    // Recalculate nextExecuteAt based on current step
    const currentStep = enrollment.cadence.steps.find(
      (s) => s.order === enrollment.currentStepOrder
    );
    const nextExecuteAt = currentStep
      ? calculateNextExecuteAt(currentStep.delayDays, currentStep.delayHours)
      : null;

    await prisma.cadenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        nextExecuteAt,
      },
    });

    logActivity({
      action: "RESUME_ENROLLMENT",
      entityType: "cadence_enrollment",
      entityId: enrollmentId,
      changes: {},
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("resumeEnrollment error:", error);
    return { success: false as const, error: "Failed to resume enrollment" };
  }
}

export async function stopEnrollment(
  enrollmentId: string,
  reason?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const enrollment = await prisma.cadenceEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      return { success: false as const, error: "Enrollment not found" };
    }
    if (!["ACTIVE", "PAUSED"].includes(enrollment.status)) {
      return { success: false as const, error: "Cannot stop a completed or already stopped enrollment" };
    }

    await prisma.cadenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "STOPPED",
        exitReason: reason ?? "Manually stopped",
        completedAt: new Date(),
      },
    });

    logActivity({
      action: "STOP_ENROLLMENT",
      entityType: "cadence_enrollment",
      entityId: enrollmentId,
      changes: { reason: reason ?? "Manually stopped" },
      userId: session.user.id,
    });

    return { success: true as const };
  } catch (error) {
    console.error("stopEnrollment error:", error);
    return { success: false as const, error: "Failed to stop enrollment" };
  }
}

export async function getEnrollments(filters?: {
  cadenceId?: string;
  entityId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<
  | {
      success: true;
      data: CadenceEnrollmentData[];
      total: number;
      page: number;
      limit: number;
    }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.cadenceId) where.cadenceId = filters.cadenceId;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.status) where.status = filters.status;

    const [enrollments, total] = await Promise.all([
      prisma.cadenceEnrollment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.cadenceEnrollment.count({ where }),
    ]);

    return {
      success: true as const,
      data: serialize(enrollments) as unknown as CadenceEnrollmentData[],
      total,
      page,
      limit,
    };
  } catch (error) {
    console.error("getEnrollments error:", error);
    return { success: false as const, error: "Failed to load enrollments" };
  }
}
