"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createOperationSchema,
  updateOperationSchema,
  updateRunOfShowSchema,
  assignStaffSchema,
  updateStaffStatusSchema,
  assignOperationVendorSchema,
  type CreateOperationInput,
  type UpdateOperationInput,
  type UpdateRunOfShowInput,
  type AssignStaffInput,
  type UpdateStaffStatusInput,
  type AssignOperationVendorInput,
} from "@/schemas/operations.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

// ============================================================
// Get Operation by Booking ID
// ============================================================

export async function getOperation(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const operation = await prisma.eventOperation.findUnique({
      where: { bookingId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        staffAssignments: {
          orderBy: { shiftStart: "asc" },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        vendorAssignments: {
          orderBy: { createdAt: "asc" },
          include: {
            bookingVendor: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!operation) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(operation) };
  } catch (error) {
    console.error("[GET_OPERATION_ERROR]", error);
    return { success: false as const, error: "Failed to fetch operation" };
  }
}

// ============================================================
// Create Operation
// ============================================================

export async function createOperation(data: CreateOperationInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = createOperationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const operationData = parsed.data;

    // Check booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: operationData.bookingId },
      select: { id: true, bookingNumber: true, eventName: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check if operation already exists for this booking
    const existing = await prisma.eventOperation.findUnique({
      where: { bookingId: operationData.bookingId },
    });

    if (existing) {
      return {
        success: false as const,
        error: "An operation plan already exists for this booking",
      };
    }

    const operation = await prisma.eventOperation.create({
      data: {
        bookingId: operationData.bookingId,
        status: operationData.status ?? "PLANNING",
        internalNotes: operationData.internalNotes || null,
        runOfShow: [],
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        staffAssignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        vendorAssignments: {
          include: {
            bookingVendor: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EventOperation",
      entityId: operation.id,
      changes: { bookingId: operationData.bookingId },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Operation Plan Created",
      message: `Operation plan created for "${booking.eventName}" (${booking.bookingNumber}).`,
      actionUrl: `/bookings/${operationData.bookingId}/operations`,
    });

    revalidatePath(`/bookings/${operationData.bookingId}/operations`);
    revalidatePath(`/bookings/${operationData.bookingId}`);
    return { success: true as const, data: serialize(operation) };
  } catch (error) {
    console.error("[CREATE_OPERATION_ERROR]", error);
    return { success: false as const, error: "Failed to create operation" };
  }
}

// ============================================================
// Update Operation
// ============================================================

export async function updateOperation(
  id: string,
  data: UpdateOperationInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = updateOperationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.eventOperation.findUnique({
      where: { id },
      select: { id: true, bookingId: true, status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Operation not found" };
    }

    const updateData = parsed.data;

    const operation = await prisma.eventOperation.update({
      where: { id },
      data: {
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.internalNotes !== undefined && {
          internalNotes: updateData.internalNotes || null,
        }),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EventOperation",
      entityId: id,
      changes: updateData as Record<string, unknown>,
    });

    revalidatePath(`/bookings/${existing.bookingId}/operations`);
    return { success: true as const, data: serialize(operation) };
  } catch (error) {
    console.error("[UPDATE_OPERATION_ERROR]", error);
    return { success: false as const, error: "Failed to update operation" };
  }
}

// ============================================================
// Update Run of Show
// ============================================================

export async function updateRunOfShow(
  operationId: string,
  data: UpdateRunOfShowInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = updateRunOfShowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.eventOperation.findUnique({
      where: { id: operationId },
      select: { id: true, bookingId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Operation not found" };
    }

    const operation = await prisma.eventOperation.update({
      where: { id: operationId },
      data: {
        runOfShow: parsed.data.items as unknown as Prisma.InputJsonValue[],
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EventOperation",
      entityId: operationId,
      changes: { runOfShow: `${parsed.data.items.length} items` },
    });

    revalidatePath(`/bookings/${existing.bookingId}/operations`);
    return { success: true as const, data: serialize(operation) };
  } catch (error) {
    console.error("[UPDATE_RUN_OF_SHOW_ERROR]", error);
    return { success: false as const, error: "Failed to update run of show" };
  }
}

// ============================================================
// Assign Staff
// ============================================================

export async function assignStaff(
  operationId: string,
  data: AssignStaffInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignStaffSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.eventOperation.findUnique({
      where: { id: operationId },
      select: { id: true, bookingId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Operation not found" };
    }

    const staffData = parsed.data;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: staffData.userId },
      select: { id: true, name: true },
    });

    if (!user) {
      return { success: false as const, error: "Staff member not found" };
    }

    const assignment = await prisma.staffAssignment.create({
      data: {
        operationId,
        userId: staffData.userId,
        role: staffData.role,
        shiftStart: staffData.shiftStart,
        shiftEnd: staffData.shiftEnd,
        notes: staffData.notes || null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "StaffAssignment",
      entityId: assignment.id,
      changes: { operationId, staffName: user.name, role: staffData.role },
    });

    notify({
      userId: staffData.userId,
      type: "TASK_ASSIGNED",
      title: "Staff Assignment",
      message: `You have been assigned as "${staffData.role}" for an event.`,
      actionUrl: `/bookings/${existing.bookingId}/operations`,
    });

    revalidatePath(`/bookings/${existing.bookingId}/operations`);
    return { success: true as const, data: serialize(assignment) };
  } catch (error) {
    console.error("[ASSIGN_STAFF_ERROR]", error);
    return { success: false as const, error: "Failed to assign staff" };
  }
}

// ============================================================
// Remove Staff Assignment
// ============================================================

export async function removeStaffAssignment(assignmentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.staffAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        operation: { select: { bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Assignment not found" };
    }

    await prisma.staffAssignment.delete({ where: { id: assignmentId } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "StaffAssignment",
      entityId: assignmentId,
    });

    revalidatePath(`/bookings/${existing.operation.bookingId}/operations`);
    return { success: true as const, data: { id: assignmentId } };
  } catch (error) {
    console.error("[REMOVE_STAFF_ASSIGNMENT_ERROR]", error);
    return { success: false as const, error: "Failed to remove staff assignment" };
  }
}

// ============================================================
// Update Staff Assignment Status
// ============================================================

export async function updateStaffStatus(
  assignmentId: string,
  data: UpdateStaffStatusInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = updateStaffStatusSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.staffAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        operation: { select: { bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Assignment not found" };
    }

    const assignment = await prisma.staffAssignment.update({
      where: { id: assignmentId },
      data: { status: parsed.data.status },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "StaffAssignment",
      entityId: assignmentId,
      changes: { status: parsed.data.status },
    });

    revalidatePath(`/bookings/${existing.operation.bookingId}/operations`);
    return { success: true as const, data: serialize(assignment) };
  } catch (error) {
    console.error("[UPDATE_STAFF_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update staff status" };
  }
}

// ============================================================
// Assign Vendor to Operation
// ============================================================

export async function assignVendor(
  operationId: string,
  data: AssignOperationVendorInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignOperationVendorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.eventOperation.findUnique({
      where: { id: operationId },
      select: { id: true, bookingId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Operation not found" };
    }

    const vendorData = parsed.data;

    // Verify booking vendor exists
    const bookingVendor = await prisma.bookingVendor.findUnique({
      where: { id: vendorData.bookingVendorId },
      include: { vendor: { select: { name: true } } },
    });

    if (!bookingVendor) {
      return { success: false as const, error: "Booking vendor not found" };
    }

    const assignment = await prisma.operationVendorAssignment.create({
      data: {
        operationId,
        bookingVendorId: vendorData.bookingVendorId,
        arrivalTime: vendorData.arrivalTime || null,
        setupTime: vendorData.setupTime || null,
        teardownTime: vendorData.teardownTime || null,
        notes: vendorData.notes || null,
      },
      include: {
        bookingVendor: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                category: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "OperationVendorAssignment",
      entityId: assignment.id,
      changes: {
        operationId,
        vendorName: bookingVendor.vendor.name,
      },
    });

    revalidatePath(`/bookings/${existing.bookingId}/operations`);
    return { success: true as const, data: serialize(assignment) };
  } catch (error) {
    console.error("[ASSIGN_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to assign vendor" };
  }
}

// ============================================================
// Remove Vendor Assignment
// ============================================================

export async function removeVendorAssignment(assignmentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.operationVendorAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        operation: { select: { bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Assignment not found" };
    }

    await prisma.operationVendorAssignment.delete({
      where: { id: assignmentId },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "OperationVendorAssignment",
      entityId: assignmentId,
    });

    revalidatePath(`/bookings/${existing.operation.bookingId}/operations`);
    return { success: true as const, data: { id: assignmentId } };
  } catch (error) {
    console.error("[REMOVE_VENDOR_ASSIGNMENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to remove vendor assignment",
    };
  }
}

// ============================================================
// Get Staff Users (STAFF + EVENT_COORDINATOR roles)
// ============================================================

export async function getStaffUsers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: ["STAFF", "EVENT_COORDINATOR"] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(users) };
  } catch (error) {
    console.error("[GET_STAFF_USERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch staff users" };
  }
}
