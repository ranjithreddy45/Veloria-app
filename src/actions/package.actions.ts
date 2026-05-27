"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { packageSchema, type PackageInput } from "@/schemas/package.schema";
import type { PackageTier } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Packages (Paginated + Filtered)
// ============================================================

export async function getPackages(params?: {
  search?: string;
  eventType?: string;
  tier?: PackageTier;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.eventType) {
      where.eventType = params.eventType;
    }

    if (params?.tier) {
      where.tier = params.tier;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [packages, total] = await Promise.all([
      prisma.eventPackage.findMany({
        where,
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.eventPackage.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(packages),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_PACKAGES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch packages" };
  }
}

// ============================================================
// Get Single Package with Items
// ============================================================

export async function getPackage(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const eventPackage = await prisma.eventPackage.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!eventPackage) {
      return { success: false as const, error: "Package not found" };
    }

    return { success: true as const, data: serialize(eventPackage) };
  } catch (error) {
    console.error("[GET_PACKAGE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch package" };
  }
}

// ============================================================
// Create Package with Items
// ============================================================

export async function createPackage(data: PackageInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = packageSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const packageData = parsed.data;

    const eventPackage = await prisma.eventPackage.create({
      data: {
        name: packageData.name,
        description: packageData.description || null,
        eventType: packageData.eventType || null,
        basePrice: packageData.basePrice,
        tier: packageData.tier as PackageTier,
        isActive: packageData.isActive,
        imageUrl: packageData.imageUrl || null,
        items: {
          create: packageData.items.map((item, index) => ({
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            isIncluded: item.isIncluded,
            order: item.order ?? index,
          })),
        },
      },
      include: {
        items: { orderBy: { order: "asc" } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EventPackage",
      entityId: eventPackage.id,
    });

    revalidatePath("/packages");
    return { success: true as const, data: serialize(eventPackage) };
  } catch (error) {
    console.error("[CREATE_PACKAGE_ERROR]", error);
    return { success: false as const, error: "Failed to create package" };
  }
}

// ============================================================
// Update Package with Items
// ============================================================

export async function updatePackage(id: string, data: PackageInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = packageSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.eventPackage.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Package not found" };
    }

    const packageData = parsed.data;

    // Delete existing items and recreate (simplest approach for reordering)
    const eventPackage = await prisma.$transaction(async (tx) => {
      await tx.packageItem.deleteMany({ where: { packageId: id } });

      return tx.eventPackage.update({
        where: { id },
        data: {
          name: packageData.name,
          description: packageData.description || null,
          eventType: packageData.eventType || null,
          basePrice: packageData.basePrice,
          tier: packageData.tier as PackageTier,
          isActive: packageData.isActive,
          imageUrl: packageData.imageUrl || null,
          items: {
            create: packageData.items.map((item, index) => ({
              name: item.name,
              description: item.description || null,
              category: item.category || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              isIncluded: item.isIncluded,
              order: item.order ?? index,
            })),
          },
        },
        include: {
          items: { orderBy: { order: "asc" } },
        },
      });
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EventPackage",
      entityId: eventPackage.id,
    });

    revalidatePath("/packages");
    revalidatePath(`/packages/${id}`);
    return { success: true as const, data: serialize(eventPackage) };
  } catch (error) {
    console.error("[UPDATE_PACKAGE_ERROR]", error);
    return { success: false as const, error: "Failed to update package" };
  }
}

// ============================================================
// Delete Package
// ============================================================

export async function deletePackage(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.eventPackage.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Package not found" };
    }

    if (existing._count.quotes > 0) {
      return {
        success: false as const,
        error: "Cannot delete package that is referenced by quotes. Deactivate it instead.",
      };
    }

    await prisma.eventPackage.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "EventPackage",
      entityId: id,
    });

    revalidatePath("/packages");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_PACKAGE_ERROR]", error);
    return { success: false as const, error: "Failed to delete package" };
  }
}

// ============================================================
// Duplicate Package
// ============================================================

export async function duplicatePackage(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.eventPackage.findUnique({
      where: { id },
      include: { items: { orderBy: { order: "asc" } } },
    });

    if (!existing) {
      return { success: false as const, error: "Package not found" };
    }

    const duplicated = await prisma.eventPackage.create({
      data: {
        name: `${existing.name} (Copy)`,
        description: existing.description,
        eventType: existing.eventType,
        basePrice: existing.basePrice,
        tier: existing.tier,
        isActive: false,
        imageUrl: existing.imageUrl,
        items: {
          create: existing.items.map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            isIncluded: item.isIncluded,
            order: item.order,
          })),
        },
      },
      include: {
        items: { orderBy: { order: "asc" } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EventPackage",
      entityId: duplicated.id,
      changes: { duplicatedFrom: id },
    });

    revalidatePath("/packages");
    return { success: true as const, data: serialize(duplicated) };
  } catch (error) {
    console.error("[DUPLICATE_PACKAGE_ERROR]", error);
    return { success: false as const, error: "Failed to duplicate package" };
  }
}

// ============================================================
// Get Packages by Event Type
// ============================================================

export async function getPackagesByEventType(eventType: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const packages = await prisma.eventPackage.findMany({
      where: {
        eventType,
        isActive: true,
      },
      include: {
        items: { orderBy: { order: "asc" } },
        _count: { select: { items: true } },
      },
      orderBy: [{ tier: "asc" }, { basePrice: "asc" }],
    });

    return { success: true as const, data: serialize(packages) };
  } catch (error) {
    console.error("[GET_PACKAGES_BY_EVENT_TYPE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch packages" };
  }
}

// ============================================================
// Toggle Package Active Status
// ============================================================

export async function togglePackageStatus(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "packages:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.eventPackage.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Package not found" };
    }

    const eventPackage = await prisma.eventPackage.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EventPackage",
      entityId: id,
      changes: { isActive: eventPackage.isActive },
    });

    revalidatePath("/packages");
    revalidatePath(`/packages/${id}`);
    return { success: true as const, data: serialize(eventPackage) };
  } catch (error) {
    console.error("[TOGGLE_PACKAGE_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update package status" };
  }
}
