"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  rentalItemSchema,
  rentItemSchema,
  type RentalItemInput,
  type RentItemInput,
} from "@/schemas/rental.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Get Rental Items (Paginated + Filtered)
// ============================================================

export async function getRentalItems(params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
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
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.category) {
      where.category = params.category;
    }

    const [items, total] = await Promise.all([
      prisma.rentalItem.findMany({
        where,
        include: {
          _count: {
            select: { rentals: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.rentalItem.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(items),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_RENTAL_ITEMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch rental items" };
  }
}

// ============================================================
// Get Single Rental Item (with rental history)
// ============================================================

export async function getRentalItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const item = await prisma.rentalItem.findUnique({
      where: { id },
      include: {
        rentals: {
          orderBy: { createdAt: "desc" },
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

    if (!item) {
      return { success: false as const, error: "Rental item not found" };
    }

    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[GET_RENTAL_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch rental item" };
  }
}

// ============================================================
// Create Rental Item
// ============================================================

export async function createRentalItem(data: RentalItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = rentalItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const itemData = parsed.data;

    if (itemData.availableQty > itemData.quantity) {
      return {
        success: false as const,
        error: "Available quantity cannot exceed total quantity",
      };
    }

    const item = await prisma.rentalItem.create({
      data: {
        name: itemData.name,
        category: itemData.category,
        description: itemData.description || null,
        dailyRate: itemData.dailyRate,
        weeklyRate: itemData.weeklyRate ?? null,
        quantity: itemData.quantity,
        availableQty: itemData.availableQty,
        condition: itemData.condition || null,
        imageUrl: itemData.imageUrl || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "RentalItem",
      entityId: item.id,
    });

    revalidatePath("/rentals");
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[CREATE_RENTAL_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to create rental item" };
  }
}

// ============================================================
// Update Rental Item
// ============================================================

export async function updateRentalItem(id: string, data: RentalItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = rentalItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.rentalItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Rental item not found" };
    }

    const itemData = parsed.data;

    if (itemData.availableQty > itemData.quantity) {
      return {
        success: false as const,
        error: "Available quantity cannot exceed total quantity",
      };
    }

    const item = await prisma.rentalItem.update({
      where: { id },
      data: {
        name: itemData.name,
        category: itemData.category,
        description: itemData.description || null,
        dailyRate: itemData.dailyRate,
        weeklyRate: itemData.weeklyRate ?? null,
        quantity: itemData.quantity,
        availableQty: itemData.availableQty,
        condition: itemData.condition || null,
        imageUrl: itemData.imageUrl || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "RentalItem",
      entityId: item.id,
    });

    revalidatePath("/rentals");
    revalidatePath(`/rentals/${id}`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_RENTAL_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to update rental item" };
  }
}

// ============================================================
// Delete Rental Item
// ============================================================

export async function deleteRentalItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.rentalItem.findUnique({
      where: { id },
      include: {
        _count: { select: { rentals: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Rental item not found" };
    }

    if (existing._count.rentals > 0) {
      return {
        success: false as const,
        error: "Cannot delete rental item with existing bookings",
      };
    }

    await prisma.rentalItem.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "RentalItem",
      entityId: id,
    });

    revalidatePath("/rentals");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_RENTAL_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to delete rental item" };
  }
}

// ============================================================
// Rent Item (Create a RentalBooking)
// ============================================================

export async function rentItem(data: RentItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = rentItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const rentData = parsed.data;

    if (rentData.endDate <= rentData.startDate) {
      return {
        success: false as const,
        error: "End date must be after start date",
      };
    }

    // Fetch the rental item
    const rentalItem = await prisma.rentalItem.findUnique({
      where: { id: rentData.rentalItemId },
    });

    if (!rentalItem) {
      return { success: false as const, error: "Rental item not found" };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: rentData.bookingId },
      select: { id: true, bookingNumber: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check availability
    if (rentalItem.availableQty < rentData.quantity) {
      return {
        success: false as const,
        error: `Only ${rentalItem.availableQty} units available. Requested ${rentData.quantity}.`,
      };
    }

    // Calculate cost
    const days = Math.ceil(
      (rentData.endDate.getTime() - rentData.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const dailyRate = Number(rentalItem.dailyRate);
    const weeklyRate = rentalItem.weeklyRate
      ? Number(rentalItem.weeklyRate)
      : null;

    let totalAmount: number;
    if (weeklyRate && days >= 7) {
      const fullWeeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      totalAmount =
        (fullWeeks * weeklyRate + remainingDays * dailyRate) * rentData.quantity;
    } else {
      totalAmount = days * dailyRate * rentData.quantity;
    }

    // Create rental booking and decrease available qty in a transaction
    const [rentalBooking] = await prisma.$transaction([
      prisma.rentalBooking.create({
        data: {
          rentalItemId: rentData.rentalItemId,
          bookingId: rentData.bookingId,
          quantity: rentData.quantity,
          startDate: rentData.startDate,
          endDate: rentData.endDate,
          dailyRate: dailyRate,
          totalAmount: totalAmount,
          status: "RESERVED",
        },
        include: {
          rentalItem: { select: { id: true, name: true } },
          booking: {
            select: { id: true, bookingNumber: true, eventName: true },
          },
        },
      }),
      prisma.rentalItem.update({
        where: { id: rentData.rentalItemId },
        data: { availableQty: { decrement: rentData.quantity } },
      }),
    ]);

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "RentalBooking",
      entityId: rentalBooking.id,
      changes: {
        rentalItemId: rentData.rentalItemId,
        bookingId: rentData.bookingId,
        quantity: rentData.quantity,
        totalAmount,
      },
    });

    revalidatePath("/rentals");
    revalidatePath(`/rentals/${rentData.rentalItemId}`);
    revalidatePath(`/bookings/${rentData.bookingId}`);
    return { success: true as const, data: serialize(rentalBooking) };
  } catch (error) {
    console.error("[RENT_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to create rental booking" };
  }
}

// ============================================================
// Return Item (Update RentalBooking status to RETURNED)
// ============================================================

export async function returnItem(rentalBookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.rentalBooking.findUnique({
      where: { id: rentalBookingId },
      include: {
        rentalItem: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Rental booking not found" };
    }

    if (existing.status === "RETURNED") {
      return {
        success: false as const,
        error: "This rental has already been returned",
      };
    }

    // Update status and increase available qty in a transaction
    const [rentalBooking] = await prisma.$transaction([
      prisma.rentalBooking.update({
        where: { id: rentalBookingId },
        data: { status: "RETURNED" },
      }),
      prisma.rentalItem.update({
        where: { id: existing.rentalItemId },
        data: { availableQty: { increment: existing.quantity } },
      }),
    ]);

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "RentalBooking",
      entityId: rentalBookingId,
      changes: { status: "RETURNED" },
    });

    revalidatePath("/rentals");
    revalidatePath(`/rentals/${existing.rentalItemId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    return { success: true as const, data: serialize(rentalBooking) };
  } catch (error) {
    console.error("[RETURN_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to return rental item" };
  }
}

// ============================================================
// Get Availability
// ============================================================

export async function getAvailability(
  rentalItemId: string,
  startDate: Date | string,
  endDate: Date | string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const item = await prisma.rentalItem.findUnique({
      where: { id: rentalItemId },
      select: { id: true, name: true, quantity: true, availableQty: true },
    });

    if (!item) {
      return { success: false as const, error: "Rental item not found" };
    }

    // Find overlapping active bookings
    const start = new Date(startDate);
    const end = new Date(endDate);

    const overlappingBookings = await prisma.rentalBooking.findMany({
      where: {
        rentalItemId,
        status: { in: ["RESERVED", "RENTED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        quantity: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    const bookedQty = overlappingBookings.reduce(
      (sum, b) => sum + b.quantity,
      0
    );
    const availableQty = item.quantity - bookedQty;

    return {
      success: true as const,
      data: serialize({
        rentalItemId,
        name: item.name,
        totalQty: item.quantity,
        currentAvailable: item.availableQty,
        availableForPeriod: Math.max(0, availableQty),
        overlappingBookings: overlappingBookings.length,
      }),
    };
  } catch (error) {
    console.error("[GET_AVAILABILITY_ERROR]", error);
    return { success: false as const, error: "Failed to check availability" };
  }
}

// ============================================================
// Calculate Rental Cost
// ============================================================

export async function calculateRentalCost(
  rentalItemId: string,
  quantity: number,
  startDate: Date | string,
  endDate: Date | string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const item = await prisma.rentalItem.findUnique({
      where: { id: rentalItemId },
      select: {
        id: true,
        name: true,
        dailyRate: true,
        weeklyRate: true,
      },
    });

    if (!item) {
      return { success: false as const, error: "Rental item not found" };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days <= 0) {
      return {
        success: false as const,
        error: "End date must be after start date",
      };
    }

    const dailyRate = Number(item.dailyRate);
    const weeklyRate = item.weeklyRate ? Number(item.weeklyRate) : null;

    let totalAmount: number;
    let breakdown: string;

    if (weeklyRate && days >= 7) {
      const fullWeeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      totalAmount =
        (fullWeeks * weeklyRate + remainingDays * dailyRate) * quantity;
      breakdown = `${fullWeeks} week(s) + ${remainingDays} day(s) x ${quantity} unit(s)`;
    } else {
      totalAmount = days * dailyRate * quantity;
      breakdown = `${days} day(s) x ${quantity} unit(s)`;
    }

    return {
      success: true as const,
      data: serialize({
        rentalItemId,
        name: item.name,
        days,
        quantity,
        dailyRate,
        weeklyRate,
        totalAmount,
        breakdown,
      }),
    };
  } catch (error) {
    console.error("[CALCULATE_RENTAL_COST_ERROR]", error);
    return { success: false as const, error: "Failed to calculate rental cost" };
  }
}
