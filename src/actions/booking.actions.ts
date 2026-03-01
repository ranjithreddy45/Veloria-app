"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { bookingSchema, type BookingInput } from "@/schemas/booking.schema";
import type { BookingStatus, TimeSlot } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { bookingConfirmationEmail } from "@/lib/email-templates/booking-confirmation";
import { format } from "date-fns";

// ============================================================
// Helper: Generate Booking Number (VG-YYYY-NNNN)
// ============================================================

async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VG-${year}-`;

  const lastBooking = await prisma.booking.findFirst({
    where: { bookingNumber: { startsWith: prefix } },
    orderBy: { bookingNumber: "desc" },
    select: { bookingNumber: true },
  });

  let nextNumber = 1;
  if (lastBooking) {
    const lastNum = parseInt(lastBooking.bookingNumber.split("-").pop() || "0", 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// formatINR is in @/lib/utils

// ============================================================
// Get Bookings (Paginated + Filtered)
// ============================================================

export async function getBookings(params?: {
  search?: string;
  status?: BookingStatus;
  venueId?: string;
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
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
        { bookingNumber: { contains: search, mode: "insensitive" } },
        { eventName: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.month && params?.year) {
      const startDate = new Date(params.year, params.month - 1, 1);
      const endDate = new Date(params.year, params.month, 0);
      where.date = { gte: startDate, lte: endDate };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(bookings),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}

// ============================================================
// Get Single Booking
// ============================================================

export async function getBooking(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        venue: true,
        contact: true,
        createdBy: { select: { id: true, name: true, email: true } },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            balanceDue: true,
            issueDate: true,
            dueDate: true,
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[GET_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to fetch booking" };
  }
}

// ============================================================
// Check Availability
// ============================================================

export async function checkAvailability(
  venueId: string,
  date: Date,
  timeSlot: TimeSlot
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Normalize date to start of day for consistent comparison
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    // Check for existing booking
    const existingBooking = await prisma.booking.findFirst({
      where: {
        venueId,
        date: bookingDate,
        status: { notIn: ["CANCELLED"] },
        OR: [
          { timeSlot },
          // FULL_DAY conflicts with everything
          { timeSlot: "FULL_DAY" },
          // Any slot conflicts with FULL_DAY
          ...(timeSlot === "FULL_DAY"
            ? [
                { timeSlot: "MORNING" as TimeSlot },
                { timeSlot: "AFTERNOON" as TimeSlot },
                { timeSlot: "EVENING" as TimeSlot },
              ]
            : []),
        ],
      },
      select: { id: true, bookingNumber: true, eventName: true, timeSlot: true },
    });

    // Check for blackout dates
    const blackout = await prisma.blackoutDate.findFirst({
      where: {
        venueId,
        date: bookingDate,
        OR: [
          { timeSlot: null }, // Full day blackout
          { timeSlot }, // Specific slot blackout
          ...(timeSlot === "FULL_DAY"
            ? [
                { timeSlot: "MORNING" as TimeSlot },
                { timeSlot: "AFTERNOON" as TimeSlot },
                { timeSlot: "EVENING" as TimeSlot },
              ]
            : []),
        ],
      },
    });

    if (blackout) {
      return {
        success: true as const,
        data: {
          available: false,
          reason: `Venue is blacked out: ${blackout.reason || "No reason specified"}`,
        },
      };
    }

    if (existingBooking) {
      return {
        success: true as const,
        data: {
          available: false,
          reason: `Slot taken by ${existingBooking.bookingNumber} - ${existingBooking.eventName}`,
        },
      };
    }

    return {
      success: true as const,
      data: { available: true, reason: null },
    };
  } catch (error) {
    console.error("[CHECK_AVAILABILITY_ERROR]", error);
    return { success: false as const, error: "Failed to check availability" };
  }
}

// ============================================================
// Create Booking
// ============================================================

export async function createBooking(data: BookingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const bookingData = parsed.data;

    // Check availability
    const availability = await checkAvailability(
      bookingData.venueId,
      bookingData.date,
      bookingData.timeSlot as TimeSlot
    );

    if (availability.success && availability.data && !availability.data.available) {
      return {
        success: false as const,
        error: availability.data.reason || "Slot is not available",
      };
    }

    const bookingNumber = await generateBookingNumber();

    const bookingDate = new Date(bookingData.date);
    bookingDate.setHours(0, 0, 0, 0);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        eventName: bookingData.eventName,
        eventType: bookingData.eventType,
        date: bookingDate,
        timeSlot: bookingData.timeSlot as TimeSlot,
        guestCount: bookingData.guestCount,
        totalAmount: bookingData.totalAmount,
        specialRequests: bookingData.specialRequests || null,
        internalNotes: bookingData.internalNotes || null,
        venueId: bookingData.venueId,
        contactId: bookingData.contactId,
        createdById: session.user.id,
        status: "HOLD",
      },
      include: {
        venue: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Booking",
      entityId: booking.id,
    });

    // Fire-and-forget: Notify user
    notify({
      userId: session.user.id as string,
      type: "BOOKING_CREATED",
      title: "Booking Created",
      message: `Booking ${booking.bookingNumber} for ${booking.contact.firstName} ${booking.contact.lastName} has been created.`,
      actionUrl: `/bookings/${booking.id}`,
    });

    // Fire-and-forget: Send booking confirmation email
    if (booking.contact) {
      const contactEmail = await prisma.contact.findUnique({
        where: { id: bookingData.contactId },
        select: { email: true },
      });

      if (contactEmail?.email) {
        const venueForEmail = await prisma.venue.findUnique({
          where: { id: bookingData.venueId },
          select: { name: true },
        });

        sendEmail({
          to: contactEmail.email,
          subject: `Booking Confirmed — ${booking.bookingNumber}`,
          html: bookingConfirmationEmail({
            contactName: `${booking.contact.firstName} ${booking.contact.lastName}`,
            bookingNumber: booking.bookingNumber,
            eventName: bookingData.eventName,
            eventType: bookingData.eventType,
            date: format(bookingDate, "dd MMM yyyy"),
            timeSlot: bookingData.timeSlot,
            venueName: venueForEmail?.name || "Venue",
            guestCount: bookingData.guestCount,
            totalAmount: formatINR(bookingData.totalAmount),
            specialRequests: bookingData.specialRequests,
          }),
        }).catch((err) => console.error("[BOOKING_EMAIL_ERROR]", err));
      }
    }

    revalidatePath("/bookings");
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[CREATE_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to create booking" };
  }
}

// ============================================================
// Update Booking
// ============================================================

export async function updateBooking(id: string, data: BookingInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    const bookingData = parsed.data;
    const bookingDate = new Date(bookingData.date);
    bookingDate.setHours(0, 0, 0, 0);

    // Re-check availability if venue, date, or slot changed
    const dateChanged =
      existing.date.getTime() !== bookingDate.getTime() ||
      existing.venueId !== bookingData.venueId ||
      existing.timeSlot !== bookingData.timeSlot;

    if (dateChanged) {
      // Check for conflicts excluding the current booking
      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          venueId: bookingData.venueId,
          date: bookingDate,
          status: { notIn: ["CANCELLED"] },
          OR: [
            { timeSlot: bookingData.timeSlot as TimeSlot },
            { timeSlot: "FULL_DAY" },
            ...(bookingData.timeSlot === "FULL_DAY"
              ? [
                  { timeSlot: "MORNING" as TimeSlot },
                  { timeSlot: "AFTERNOON" as TimeSlot },
                  { timeSlot: "EVENING" as TimeSlot },
                ]
              : []),
          ],
        },
      });

      if (conflict) {
        return {
          success: false as const,
          error: "The selected venue, date, and time slot is no longer available",
        };
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        eventName: bookingData.eventName,
        eventType: bookingData.eventType,
        date: bookingDate,
        timeSlot: bookingData.timeSlot as TimeSlot,
        guestCount: bookingData.guestCount,
        totalAmount: bookingData.totalAmount,
        specialRequests: bookingData.specialRequests || null,
        internalNotes: bookingData.internalNotes || null,
        venueId: bookingData.venueId,
        contactId: bookingData.contactId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Booking",
      entityId: booking.id,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[UPDATE_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to update booking" };
  }
}

// ============================================================
// Cancel Booking
// ============================================================

export async function cancelBooking(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    if (existing.status === "CANCELLED") {
      return { success: false as const, error: "Booking is already cancelled" };
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        internalNotes: reason
          ? `${existing.internalNotes ? existing.internalNotes + "\n" : ""}Cancellation reason: ${reason}`
          : existing.internalNotes,
      },
    });

    notify({
      userId: session.user.id as string,
      type: "BOOKING_CANCELLED",
      title: "Booking Cancelled",
      message: `Booking ${existing.bookingNumber} has been cancelled.`,
      actionUrl: `/bookings/${id}`,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[CANCEL_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to cancel booking" };
  }
}

// ============================================================
// Place Hold
// ============================================================

export async function placeHold(bookingId: string, expiresInHours: number = 48) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    const holdExpiresAt = new Date();
    holdExpiresAt.setHours(holdExpiresAt.getHours() + expiresInHours);

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "HOLD",
        holdExpiresAt,
      },
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[PLACE_HOLD_ERROR]", error);
    return { success: false as const, error: "Failed to place hold" };
  }
}

// ============================================================
// Release Hold
// ============================================================

export async function releaseHold(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        holdExpiresAt: null,
      },
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[RELEASE_HOLD_ERROR]", error);
    return { success: false as const, error: "Failed to release hold" };
  }
}

// ============================================================
// Get Bookings for Calendar
// ============================================================

export async function getBookingsForCalendar(month: number, year: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        status: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        venue: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_BOOKINGS_CALENDAR_ERROR]", error);
    return { success: false as const, error: "Failed to fetch calendar bookings" };
  }
}

// ============================================================
// Venue CRUD
// ============================================================

export async function getVenues() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venues = await prisma.venue.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { bookings: true } },
      },
    });

    return { success: true as const, data: serialize(venues) };
  } catch (error) {
    console.error("[GET_VENUES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venues" };
  }
}

export async function createVenue(data: {
  name: string;
  description?: string;
  capacity: number;
  pricePerSlot: number;
  amenities?: string[];
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venue = await prisma.venue.create({
      data: {
        name: data.name,
        description: data.description || null,
        capacity: data.capacity,
        pricePerSlot: data.pricePerSlot,
        amenities: data.amenities || [],
      },
    });

    revalidatePath("/settings/venues");
    revalidatePath("/bookings/new");
    return { success: true as const, data: serialize(venue) };
  } catch (error) {
    console.error("[CREATE_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to create venue" };
  }
}

export async function updateVenue(
  id: string,
  data: {
    name?: string;
    description?: string;
    capacity?: number;
    pricePerSlot?: number;
    amenities?: string[];
    isActive?: boolean;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.pricePerSlot !== undefined && {
          pricePerSlot: data.pricePerSlot,
        }),
        ...(data.amenities !== undefined && { amenities: data.amenities }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath("/settings/venues");
    return { success: true as const, data: serialize(venue) };
  } catch (error) {
    console.error("[UPDATE_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to update venue" };
  }
}

// ============================================================
// Blackout Date CRUD
// ============================================================

export async function getBlackoutDates(params?: {
  venueId?: string;
  month?: number;
  year?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.month && params?.year) {
      const startDate = new Date(params.year, params.month - 1, 1);
      const endDate = new Date(params.year, params.month, 0);
      where.date = { gte: startDate, lte: endDate };
    }

    const blackoutDates = await prisma.blackoutDate.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    return { success: true as const, data: serialize(blackoutDates) };
  } catch (error) {
    console.error("[GET_BLACKOUT_DATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch blackout dates" };
  }
}

export async function createBlackoutDate(data: {
  venueId: string;
  date: Date;
  timeSlot?: TimeSlot | null;
  reason?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const blackoutDate = new Date(data.date);
    blackoutDate.setHours(0, 0, 0, 0);

    const blackout = await prisma.blackoutDate.create({
      data: {
        venueId: data.venueId,
        date: blackoutDate,
        timeSlot: data.timeSlot || null,
        reason: data.reason || null,
      },
    });

    revalidatePath("/bookings/calendar");
    revalidatePath("/settings/venues");
    return { success: true as const, data: serialize(blackout) };
  } catch (error) {
    console.error("[CREATE_BLACKOUT_DATE_ERROR]", error);
    return { success: false as const, error: "Failed to create blackout date" };
  }
}

export async function deleteBlackoutDate(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.blackoutDate.delete({ where: { id } });

    revalidatePath("/bookings/calendar");
    revalidatePath("/settings/venues");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_BLACKOUT_DATE_ERROR]", error);
    return { success: false as const, error: "Failed to delete blackout date" };
  }
}
