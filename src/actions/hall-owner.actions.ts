"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { serialize } from "@/lib/utils";
import {
  hallOwnerSchema,
  hallOwnerStatusValues,
  type HallOwnerInput,
} from "@/schemas/hall-owner.schema";
import type { HallOwnerStatus } from "@prisma/client";

// Normalize "" → null and cast enum-ish strings safely.
function clean(data: HallOwnerInput) {
  const e = (v?: string) => (v ? v : null);
  return {
    ownerName: data.ownerName,
    companyName: e(data.companyName),
    email: e(data.email),
    phone: e(data.phone),
    whatsapp: e(data.whatsapp),
    gstin: e(data.gstin),
    numberOfHalls: data.numberOfHalls ?? null,
    totalCapacity: data.totalCapacity ?? null,
    propertyCity: e(data.propertyCity),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propertyType: (e(data.propertyType) as any) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownershipStatus: (e(data.ownershipStatus) as any) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commercialModel: (e(data.commercialModel) as any) ?? null,
    revenueSharePercent: data.revenueSharePercent ?? null,
    minimumMonthlyGuarantee: data.minimumMonthlyGuarantee ?? null,
    contractStatus: data.contractStatus as HallOwnerStatus,
    bdOwnerId: e(data.bdOwnerId),
    notes: e(data.notes),
  };
}

// Annual pipeline metric (O-8) lives in src/lib/acq/pipeline.ts — a "use server"
// file may only export async functions, so the sync helper can't live here.

// ============================================================
// List hall owners grouped by funnel stage
// ============================================================

export async function getHallOwners() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:read"))
      return { success: false as const, error: "Insufficient permissions" };

    const owners = await prisma.hallOwner.findMany({
      where: { deletedAt: null },
      include: { bdOwner: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true as const, data: serialize(owners) };
  } catch (error) {
    console.error("[GET_HALL_OWNERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch hall owners" };
  }
}

export async function getHallOwner(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:read"))
      return { success: false as const, error: "Insufficient permissions" };

    const owner = await prisma.hallOwner.findUnique({
      where: { id },
      include: { bdOwner: { select: { id: true, name: true } } },
    });
    if (!owner) return { success: false as const, error: "Not found" };
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[GET_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to fetch hall owner" };
  }
}

export async function createHallOwner(data: HallOwnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:create"))
      return { success: false as const, error: "Insufficient permissions" };

    const parsed = hallOwnerSchema.safeParse(data);
    if (!parsed.success)
      return { success: false as const, error: "Validation failed" };

    const owner = await prisma.hallOwner.create({ data: clean(parsed.data) });
    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "HallOwner",
      entityId: owner.id,
    });
    revalidatePath("/owners");
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[CREATE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to create hall owner" };
  }
}

export async function updateHallOwner(id: string, data: HallOwnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:update"))
      return { success: false as const, error: "Insufficient permissions" };

    const parsed = hallOwnerSchema.safeParse(data);
    if (!parsed.success)
      return { success: false as const, error: "Validation failed" };

    const owner = await prisma.hallOwner.update({
      where: { id },
      data: clean(parsed.data),
    });
    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "HallOwner",
      entityId: id,
    });
    revalidatePath("/owners");
    revalidatePath(`/owners/${id}`);
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[UPDATE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to update hall owner" };
  }
}

// Move an owner to a different funnel stage (board drag / quick action).
export async function moveHallOwnerStage(id: string, status: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:update"))
      return { success: false as const, error: "Insufficient permissions" };
    if (!(hallOwnerStatusValues as readonly string[]).includes(status))
      return { success: false as const, error: "Invalid stage" };

    await prisma.hallOwner.update({
      where: { id },
      data: { contractStatus: status as HallOwnerStatus },
    });
    await logActivity({
      userId: session.user.id as string,
      action: "stage_changed",
      entityType: "HallOwner",
      entityId: id,
      changes: { contractStatus: status },
    });
    revalidatePath("/owners");
    revalidatePath(`/owners/${id}`);
    return { success: true as const };
  } catch (error) {
    console.error("[MOVE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to move hall owner" };
  }
}

export async function deleteHallOwner(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:delete"))
      return { success: false as const, error: "Insufficient permissions" };

    await prisma.hallOwner.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "HallOwner",
      entityId: id,
    });
    revalidatePath("/owners");
    return { success: true as const };
  } catch (error) {
    console.error("[DELETE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to delete hall owner" };
  }
}
