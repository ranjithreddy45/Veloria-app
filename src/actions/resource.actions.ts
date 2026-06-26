"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  resourceSchema,
  allocationSchema,
  type ResourceInput,
  type AllocationInput,
} from "@/schemas/resource.schema";
import type { ResourceType } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";

// ============================================================
// Get Resources (Paginated + Filtered)
// ============================================================

export async function getResources(params?: {
  search?: string;
  type?: ResourceType;
  isAvailable?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:read")) {
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

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.isAvailable !== undefined) {
      where.isAvailable = params.isAvailable;
    }

    const [resources, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        include: {
          _count: {
            select: {
              allocations: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.resource.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(resources),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_RESOURCES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch resources" };
  }
}

// ============================================================
// Get Single Resource
// ============================================================

export async function getResource(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        allocations: {
          orderBy: { date: "desc" },
          include: {
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                eventName: true,
                date: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!resource) {
      return { success: false as const, error: "Resource not found" };
    }

    return { success: true as const, data: serialize(resource) };
  } catch (error) {
    console.error("[GET_RESOURCE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch resource" };
  }
}

// ============================================================
// Create Resource
// ============================================================

export async function createResource(data: ResourceInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = resourceSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const resourceData = parsed.data;

    const resource = await prisma.resource.create({
      data: {
        name: resourceData.name,
        type: resourceData.type,
        description: resourceData.description || null,
        hourlyRate: resourceData.hourlyRate ?? null,
        isAvailable: resourceData.isAvailable ?? true,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Resource",
      entityId: resource.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Resource Created",
      message: `Resource "${resource.name}" has been added.`,
      actionUrl: `/resources/${resource.id}`,
    });

    revalidatePath("/resources");
    return { success: true as const, data: serialize(resource) };
  } catch (error) {
    console.error("[CREATE_RESOURCE_ERROR]", error);
    return { success: false as const, error: "Failed to create resource" };
  }
}

// ============================================================
// Update Resource
// ============================================================

export async function updateResource(id: string, data: ResourceInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = resourceSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Resource not found" };
    }

    const resourceData = parsed.data;

    const resource = await prisma.resource.update({
      where: { id },
      data: {
        name: resourceData.name,
        type: resourceData.type,
        description: resourceData.description || null,
        hourlyRate: resourceData.hourlyRate ?? null,
        isAvailable: resourceData.isAvailable ?? existing.isAvailable,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Resource",
      entityId: resource.id,
    });

    revalidatePath("/resources");
    revalidatePath(`/resources/${id}`);
    return { success: true as const, data: serialize(resource) };
  } catch (error) {
    console.error("[UPDATE_RESOURCE_ERROR]", error);
    return { success: false as const, error: "Failed to update resource" };
  }
}

// ============================================================
// Delete Resource
// ============================================================

export async function deleteResource(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.resource.findUnique({
      where: { id },
      include: {
        _count: { select: { allocations: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Resource not found" };
    }

    if (existing._count.allocations > 0) {
      return {
        success: false as const,
        error: "Cannot delete resource with existing allocations",
      };
    }

    await prisma.resource.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Resource",
      entityId: id,
    });

    revalidatePath("/resources");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_RESOURCE_ERROR]", error);
    return { success: false as const, error: "Failed to delete resource" };
  }
}

// ============================================================
// Allocate Resource
// ============================================================

export async function allocateResource(data: AllocationInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = allocationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const allocData = parsed.data;

    // Verify resource and booking exist
    const [resource, booking] = await Promise.all([
      prisma.resource.findUnique({
        where: { id: allocData.resourceId },
        select: { id: true, name: true, isAvailable: true },
      }),
      prisma.booking.findUnique({
        where: { id: allocData.bookingId },
        select: { id: true, bookingNumber: true, eventName: true },
      }),
    ]);

    if (!resource) {
      return { success: false as const, error: "Resource not found" };
    }
    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }
    if (!resource.isAvailable) {
      return { success: false as const, error: "Resource is not available" };
    }

    const allocation = await prisma.resourceAllocation.create({
      data: {
        resourceId: allocData.resourceId,
        bookingId: allocData.bookingId,
        date: new Date(allocData.date),
        startTime: allocData.startTime,
        endTime: allocData.endTime,
        notes: allocData.notes || null,
      },
      include: {
        resource: { select: { id: true, name: true } },
        booking: {
          select: { id: true, bookingNumber: true, eventName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "ResourceAllocation",
      entityId: allocation.id,
      changes: {
        resourceId: allocData.resourceId,
        resourceName: resource.name,
        bookingId: allocData.bookingId,
      },
    });

    revalidatePath(`/resources/${allocData.resourceId}`);
    revalidatePath("/resources");
    return { success: true as const, data: serialize(allocation) };
  } catch (error) {
    console.error("[ALLOCATE_RESOURCE_ERROR]", error);
    // Handle unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return {
        success: false as const,
        error:
          "This resource is already allocated for this date and start time",
      };
    }
    return { success: false as const, error: "Failed to allocate resource" };
  }
}

// ============================================================
// Deallocate Resource
// ============================================================

export async function deallocateResource(allocationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.resourceAllocation.findUnique({
      where: { id: allocationId },
      select: { id: true, resourceId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Allocation not found" };
    }

    await prisma.resourceAllocation.delete({
      where: { id: allocationId },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "ResourceAllocation",
      entityId: allocationId,
    });

    revalidatePath(`/resources/${existing.resourceId}`);
    revalidatePath("/resources");
    return { success: true as const, data: { id: allocationId } };
  } catch (error) {
    console.error("[DEALLOCATE_RESOURCE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to deallocate resource",
    };
  }
}

// ============================================================
// Check Conflicts
// ============================================================

export async function checkConflicts(resourceId: string, date: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const allocations = await prisma.resourceAllocation.findMany({
      where: {
        resourceId,
        date: new Date(date),
      },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return { success: true as const, data: serialize(allocations) };
  } catch (error) {
    console.error("[CHECK_CONFLICTS_ERROR]", error);
    return { success: false as const, error: "Failed to check conflicts" };
  }
}

// ============================================================
// Get Resource Calendar (All allocations for a month)
// ============================================================

export async function getResourceCalendar(month: number, year: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "resources:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const allocations = await prisma.resourceAllocation.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return { success: true as const, data: serialize(allocations) };
  } catch (error) {
    console.error("[GET_RESOURCE_CALENDAR_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch resource calendar",
    };
  }
}
