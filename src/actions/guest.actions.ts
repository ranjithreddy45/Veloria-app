"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  guestSchema,
  updateRSVPSchema,
  bulkImportSchema,
  type GuestInput,
  type UpdateRSVPInput,
  type BulkImportInput,
} from "@/schemas/guest.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";

// ============================================================
// Helper: Recalculate Guest List Totals
// ============================================================

async function recalculateGuestListTotals(guestListId: string) {
  const guests = await prisma.guest.findMany({
    where: { guestListId },
    select: {
      plusOnes: true,
      rsvpStatus: true,
      isCheckedIn: true,
    },
  });

  const totalInvited = guests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const totalRSVP = guests.filter((g) => g.rsvpStatus === "ACCEPTED").length;
  const totalCheckedIn = guests.filter((g) => g.isCheckedIn).length;

  await prisma.guestList.update({
    where: { id: guestListId },
    data: { totalInvited, totalRSVP, totalCheckedIn },
  });
}

// ============================================================
// Get Guest List (with all guests)
// ============================================================

export async function getGuestList(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const guestList = await prisma.guestList.findUnique({
      where: { bookingId },
      include: {
        guests: {
          orderBy: { createdAt: "desc" },
          include: {
            invitation: {
              select: {
                id: true,
                invitationStatus: true,
                sentAt: true,
                rsvpRespondedAt: true,
              },
            },
          },
        },
      },
    });

    if (!guestList) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(guestList) };
  } catch (error) {
    console.error("[GET_GUEST_LIST_ERROR]", error);
    return { success: false as const, error: "Failed to fetch guest list" };
  }
}

// ============================================================
// Create Guest List
// ============================================================

export async function createGuestList(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingNumber: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check if guest list already exists
    const existing = await prisma.guestList.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return { success: false as const, error: "Guest list already exists for this booking" };
    }

    const guestList = await prisma.guestList.create({
      data: { bookingId },
      include: { guests: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "GuestList",
      entityId: guestList.id,
      changes: { bookingId },
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const, data: serialize(guestList) };
  } catch (error) {
    console.error("[CREATE_GUEST_LIST_ERROR]", error);
    return { success: false as const, error: "Failed to create guest list" };
  }
}

// ============================================================
// Add Guest
// ============================================================

export async function addGuest(guestListId: string, data: GuestInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = guestSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify guest list exists
    const guestList = await prisma.guestList.findUnique({
      where: { id: guestListId },
      select: { id: true, bookingId: true },
    });

    if (!guestList) {
      return { success: false as const, error: "Guest list not found" };
    }

    const guestData = parsed.data;

    const guest = await prisma.guest.create({
      data: {
        guestListId,
        name: guestData.name,
        email: guestData.email || null,
        phone: guestData.phone || null,
        category: guestData.category,
        tableAssignment: guestData.tableAssignment || null,
        plusOnes: guestData.plusOnes ?? 0,
        dietaryRestrictions: guestData.dietaryRestrictions || null,
        notes: guestData.notes || null,
      },
    });

    await recalculateGuestListTotals(guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Guest",
      entityId: guest.id,
      changes: { guestListId, guestName: guestData.name },
    });

    revalidatePath(`/bookings/${guestList.bookingId}/guests`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[ADD_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to add guest" };
  }
}

// ============================================================
// Update Guest
// ============================================================

export async function updateGuest(guestId: string, data: GuestInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = guestSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        guestList: { select: { id: true, bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    const guestData = parsed.data;

    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: {
        name: guestData.name,
        email: guestData.email || null,
        phone: guestData.phone || null,
        category: guestData.category,
        tableAssignment: guestData.tableAssignment || null,
        plusOnes: guestData.plusOnes ?? 0,
        dietaryRestrictions: guestData.dietaryRestrictions || null,
        notes: guestData.notes || null,
      },
    });

    await recalculateGuestListTotals(existing.guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Guest",
      entityId: guestId,
    });

    revalidatePath(`/bookings/${existing.guestList.bookingId}/guests`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[UPDATE_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to update guest" };
  }
}

// ============================================================
// Remove Guest
// ============================================================

export async function removeGuest(guestId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        guestList: { select: { id: true, bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    await prisma.guest.delete({ where: { id: guestId } });

    await recalculateGuestListTotals(existing.guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Guest",
      entityId: guestId,
      changes: { guestName: existing.name },
    });

    revalidatePath(`/bookings/${existing.guestList.bookingId}/guests`);
    return { success: true as const, data: { id: guestId } };
  } catch (error) {
    console.error("[REMOVE_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to remove guest" };
  }
}

// ============================================================
// Bulk Import Guests
// ============================================================

export async function bulkImportGuests(guestListId: string, data: BulkImportInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkImportSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify guest list exists
    const guestList = await prisma.guestList.findUnique({
      where: { id: guestListId },
      select: { id: true, bookingId: true },
    });

    if (!guestList) {
      return { success: false as const, error: "Guest list not found" };
    }

    const guestsData = parsed.data.guests;

    const createdGuests = await prisma.guest.createMany({
      data: guestsData.map((g) => ({
        guestListId,
        name: g.name,
        email: g.email || null,
        phone: g.phone || null,
        category: g.category ?? "OTHER",
        tableAssignment: g.tableAssignment || null,
        plusOnes: g.plusOnes ?? 0,
      })),
    });

    await recalculateGuestListTotals(guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Guest",
      entityId: guestListId,
      changes: { bulkImport: true, count: createdGuests.count },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Guests Imported",
      message: `${createdGuests.count} guests have been imported successfully.`,
      actionUrl: `/bookings/${guestList.bookingId}/guests`,
    });

    revalidatePath(`/bookings/${guestList.bookingId}/guests`);
    return { success: true as const, data: { count: createdGuests.count } };
  } catch (error) {
    console.error("[BULK_IMPORT_GUESTS_ERROR]", error);
    return { success: false as const, error: "Failed to import guests" };
  }
}

// ============================================================
// Check In Guest (Toggle)
// ============================================================

export async function checkInGuest(guestId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:checkin")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        guestList: { select: { id: true, bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    const isCheckedIn = !existing.isCheckedIn;

    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: {
        isCheckedIn,
        checkedInAt: isCheckedIn ? new Date() : null,
      },
    });

    await recalculateGuestListTotals(existing.guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: isCheckedIn ? "checked_in" : "checked_out",
      entityType: "Guest",
      entityId: guestId,
      changes: { guestName: existing.name, isCheckedIn },
    });

    revalidatePath(`/bookings/${existing.guestList.bookingId}/guests`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[CHECK_IN_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to update check-in status" };
  }
}

// ============================================================
// Update RSVP Status
// ============================================================

export async function updateRSVP(guestId: string, data: UpdateRSVPInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "guests:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateRSVPSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        guestList: { select: { id: true, bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: { rsvpStatus: parsed.data.rsvpStatus },
    });

    await recalculateGuestListTotals(existing.guestListId);

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Guest",
      entityId: guestId,
      changes: { rsvpStatus: parsed.data.rsvpStatus, guestName: existing.name },
    });

    revalidatePath(`/bookings/${existing.guestList.bookingId}/guests`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[UPDATE_RSVP_ERROR]", error);
    return { success: false as const, error: "Failed to update RSVP status" };
  }
}

// ============================================================
// Get Check-In Stats
// ============================================================

export async function getCheckInStats(guestListId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const guestList = await prisma.guestList.findUnique({
      where: { id: guestListId },
      include: {
        guests: {
          select: {
            category: true,
            rsvpStatus: true,
            isCheckedIn: true,
            plusOnes: true,
          },
        },
      },
    });

    if (!guestList) {
      return { success: false as const, error: "Guest list not found" };
    }

    const guests = guestList.guests;

    const totalGuests = guests.length;
    const totalInvited = guests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
    const totalCheckedIn = guests.filter((g) => g.isCheckedIn).length;

    // By category
    const byCategory: Record<string, { total: number; checkedIn: number }> = {};
    for (const guest of guests) {
      if (!byCategory[guest.category]) {
        byCategory[guest.category] = { total: 0, checkedIn: 0 };
      }
      byCategory[guest.category].total += 1;
      if (guest.isCheckedIn) {
        byCategory[guest.category].checkedIn += 1;
      }
    }

    // By RSVP status
    const byRSVP: Record<string, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      DECLINED: 0,
    };
    for (const guest of guests) {
      byRSVP[guest.rsvpStatus] = (byRSVP[guest.rsvpStatus] ?? 0) + 1;
    }

    return {
      success: true as const,
      data: {
        totalGuests,
        totalInvited,
        totalCheckedIn,
        totalRSVP: byRSVP.ACCEPTED ?? 0,
        totalDeclined: byRSVP.DECLINED ?? 0,
        totalPending: byRSVP.PENDING ?? 0,
        byCategory,
        byRSVP,
      },
    };
  } catch (error) {
    console.error("[GET_CHECK_IN_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch check-in stats" };
  }
}
