"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  blueprintSchema,
  blueprintTransitionSchema,
  type BlueprintInput,
  type BlueprintTransitionInput,
} from "@/schemas/blueprint.schema";
import type { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import {
  validateTransition as engineValidateTransition,
  getAvailableTransitions as engineGetAvailableTransitions,
  logTransition,
} from "@/lib/blueprint-engine";

// ============================================================
// Get Blueprints (List with transition counts)
// ============================================================

export async function getBlueprints() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const blueprints = await prisma.blueprint.findMany({
      include: {
        _count: {
          select: { transitions: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(blueprints) };
  } catch (error) {
    console.error("[GET_BLUEPRINTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch blueprints" };
  }
}

// ============================================================
// Get Single Blueprint (with all transitions)
// ============================================================

export async function getBlueprint(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const blueprint = await prisma.blueprint.findUnique({
      where: { id },
      include: {
        transitions: {
          orderBy: { order: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { transitions: true },
        },
      },
    });

    if (!blueprint) {
      return { success: false as const, error: "Blueprint not found" };
    }

    return { success: true as const, data: serialize(blueprint) };
  } catch (error) {
    console.error("[GET_BLUEPRINT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch blueprint" };
  }
}

// ============================================================
// Create Blueprint
// ============================================================

export async function createBlueprint(input: BlueprintInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = blueprintSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const blueprint = await prisma.blueprint.create({
      data: {
        ...parsed.data,
        createdById: session.user.id,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Blueprint",
      entityId: blueprint.id,
    });

    revalidatePath("/settings/blueprints");

    return { success: true as const, data: serialize(blueprint) };
  } catch (error) {
    console.error("[CREATE_BLUEPRINT_ERROR]", error);
    return { success: false as const, error: "Failed to create blueprint" };
  }
}

// ============================================================
// Update Blueprint
// ============================================================

export async function updateBlueprint(id: string, input: BlueprintInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = blueprintSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const existing = await prisma.blueprint.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Blueprint not found" };
    }

    const blueprint = await prisma.blueprint.update({
      where: { id },
      data: parsed.data,
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Blueprint",
      entityId: blueprint.id,
    });

    revalidatePath("/settings/blueprints");
    revalidatePath(`/settings/blueprints/${id}`);

    return { success: true as const, data: serialize(blueprint) };
  } catch (error) {
    console.error("[UPDATE_BLUEPRINT_ERROR]", error);
    return { success: false as const, error: "Failed to update blueprint" };
  }
}

// ============================================================
// Delete Blueprint (cascades transitions)
// ============================================================

export async function deleteBlueprint(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.blueprint.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Blueprint not found" };
    }

    await prisma.blueprint.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "Blueprint",
      entityId: id,
    });

    revalidatePath("/settings/blueprints");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_BLUEPRINT_ERROR]", error);
    return { success: false as const, error: "Failed to delete blueprint" };
  }
}

// ============================================================
// Toggle Blueprint Active State
// ============================================================
// When activating a blueprint, deactivate any other active
// blueprint for the same entity type.

export async function toggleBlueprint(id: string, isActive: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.blueprint.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Blueprint not found" };
    }

    // If activating, deactivate other active blueprints for the same entity type
    if (isActive) {
      await prisma.blueprint.updateMany({
        where: {
          entityType: existing.entityType,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    const blueprint = await prisma.blueprint.update({
      where: { id },
      data: { isActive },
    });

    logActivity({
      userId: session.user.id,
      action: isActive ? "activated" : "deactivated",
      entityType: "Blueprint",
      entityId: id,
    });

    revalidatePath("/settings/blueprints");
    revalidatePath(`/settings/blueprints/${id}`);

    return { success: true as const, data: serialize(blueprint) };
  } catch (error) {
    console.error("[TOGGLE_BLUEPRINT_ERROR]", error);
    return { success: false as const, error: "Failed to toggle blueprint" };
  }
}

// ============================================================
// Create Transition
// ============================================================

export async function createTransition(
  blueprintId: string,
  input: BlueprintTransitionInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = blueprintTransitionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    // Verify blueprint exists
    const blueprint = await prisma.blueprint.findUnique({
      where: { id: blueprintId },
    });
    if (!blueprint) {
      return { success: false as const, error: "Blueprint not found" };
    }

    const transition = await prisma.blueprintTransition.create({
      data: {
        ...parsed.data,
        conditions: parsed.data.conditions as unknown as Prisma.InputJsonValue,
        requiredFields: parsed.data.requiredFields as unknown as Prisma.InputJsonValue,
        requiredActions: parsed.data.requiredActions as unknown as Prisma.InputJsonValue,
        blueprintId,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "BlueprintTransition",
      entityId: transition.id,
    });

    revalidatePath(`/settings/blueprints/${blueprintId}`);

    return { success: true as const, data: serialize(transition) };
  } catch (error) {
    console.error("[CREATE_TRANSITION_ERROR]", error);
    return { success: false as const, error: "Failed to create transition" };
  }
}

// ============================================================
// Update Transition
// ============================================================

export async function updateTransition(
  id: string,
  input: BlueprintTransitionInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = blueprintTransitionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const existing = await prisma.blueprintTransition.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Transition not found" };
    }

    const transition = await prisma.blueprintTransition.update({
      where: { id },
      data: {
        ...parsed.data,
        conditions: parsed.data.conditions as unknown as Prisma.InputJsonValue,
        requiredFields: parsed.data.requiredFields as unknown as Prisma.InputJsonValue,
        requiredActions: parsed.data.requiredActions as unknown as Prisma.InputJsonValue,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "BlueprintTransition",
      entityId: transition.id,
    });

    revalidatePath(`/settings/blueprints/${existing.blueprintId}`);

    return { success: true as const, data: serialize(transition) };
  } catch (error) {
    console.error("[UPDATE_TRANSITION_ERROR]", error);
    return { success: false as const, error: "Failed to update transition" };
  }
}

// ============================================================
// Delete Transition
// ============================================================

export async function deleteTransition(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.blueprintTransition.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Transition not found" };
    }

    await prisma.blueprintTransition.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "BlueprintTransition",
      entityId: id,
    });

    revalidatePath(`/settings/blueprints/${existing.blueprintId}`);

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_TRANSITION_ERROR]", error);
    return { success: false as const, error: "Failed to delete transition" };
  }
}

// ============================================================
// Get Transition Logs (Audit trail)
// ============================================================

export async function getTransitionLogs(params?: {
  entityType?: string;
  entityId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.entityId) where.entityId = params.entityId;

    const [logs, total] = await Promise.all([
      prisma.blueprintTransitionLog.findMany({
        where,
        orderBy: { executedAt: "desc" },
        skip,
        take: limit,
        include: {
          transition: {
            select: {
              name: true,
              blueprint: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.blueprintTransitionLog.count({ where }),
    ]);

    return {
      success: true as const,
      data: serialize(logs),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_TRANSITION_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch transition logs" };
  }
}

// ============================================================
// Validate Transition (Server Action Wrapper)
// ============================================================
// Wraps the blueprint engine's validateTransition for use in
// client components via server actions.

export async function validateBlueprintTransition(
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any).role ?? "STAFF";

    const result = await engineValidateTransition(
      entityType,
      entityId,
      fromStatus,
      toStatus,
      session.user.id,
      userRole
    );

    return { success: true as const, data: result };
  } catch (error) {
    console.error("[VALIDATE_TRANSITION_ERROR]", error);
    return { success: false as const, error: "Failed to validate transition" };
  }
}

// ============================================================
// Get Available Transitions (Server Action Wrapper)
// ============================================================

export async function getAvailableBlueprintTransitions(
  entityType: string,
  currentStatus: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any).role ?? "STAFF";

    const result = await engineGetAvailableTransitions(
      entityType,
      currentStatus,
      userRole
    );

    return { success: true as const, data: result };
  } catch (error) {
    console.error("[GET_AVAILABLE_TRANSITIONS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch available transitions",
    };
  }
}

// ============================================================
// Execute Blueprint Transition (Log after successful move)
// ============================================================

export async function executeBlueprintTransition(
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any).role ?? "STAFF";

    const validation = await engineValidateTransition(
      entityType,
      entityId,
      fromStatus,
      toStatus,
      session.user.id,
      userRole
    );

    if (!validation.allowed) {
      return {
        success: false as const,
        error: validation.errors.join(" "),
        errors: validation.errors,
      };
    }

    // Log the transition if a blueprint transition was matched
    if (validation.transition) {
      await logTransition(
        validation.transition.id,
        entityType,
        entityId,
        fromStatus,
        toStatus,
        session.user.id
      );
    }

    return { success: true as const, data: { allowed: true } };
  } catch (error) {
    console.error("[EXECUTE_TRANSITION_ERROR]", error);
    return { success: false as const, error: "Failed to execute transition" };
  }
}

// ============================================================
// Get Pipeline Stages (for DEAL entity type)
// ============================================================

export async function getPipelineStages() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, color: true },
    });

    return { success: true as const, data: serialize(stages) };
  } catch (error) {
    console.error("[GET_PIPELINE_STAGES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch pipeline stages" };
  }
}
