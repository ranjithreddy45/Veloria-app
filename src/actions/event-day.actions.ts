"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import type { TimelineStatus, TimelineItemStatus } from "@prisma/client";
import {
  addTimelineItemSchema,
  updateTimelineItemSchema,
  updateItemStatusSchema,
  updateTimelineStatusSchema,
  reorderItemsSchema,
  type AddTimelineItemInput,
  type UpdateTimelineItemInput,
} from "@/schemas/event-day.schema";

// ============================================================
// Get Timeline (with items and assignee names)
// ============================================================

export async function getTimeline(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const timeline = await prisma.eventTimeline.findUnique({
      where: { bookingId },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    if (!timeline) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(timeline) };
  } catch (error) {
    console.error("[GET_TIMELINE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch timeline" };
  }
}

// ============================================================
// Create Timeline (empty timeline for a booking)
// ============================================================

export async function createTimeline(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, eventName: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check if timeline already exists
    const existing = await prisma.eventTimeline.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return { success: false as const, error: "Timeline already exists for this booking" };
    }

    const timeline = await prisma.eventTimeline.create({
      data: {
        bookingId,
        status: "PLANNED",
      },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "EventTimeline",
      entityId: timeline.id,
      changes: { bookingId, eventName: booking.eventName },
    });

    revalidatePath(`/bookings/${bookingId}/day-of`);
    return { success: true as const, data: serialize(timeline) };
  } catch (error) {
    console.error("[CREATE_TIMELINE_ERROR]", error);
    return { success: false as const, error: "Failed to create timeline" };
  }
}

// ============================================================
// Add Timeline Item
// ============================================================

export async function addTimelineItem(
  timelineId: string,
  data: AddTimelineItemInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addTimelineItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify timeline exists
    const timeline = await prisma.eventTimeline.findUnique({
      where: { id: timelineId },
      select: { id: true, bookingId: true },
    });

    if (!timeline) {
      return { success: false as const, error: "Timeline not found" };
    }

    // Get max order
    const maxOrder = await prisma.timelineItem.aggregate({
      where: { timelineId },
      _max: { order: true },
    });

    const itemData = parsed.data;

    const item = await prisma.timelineItem.create({
      data: {
        time: itemData.time,
        activity: itemData.activity,
        assigneeId: itemData.assigneeId || null,
        notes: itemData.notes || null,
        order: (maxOrder._max.order ?? -1) + 1,
        timelineId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "TimelineItem",
      entityId: item.id,
      changes: { activity: itemData.activity, time: itemData.time },
    });

    revalidatePath(`/bookings/${timeline.bookingId}/day-of`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[ADD_TIMELINE_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to add timeline item" };
  }
}

// ============================================================
// Update Timeline Item
// ============================================================

export async function updateTimelineItem(
  itemId: string,
  data: UpdateTimelineItemInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateTimelineItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.timelineItem.findUnique({
      where: { id: itemId },
      include: { timeline: { select: { bookingId: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Timeline item not found" };
    }

    const itemData = parsed.data;

    const item = await prisma.timelineItem.update({
      where: { id: itemId },
      data: {
        ...(itemData.time !== undefined && { time: itemData.time }),
        ...(itemData.activity !== undefined && { activity: itemData.activity }),
        ...(itemData.assigneeId !== undefined && {
          assigneeId: itemData.assigneeId || null,
        }),
        ...(itemData.notes !== undefined && {
          notes: itemData.notes || null,
        }),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "TimelineItem",
      entityId: item.id,
      changes: itemData,
    });

    revalidatePath(`/bookings/${existing.timeline.bookingId}/day-of`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_TIMELINE_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to update timeline item" };
  }
}

// ============================================================
// Update Item Status
// ============================================================

export async function updateItemStatus(itemId: string, status: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateItemStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid status",
      };
    }

    const existing = await prisma.timelineItem.findUnique({
      where: { id: itemId },
      include: { timeline: { select: { bookingId: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Timeline item not found" };
    }

    const newStatus = parsed.data.status as TimelineItemStatus;

    const item = await prisma.timelineItem.update({
      where: { id: itemId },
      data: {
        status: newStatus,
        completedAt: newStatus === "DONE" ? new Date() : null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "TimelineItem",
      entityId: item.id,
      changes: { from: existing.status, to: newStatus, activity: existing.activity },
    });

    // Notify assignee if status changed to IN_PROGRESS
    if (newStatus === "IN_PROGRESS" && item.assignee) {
      notify({
        userId: item.assignee.id,
        type: "TASK_ASSIGNED",
        title: "Timeline Item In Progress",
        message: `"${item.activity}" is now in progress.`,
        actionUrl: `/bookings/${existing.timeline.bookingId}/day-of`,
      });
    }

    revalidatePath(`/bookings/${existing.timeline.bookingId}/day-of`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_ITEM_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update item status" };
  }
}

// ============================================================
// Remove Timeline Item
// ============================================================

export async function removeTimelineItem(itemId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "execution:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.timelineItem.findUnique({
      where: { id: itemId },
      include: { timeline: { select: { bookingId: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Timeline item not found" };
    }

    await prisma.timelineItem.delete({ where: { id: itemId } });

    await logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "TimelineItem",
      entityId: itemId,
      changes: { activity: existing.activity, time: existing.time },
    });

    revalidatePath(`/bookings/${existing.timeline.bookingId}/day-of`);
    return { success: true as const, data: { id: itemId } };
  } catch (error) {
    console.error("[REMOVE_TIMELINE_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to remove timeline item" };
  }
}

// ============================================================
// Reorder Items (batch update order)
// ============================================================

export async function reorderItems(
  timelineId: string,
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

    const parsed = reorderItemsSchema.safeParse({ items });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
      };
    }

    const timeline = await prisma.eventTimeline.findUnique({
      where: { id: timelineId },
      select: { id: true, bookingId: true },
    });

    if (!timeline) {
      return { success: false as const, error: "Timeline not found" };
    }

    await prisma.$transaction(
      parsed.data.items.map((item) =>
        prisma.timelineItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "EventTimeline",
      entityId: timelineId,
      changes: { action: "reordered_items", count: items.length },
    });

    revalidatePath(`/bookings/${timeline.bookingId}/day-of`);
    return { success: true as const, data: null };
  } catch (error) {
    console.error("[REORDER_ITEMS_ERROR]", error);
    return { success: false as const, error: "Failed to reorder items" };
  }
}

// ============================================================
// Update Timeline Status (PLANNED / LIVE / COMPLETED)
// ============================================================

export async function updateTimelineStatus(
  timelineId: string,
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

    const parsed = updateTimelineStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid timeline status",
      };
    }

    const existing = await prisma.eventTimeline.findUnique({
      where: { id: timelineId },
      select: { id: true, bookingId: true, status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Timeline not found" };
    }

    const newStatus = parsed.data.status as TimelineStatus;

    const timeline = await prisma.eventTimeline.update({
      where: { id: timelineId },
      data: { status: newStatus },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "EventTimeline",
      entityId: timelineId,
      changes: { from: existing.status, to: newStatus },
    });

    revalidatePath(`/bookings/${existing.bookingId}/day-of`);
    return { success: true as const, data: serialize(timeline) };
  } catch (error) {
    console.error("[UPDATE_TIMELINE_STATUS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update timeline status",
    };
  }
}

// ============================================================
// Get Staff for Assignment (dropdown)
// ============================================================

export async function getStaffForAssignment() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const staff = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "CLIENT" },
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(staff) };
  } catch (error) {
    console.error("[GET_STAFF_FOR_ASSIGNMENT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch staff" };
  }
}
