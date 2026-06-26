"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createSOPTemplateSchema,
  updateSOPTemplateSchema,
  addSOPPhaseSchema,
  updateSOPPhaseSchema,
  addSOPTaskDefSchema,
  updateSOPTaskDefSchema,
  updateSOPTemplateSeedsSchema,
  type CreateSOPTemplateInput,
  type UpdateSOPTemplateInput,
  type AddSOPPhaseInput,
  type UpdateSOPPhaseInput,
  type AddSOPTaskDefInput,
  type UpdateSOPTaskDefInput,
  type UpdateSOPTemplateSeedsInput,
} from "@/schemas/sop-template.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

// ============================================================
// Get All SOP Templates
// ============================================================

export async function getSOPTemplates() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const templates = await prisma.sOPTemplate.findMany({
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
        _count: {
          select: { phases: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { success: true as const, data: serialize(templates) };
  } catch (error) {
    console.error("[GET_SOP_TEMPLATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch SOP templates" };
  }
}

// ============================================================
// Get Single SOP Template
// ============================================================

export async function getSOPTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const template = await prisma.sOPTemplate.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!template) {
      return { success: false as const, error: "SOP template not found" };
    }

    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[GET_SOP_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch SOP template" };
  }
}

// ============================================================
// Create SOP Template
// ============================================================

export async function createSOPTemplate(data: CreateSOPTemplateInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createSOPTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const templateData = parsed.data;

    // If this template is being set as default, unset all others
    if (templateData.isDefault) {
      await prisma.sOPTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.sOPTemplate.create({
      data: {
        name: templateData.name,
        description: templateData.description || null,
        eventType: templateData.eventType || null,
        isDefault: templateData.isDefault,
      },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "SOPTemplate",
      entityId: template.id,
      changes: { name: templateData.name },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[CREATE_SOP_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to create SOP template" };
  }
}

// ============================================================
// Update SOP Template
// ============================================================

export async function updateSOPTemplate(
  id: string,
  data: UpdateSOPTemplateInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateSOPTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.sOPTemplate.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return { success: false as const, error: "SOP template not found" };
    }

    const updateData = parsed.data;

    // If setting as default, unset all others first
    if (updateData.isDefault === true) {
      await prisma.sOPTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.sOPTemplate.update({
      where: { id },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.description !== undefined && {
          description: updateData.description || null,
        }),
        ...(updateData.eventType !== undefined && {
          eventType: updateData.eventType || null,
        }),
        ...(updateData.isActive !== undefined && {
          isActive: updateData.isActive,
        }),
        ...(updateData.isDefault !== undefined && {
          isDefault: updateData.isDefault,
        }),
      },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "SOPTemplate",
      entityId: id,
      changes: updateData as Record<string, unknown>,
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[UPDATE_SOP_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to update SOP template" };
  }
}

// ============================================================
// Update SOP Template Provisioning Seeds
// ------------------------------------------------------------
// Writes the 4 JSON seed columns consumed by src/lib/ops/provision.ts when a
// booking is confirmed. Each field is independently optional: pass only the
// seeds you intend to change. Pass `null` to clear a seed.
// ============================================================

export async function updateSOPTemplateSeeds(
  templateId: string,
  data: UpdateSOPTemplateSeedsInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Reuse the same gate as updateSOPTemplate.
    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateSOPTemplateSeedsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.sOPTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return { success: false as const, error: "SOP template not found" };
    }

    const seeds = parsed.data;

    // Map each provided seed to a Prisma JSON write. `undefined` → skip the
    // column; `null` → clear it (Prisma.DbNull); a value → store it.
    const toJson = (
      value: unknown
    ): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return Prisma.DbNull;
      return value as Prisma.InputJsonValue;
    };

    const template = await prisma.sOPTemplate.update({
      where: { id: templateId },
      data: {
        ...(seeds.kitchenSeed !== undefined && {
          kitchenSeed: toJson(seeds.kitchenSeed),
        }),
        ...(seeds.procurementSeed !== undefined && {
          procurementSeed: toJson(seeds.procurementSeed),
        }),
        ...(seeds.dispatchSeed !== undefined && {
          dispatchSeed: toJson(seeds.dispatchSeed),
        }),
        ...(seeds.beoDefaults !== undefined && {
          beoDefaults: toJson(seeds.beoDefaults),
        }),
      },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "SOPTemplate",
      entityId: templateId,
      changes: {
        seeds: Object.keys(seeds).filter(
          (k) => seeds[k as keyof typeof seeds] !== undefined
        ),
      },
    });

    revalidatePath("/settings/sop-templates");
    revalidatePath(`/settings/sop-templates/${templateId}`);
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[UPDATE_SOP_TEMPLATE_SEEDS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update provisioning seeds",
    };
  }
}

// ============================================================
// Delete SOP Template
// ============================================================

export async function deleteSOPTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.sOPTemplate.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return { success: false as const, error: "SOP template not found" };
    }

    // Cascade will remove phases and task definitions
    await prisma.sOPTemplate.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "SOPTemplate",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_SOP_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to delete SOP template" };
  }
}

// ============================================================
// Add SOP Phase to Template
// ============================================================

export async function addSOPPhase(
  templateId: string,
  data: AddSOPPhaseInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addSOPPhaseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify template exists
    const template = await prisma.sOPTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    });

    if (!template) {
      return { success: false as const, error: "SOP template not found" };
    }

    const phaseData = parsed.data;

    // Get max order from existing phases for auto-order
    const maxOrder = await prisma.sOPPhase.aggregate({
      where: { templateId },
      _max: { order: true },
    });

    const phase = await prisma.sOPPhase.create({
      data: {
        name: phaseData.name,
        phase: phaseData.phase,
        order: phaseData.order ?? (maxOrder._max.order ?? -1) + 1,
        description: phaseData.description || null,
        templateId,
      },
      include: {
        taskDefinitions: {
          orderBy: { order: "asc" },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "SOPPhase",
      entityId: phase.id,
      changes: { templateId, name: phaseData.name, phase: phaseData.phase },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(phase) };
  } catch (error) {
    console.error("[ADD_SOP_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to add SOP phase" };
  }
}

// ============================================================
// Update SOP Phase
// ============================================================

export async function updateSOPPhase(
  phaseId: string,
  data: UpdateSOPPhaseInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateSOPPhaseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.sOPPhase.findUnique({
      where: { id: phaseId },
      include: { template: { select: { id: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "SOP phase not found" };
    }

    const updateData = parsed.data;

    const phase = await prisma.sOPPhase.update({
      where: { id: phaseId },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.phase !== undefined && { phase: updateData.phase }),
        ...(updateData.description !== undefined && {
          description: updateData.description || null,
        }),
      },
      include: {
        taskDefinitions: {
          orderBy: { order: "asc" },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "SOPPhase",
      entityId: phaseId,
      changes: updateData as Record<string, unknown>,
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(phase) };
  } catch (error) {
    console.error("[UPDATE_SOP_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to update SOP phase" };
  }
}

// ============================================================
// Remove SOP Phase
// ============================================================

export async function removeSOPPhase(phaseId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.sOPPhase.findUnique({
      where: { id: phaseId },
      include: { template: { select: { id: true, name: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "SOP phase not found" };
    }

    // Cascade will remove task definitions
    await prisma.sOPPhase.delete({ where: { id: phaseId } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "SOPPhase",
      entityId: phaseId,
      changes: { name: existing.name, templateId: existing.template.id },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: { id: phaseId } };
  } catch (error) {
    console.error("[REMOVE_SOP_PHASE_ERROR]", error);
    return { success: false as const, error: "Failed to remove SOP phase" };
  }
}

// ============================================================
// Add SOP Task Definition to Phase
// ============================================================

export async function addSOPTaskDefinition(
  phaseId: string,
  data: AddSOPTaskDefInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addSOPTaskDefSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify phase exists
    const phase = await prisma.sOPPhase.findUnique({
      where: { id: phaseId },
      include: { template: { select: { id: true, name: true } } },
    });

    if (!phase) {
      return { success: false as const, error: "SOP phase not found" };
    }

    const taskData = parsed.data;

    // Get max order from existing task definitions
    const maxOrder = await prisma.sOPTaskDefinition.aggregate({
      where: { phaseId },
      _max: { order: true },
    });

    const taskDef = await prisma.sOPTaskDefinition.create({
      data: {
        title: taskData.title,
        description: taskData.description || null,
        category: taskData.category,
        priority: taskData.priority,
        estimatedMinutes: taskData.estimatedMinutes ?? null,
        isMandatory: taskData.isMandatory,
        requiresApproval: taskData.requiresApproval,
        requiresProof: taskData.requiresProof,
        order: taskData.order ?? (maxOrder._max.order ?? -1) + 1,
        checklistItems: taskData.checklistItems
          ? (taskData.checklistItems as unknown as Prisma.InputJsonValue)
          : undefined,
        dependsOnTaskOrder: taskData.dependsOnTaskOrder ?? null,
        phaseId,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "SOPTaskDefinition",
      entityId: taskDef.id,
      changes: { phaseId, title: taskData.title, category: taskData.category },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(taskDef) };
  } catch (error) {
    console.error("[ADD_SOP_TASK_DEF_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to add SOP task definition",
    };
  }
}

// ============================================================
// Update SOP Task Definition
// ============================================================

export async function updateSOPTaskDefinition(
  id: string,
  data: UpdateSOPTaskDefInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateSOPTaskDefSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.sOPTaskDefinition.findUnique({
      where: { id },
      include: {
        phase: {
          include: { template: { select: { id: true } } },
        },
      },
    });

    if (!existing) {
      return {
        success: false as const,
        error: "SOP task definition not found",
      };
    }

    const updateData = parsed.data;

    const taskDef = await prisma.sOPTaskDefinition.update({
      where: { id },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.description !== undefined && {
          description: updateData.description || null,
        }),
        ...(updateData.category !== undefined && {
          category: updateData.category,
        }),
        ...(updateData.priority !== undefined && {
          priority: updateData.priority,
        }),
        ...(updateData.estimatedMinutes !== undefined && {
          estimatedMinutes: updateData.estimatedMinutes ?? null,
        }),
        ...(updateData.isMandatory !== undefined && {
          isMandatory: updateData.isMandatory,
        }),
        ...(updateData.requiresApproval !== undefined && {
          requiresApproval: updateData.requiresApproval,
        }),
        ...(updateData.requiresProof !== undefined && {
          requiresProof: updateData.requiresProof,
        }),
        ...(updateData.checklistItems !== undefined && {
          checklistItems: updateData.checklistItems
            ? (updateData.checklistItems as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
        ...(updateData.dependsOnTaskOrder !== undefined && {
          dependsOnTaskOrder: updateData.dependsOnTaskOrder ?? null,
        }),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "SOPTaskDefinition",
      entityId: id,
      changes: updateData as Record<string, unknown>,
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: serialize(taskDef) };
  } catch (error) {
    console.error("[UPDATE_SOP_TASK_DEF_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update SOP task definition",
    };
  }
}

// ============================================================
// Remove SOP Task Definition
// ============================================================

export async function removeSOPTaskDefinition(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "sop:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.sOPTaskDefinition.findUnique({
      where: { id },
      select: { id: true, title: true, phaseId: true },
    });

    if (!existing) {
      return {
        success: false as const,
        error: "SOP task definition not found",
      };
    }

    await prisma.sOPTaskDefinition.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "SOPTaskDefinition",
      entityId: id,
      changes: { title: existing.title, phaseId: existing.phaseId },
    });

    revalidatePath("/settings/sop-templates");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[REMOVE_SOP_TASK_DEF_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to remove SOP task definition",
    };
  }
}

// ============================================================
// Apply SOP Template to Booking (Instantiate Execution Plan)
// ============================================================

export async function applySOPToBooking(
  templateId: string,
  bookingId: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Fetch the full SOP template with phases and task definitions
    const template = await prisma.sOPTemplate.findUnique({
      where: { id: templateId },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            taskDefinitions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!template) {
      return { success: false as const, error: "SOP template not found" };
    }

    // Verify booking exists and get eventDate
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        date: true,
      },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check if ExecutionPlan already exists for this booking
    const existingPlan = await prisma.executionPlan.findUnique({
      where: { bookingId },
    });

    if (existingPlan) {
      return {
        success: false as const,
        error: "An execution plan already exists for this booking",
      };
    }

    // Use a transaction to create the full execution plan atomically
    const plan = await prisma.$transaction(async (tx) => {
      // Create the ExecutionPlan
      const executionPlan = await tx.executionPlan.create({
        data: {
          status: "PLANNING",
          eventDate: booking.date,
          bookingId,
          sopTemplateId: templateId,
          createdById: session.user.id,
        },
      });

      // For each SOP Phase, create an ExecutionPhase and its tasks
      for (const sopPhase of template.phases) {
        const executionPhase = await tx.executionPhase.create({
          data: {
            name: sopPhase.name,
            phase: sopPhase.phase,
            order: sopPhase.order,
            status: "NOT_STARTED",
            planId: executionPlan.id,
          },
        });

        // Build a map of task order -> executionTask id for dependency resolution
        const taskOrderToIdMap: Record<number, string> = {};

        for (const taskDef of sopPhase.taskDefinitions) {
          const executionTask = await tx.executionTask.create({
            data: {
              title: taskDef.title,
              description: taskDef.description,
              category: taskDef.category,
              priority: taskDef.priority,
              status: "NOT_STARTED",
              estimatedMinutes: taskDef.estimatedMinutes,
              isMandatory: taskDef.isMandatory,
              requiresApproval: taskDef.requiresApproval,
              requiresProof: taskDef.requiresProof,
              order: taskDef.order,
              dependsOnTaskId:
                taskDef.dependsOnTaskOrder != null
                  ? taskOrderToIdMap[taskDef.dependsOnTaskOrder] ?? null
                  : null,
              phaseId: executionPhase.id,
            },
          });

          // Track the mapping for dependency resolution
          taskOrderToIdMap[taskDef.order] = executionTask.id;

          // Create checklist items from the JSON field
          if (taskDef.checklistItems) {
            const items = taskDef.checklistItems as Array<{
              title: string;
              order: number;
            }>;

            if (Array.isArray(items) && items.length > 0) {
              await tx.executionChecklist.createMany({
                data: items.map((item) => ({
                  title: item.title,
                  order: item.order,
                  taskId: executionTask.id,
                })),
              });
            }
          }
        }
      }

      // Return the full plan with nested includes
      return tx.executionPlan.findUnique({
        where: { id: executionPlan.id },
        include: {
          phases: {
            orderBy: { order: "asc" },
            include: {
              tasks: {
                orderBy: { order: "asc" },
                include: {
                  checklistItems: {
                    orderBy: { order: "asc" },
                  },
                },
              },
            },
          },
          sopTemplate: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ExecutionPlan",
      entityId: plan!.id,
      changes: {
        bookingId,
        sopTemplateId: templateId,
        templateName: template.name,
        phasesCount: template.phases.length,
      },
    });

    notify({
      userId: session.user.id,
      type: "SYSTEM",
      title: "Execution Plan Created",
      message: `SOP template "${template.name}" has been applied to "${booking.eventName}" (${booking.bookingNumber}).`,
      actionUrl: `/bookings/${bookingId}/execution`,
    });

    revalidatePath("/settings/sop-templates");
    revalidatePath(`/bookings/${bookingId}/execution`);
    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[APPLY_SOP_TO_BOOKING_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to apply SOP template to booking",
    };
  }
}
