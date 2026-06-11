"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

// Sales sees only AVAILABLE+ inventory; BD/OPS/Admin see everything incl. ONBOARDING.
export async function getAcqProperties(): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const salesOnly = user.role === "SALES_EXEC";
  const where: Record<string, unknown> = { deletedAt: null };
  if (salesOnly) where.status = { in: ["AVAILABLE", "ACTIVE", "PAUSED"] };

  const properties = await prisma.acqProperty.findMany({
    where,
    include: {
      propertyManager: { select: { id: true, name: true } },
      onboardingProject: { include: { _count: { select: { tasks: true } }, tasks: { select: { done: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { success: true, data: serialize(properties) as unknown[] };
}

export async function getAcqProperty(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const property = await prisma.acqProperty.findFirst({
    where: { id, deletedAt: null },
    include: {
      propertyManager: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      onboardingProject: { include: { tasks: { orderBy: { createdAt: "asc" }, include: { assignee: { select: { name: true } } } } } },
    },
  });
  if (!property) return { success: false, error: "Property not found" };
  return { success: true, data: serialize(property) };
}

export async function setAcqOnboardingTaskDone(taskId: string, done: boolean): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "onboarding:complete")) return { success: false, error: "Only Operations / Admin can update onboarding." };

  const task = await prisma.acqOnboardingTask.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return { success: false, error: "Task not found" };

  await prisma.acqOnboardingTask.update({ where: { id: taskId }, data: { done } });

  // Recompute project completion.
  const remaining = await prisma.acqOnboardingTask.count({ where: { projectId: task.projectId, done: false } });
  await prisma.acqOnboardingProject.update({
    where: { id: task.projectId },
    data: remaining === 0 ? { status: "COMPLETED", completedAt: new Date() } : { status: "OPEN", completedAt: null },
  });

  revalidatePath(`/bd/properties/${task.project.propertyId}`);
  return { success: true, data: { id: taskId } };
}

export async function assignPropertyManager(propertyId: string, managerId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "onboarding:complete")) return { success: false, error: "Unauthorized" };
  const mgr = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } });
  if (!mgr) return { success: false, error: "Manager not found" };
  await prisma.acqProperty.update({ where: { id: propertyId }, data: { propertyManagerId: managerId } });
  revalidatePath(`/bd/properties/${propertyId}`);
  return { success: true, data: { id: propertyId } };
}

// ------------------------------------------------------------
// §6.2 — THE critical gate: ONBOARDING → AVAILABLE notifies Sales.
// Allowed only when onboarding is COMPLETED and a manager is assigned.
// ------------------------------------------------------------
export async function markPropertyAvailable(propertyId: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "property:available")) return { success: false, error: "Only BD Head / Operations / Admin can publish inventory." };

  const property = await prisma.acqProperty.findFirst({
    where: { id: propertyId, deletedAt: null },
    include: { onboardingProject: { include: { tasks: { select: { done: true } } } } },
  });
  if (!property) return { success: false, error: "Property not found" };
  if (property.status !== "ONBOARDING") {
    return { success: false, error: `Property is already ${property.status}.` };
  }
  if (!property.propertyManagerId) {
    return { success: false, error: "Assign a Property Manager before publishing." };
  }
  const project = property.onboardingProject;
  const allDone = project != null && project.tasks.length > 0 && project.tasks.every((t) => t.done);
  if (!allDone || project?.status !== "COMPLETED") {
    return { success: false, error: "Complete every onboarding task before publishing." };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.acqProperty.update({
      where: { id: propertyId },
      data: { status: "AVAILABLE", availableAt: now },
    });
    await tx.acqStageTransition.create({
      data: { entity: "PROPERTY", entityId: propertyId, fromState: "ONBOARDING", toState: "AVAILABLE", actorId: user.id },
    });
  });

  // §6.2 — Notify Sales (the ONLY event that exposes bookable inventory).
  const sales = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["SALES_EXEC", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  for (const u of sales) {
    notify({
      userId: u.id,
      type: "SYSTEM",
      title: "New property available",
      message: `New Property Available: ${property.propertyName}, ${property.locality}`,
      actionUrl: `/bd/properties/${propertyId}`,
    });
  }
  logActivity({ userId: user.id, action: "PROPERTY_AVAILABLE", entityType: "AcqProperty", entityId: propertyId, changes: {} });

  revalidatePath("/bd/properties");
  revalidatePath(`/bd/properties/${propertyId}`);
  return { success: true, data: { status: "AVAILABLE" } };
}
