"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createTastingSchema,
  updateTastingSchema,
  completeTastingSchema,
  cancelTastingSchema,
  type CreateTastingInput,
  type UpdateTastingInput,
  type CompleteTastingInput,
  type CancelTastingInput,
} from "@/schemas/tasting.schema";
import type { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Tastings by Booking
// ============================================================

export async function getTastingsByBooking(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const tastings = await prisma.menuTasting.findMany({
      where: { bookingId },
      orderBy: { scheduledDate: "asc" },
    });

    return { success: true as const, data: serialize(tastings) };
  } catch (error) {
    console.error("[GET_TASTINGS_BY_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to fetch tastings" };
  }
}

// ============================================================
// Get Single Tasting
// ============================================================

export async function getTasting(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const tasting = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!tasting) {
      return { success: false as const, error: "Tasting not found" };
    }

    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[GET_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to fetch tasting" };
  }
}

// ============================================================
// Create Tasting
// ============================================================

export async function createTasting(
  bookingId: string,
  data: CreateTastingInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createTastingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingNumber: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    const tastingData = parsed.data;

    const tasting = await prisma.menuTasting.create({
      data: {
        scheduledDate: new Date(tastingData.scheduledDate),
        scheduledTime: tastingData.scheduledTime,
        contactId: tastingData.contactId,
        venueId: tastingData.venueId || null,
        notes: tastingData.notes || null,
        selectedItems:
          tastingData.selectedItems && tastingData.selectedItems.length > 0
            ? (tastingData.selectedItems as unknown as Prisma.InputJsonValue)
            : undefined,
        bookingId,
        status: "SCHEDULED",
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "MenuTasting",
      entityId: tasting.id,
      changes: {
        bookingId,
        bookingNumber: booking.bookingNumber,
        scheduledDate: tastingData.scheduledDate,
        scheduledTime: tastingData.scheduledTime,
      },
    });

    revalidatePath(`/bookings/${bookingId}/tasting`);
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[CREATE_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to create tasting" };
  }
}

// ============================================================
// Update Tasting
// ============================================================

export async function updateTasting(id: string, data: UpdateTastingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateTastingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only scheduled tastings can be updated",
      };
    }

    const tastingData = parsed.data;

    const tasting = await prisma.menuTasting.update({
      where: { id },
      data: {
        ...(tastingData.scheduledDate !== undefined && {
          scheduledDate: new Date(tastingData.scheduledDate),
        }),
        ...(tastingData.scheduledTime !== undefined && {
          scheduledTime: tastingData.scheduledTime,
        }),
        ...(tastingData.venueId !== undefined && {
          venueId: tastingData.venueId || null,
        }),
        ...(tastingData.notes !== undefined && {
          notes: tastingData.notes || null,
        }),
        ...(tastingData.selectedItems !== undefined && {
          selectedItems:
            tastingData.selectedItems.length > 0
              ? (tastingData.selectedItems as unknown as Prisma.InputJsonValue)
              : undefined,
        }),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "MenuTasting",
      entityId: tasting.id,
      changes: tastingData,
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[UPDATE_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to update tasting" };
  }
}

// ============================================================
// Delete Tasting
// ============================================================

export async function deleteTasting(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status === "COMPLETED") {
      return {
        success: false as const,
        error: "Completed tastings cannot be deleted",
      };
    }

    await prisma.menuTasting.delete({ where: { id } });

    await logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "MenuTasting",
      entityId: id,
      changes: {
        bookingId: existing.bookingId,
        scheduledDate: existing.scheduledDate.toISOString(),
      },
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to delete tasting" };
  }
}

// ============================================================
// Confirm Tasting (keep as SCHEDULED — marks as confirmed)
// ============================================================

export async function confirmTasting(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only scheduled tastings can be confirmed",
      };
    }

    // Confirmation is logged as an activity — status stays SCHEDULED
    await logActivity({
      userId: session.user.id,
      action: "confirmed",
      entityType: "MenuTasting",
      entityId: id,
      changes: {
        bookingId: existing.bookingId,
        scheduledDate: existing.scheduledDate.toISOString(),
        scheduledTime: existing.scheduledTime,
      },
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: serialize(existing) };
  } catch (error) {
    console.error("[CONFIRM_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to confirm tasting" };
  }
}

// ============================================================
// Complete Tasting (with feedback)
// ============================================================

export async function completeTasting(id: string, data: CompleteTastingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = completeTastingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only scheduled tastings can be completed",
      };
    }

    const tasting = await prisma.menuTasting.update({
      where: { id },
      data: {
        status: "COMPLETED",
        feedback: parsed.data.feedback || null,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "MenuTasting",
      entityId: id,
      changes: {
        from: "SCHEDULED",
        to: "COMPLETED",
        feedback: parsed.data.feedback || null,
      },
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[COMPLETE_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to complete tasting" };
  }
}

// ============================================================
// Cancel Tasting
// ============================================================

export async function cancelTasting(id: string, data: CancelTastingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = cancelTastingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only scheduled tastings can be cancelled",
      };
    }

    const tasting = await prisma.menuTasting.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: parsed.data.reason
          ? `${existing.notes ? existing.notes + "\n\n" : ""}Cancellation reason: ${parsed.data.reason}`
          : existing.notes,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "MenuTasting",
      entityId: id,
      changes: {
        from: "SCHEDULED",
        to: "CANCELLED",
        reason: parsed.data.reason || null,
      },
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[CANCEL_TASTING_ERROR]", error);
    return { success: false as const, error: "Failed to cancel tasting" };
  }
}

// ============================================================
// Mark Tasting as No-Show
// ============================================================

export async function markTastingNoShow(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tastings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.menuTasting.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Tasting not found" };
    }

    if (existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only scheduled tastings can be marked as no-show",
      };
    }

    const tasting = await prisma.menuTasting.update({
      where: { id },
      data: { status: "NO_SHOW" },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "MenuTasting",
      entityId: id,
      changes: { from: "SCHEDULED", to: "NO_SHOW" },
    });

    revalidatePath(`/bookings/${existing.bookingId}/tasting`);
    return { success: true as const, data: serialize(tasting) };
  } catch (error) {
    console.error("[MARK_TASTING_NO_SHOW_ERROR]", error);
    return { success: false as const, error: "Failed to mark tasting as no-show" };
  }
}
