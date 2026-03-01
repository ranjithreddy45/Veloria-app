"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  setVenueParentSchema,
  coordinatedScheduleSchema,
} from "@/schemas/multi-venue.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Venue Hierarchy
// ============================================================
// Returns all venues with their parent/child relationships.

export async function getVenueHierarchy() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "multi-venue:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venues = await prisma.venue.findMany({
      include: {
        parentVenue: {
          select: { id: true, name: true },
        },
        childVenues: {
          select: {
            id: true,
            name: true,
            capacity: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { bookings: true, childVenues: true } },
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(venues) };
  } catch (error) {
    console.error("[GET_VENUE_HIERARCHY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venue hierarchy" };
  }
}

// ============================================================
// Set Venue Parent
// ============================================================
// Assigns a parent venue to a child venue, or detaches it
// by passing parentVenueId as null.

export async function setVenueParent(venueId: string, parentVenueId: string | null) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "multi-venue:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = setVenueParentSchema.safeParse({ venueId, parentVenueId });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify the venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, parentVenueId: true },
    });

    if (!venue) {
      return { success: false as const, error: "Venue not found" };
    }

    // If assigning a parent, verify the parent exists and prevent circular refs
    if (parentVenueId) {
      if (parentVenueId === venueId) {
        return { success: false as const, error: "A venue cannot be its own parent" };
      }

      const parentVenue = await prisma.venue.findUnique({
        where: { id: parentVenueId },
        select: { id: true, parentVenueId: true },
      });

      if (!parentVenue) {
        return { success: false as const, error: "Parent venue not found" };
      }

      // Prevent circular reference: parent cannot be a child of this venue
      if (parentVenue.parentVenueId === venueId) {
        return {
          success: false as const,
          error: "Circular reference detected. The selected parent is already a child of this venue.",
        };
      }
    }

    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: { parentVenueId: parentVenueId },
      include: {
        parentVenue: { select: { id: true, name: true } },
        childVenues: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: parentVenueId ? "assigned_parent" : "detached_parent",
      entityType: "Venue",
      entityId: venueId,
      changes: {
        previousParentId: venue.parentVenueId,
        newParentId: parentVenueId,
      },
    });

    revalidatePath("/settings/venues");
    return { success: true as const, data: serialize(updatedVenue) };
  } catch (error) {
    console.error("[SET_VENUE_PARENT_ERROR]", error);
    return { success: false as const, error: "Failed to update venue parent" };
  }
}

// ============================================================
// Get Venue Group
// ============================================================
// Returns a parent venue with all its child venues.

export async function getVenueGroup(parentVenueId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "multi-venue:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!parentVenueId) {
      return { success: false as const, error: "Parent venue ID is required" };
    }

    const parentVenue = await prisma.venue.findUnique({
      where: { id: parentVenueId },
      include: {
        childVenues: {
          include: {
            _count: { select: { bookings: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { bookings: true, childVenues: true } },
      },
    });

    if (!parentVenue) {
      return { success: false as const, error: "Parent venue not found" };
    }

    return { success: true as const, data: serialize(parentVenue) };
  } catch (error) {
    console.error("[GET_VENUE_GROUP_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venue group" };
  }
}

// ============================================================
// Get Coordinated Schedule
// ============================================================
// Checks booking availability across multiple venues for a date.
// Returns per-venue availability with existing booking info.

export async function getCoordinatedSchedule(venueIds: string[], date: Date) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "multi-venue:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = coordinatedScheduleSchema.safeParse({ venueIds, date });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const bookingDate = new Date(parsed.data.date);
    bookingDate.setHours(0, 0, 0, 0);

    // Fetch all venues with their details
    const venues = await prisma.venue.findMany({
      where: { id: { in: parsed.data.venueIds } },
      select: { id: true, name: true, capacity: true, isActive: true },
    });

    // Fetch all bookings for the given venues on the given date
    const bookings = await prisma.booking.findMany({
      where: {
        venueId: { in: parsed.data.venueIds },
        date: bookingDate,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        timeSlot: true,
        venueId: true,
        venueGroupId: true,
      },
    });

    // Fetch blackout dates for the given venues on the given date
    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        venueId: { in: parsed.data.venueIds },
        date: bookingDate,
      },
      select: {
        venueId: true,
        timeSlot: true,
        reason: true,
      },
    });

    // Build availability map per venue
    const schedule = venues.map((venue) => {
      const venueBookings = bookings.filter((b) => b.venueId === venue.id);
      const venueBlackouts = blackouts.filter((b) => b.venueId === venue.id);

      const slots = {
        MORNING: { available: true, reason: null as string | null },
        AFTERNOON: { available: true, reason: null as string | null },
        EVENING: { available: true, reason: null as string | null },
        FULL_DAY: { available: true, reason: null as string | null },
      };

      // Check blackout dates
      for (const blackout of venueBlackouts) {
        if (!blackout.timeSlot) {
          // Full-day blackout
          for (const key of Object.keys(slots) as Array<keyof typeof slots>) {
            slots[key] = {
              available: false,
              reason: `Blacked out: ${blackout.reason || "No reason"}`,
            };
          }
        } else {
          const slotKey = blackout.timeSlot as keyof typeof slots;
          if (slots[slotKey]) {
            slots[slotKey] = {
              available: false,
              reason: `Blacked out: ${blackout.reason || "No reason"}`,
            };
          }
        }
      }

      // Check existing bookings
      for (const booking of venueBookings) {
        const conflictMsg = `Booked: ${booking.bookingNumber} - ${booking.eventName}`;

        if (booking.timeSlot === "FULL_DAY") {
          for (const key of Object.keys(slots) as Array<keyof typeof slots>) {
            slots[key] = { available: false, reason: conflictMsg };
          }
        } else {
          const slotKey = booking.timeSlot as keyof typeof slots;
          if (slots[slotKey]) {
            slots[slotKey] = { available: false, reason: conflictMsg };
          }
          // A specific slot booking also blocks FULL_DAY
          slots.FULL_DAY = { available: false, reason: conflictMsg };
        }
      }

      return {
        venueId: venue.id,
        venueName: venue.name,
        capacity: venue.capacity,
        isActive: venue.isActive,
        slots,
        bookings: venueBookings,
      };
    });

    return { success: true as const, data: serialize(schedule) };
  } catch (error) {
    console.error("[GET_COORDINATED_SCHEDULE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch coordinated schedule" };
  }
}

// ============================================================
// Get Multi-Venue Bookings
// ============================================================
// Returns all bookings that have a venueGroupId (multi-venue events).

export async function getMultiVenueBookings() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "multi-venue:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        venueGroupId: { not: null },
      },
      include: {
        venue: { select: { id: true, name: true } },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    // Group bookings by venueGroupId
    const grouped = bookings.reduce<Record<string, typeof bookings>>(
      (acc, booking) => {
        const groupId = booking.venueGroupId!;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(booking);
        return acc;
      },
      {}
    );

    // Convert to array with group metadata
    const multiVenueEvents = Object.entries(grouped).map(([groupId, groupBookings]) => ({
      venueGroupId: groupId,
      bookingCount: groupBookings.length,
      eventName: groupBookings[0]?.eventName || "Untitled Event",
      date: groupBookings[0]?.date,
      status: groupBookings[0]?.status,
      venues: groupBookings.map((b) => ({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        venue: b.venue,
        timeSlot: b.timeSlot,
        status: b.status,
      })),
      contact: groupBookings[0]?.contact,
      createdBy: groupBookings[0]?.createdBy,
    }));

    return { success: true as const, data: serialize(multiVenueEvents) };
  } catch (error) {
    console.error("[GET_MULTI_VENUE_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch multi-venue bookings" };
  }
}
