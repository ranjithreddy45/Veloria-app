"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  inventoryItemSchema,
  inventoryReservationSchema,
  releaseReservationSchema,
  type InventoryItemInput,
  type InventoryReservationInput,
  type ReleaseReservationInput,
} from "@/schemas/inventory.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Inventory Items (Paginated + Filtered)
// ============================================================

export async function getItems(params?: {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:read")) {
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
        { sku: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.category) {
      where.category = params.category;
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          _count: {
            select: { reservations: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    // If lowStockOnly, filter in memory after fetch
    const filtered = params?.lowStockOnly
      ? items.filter((item) => item.availableQty <= item.reorderLevel)
      : items;

    return {
      success: true as const,
      data: {
        data: serialize(filtered),
        total: params?.lowStockOnly ? filtered.length : total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_INVENTORY_ITEMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch inventory items" };
  }
}

// ============================================================
// Get Single Inventory Item
// ============================================================

export async function getItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        reservations: {
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
      return { success: false as const, error: "Item not found" };
    }

    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[GET_INVENTORY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch inventory item" };
  }
}

// ============================================================
// Create Inventory Item
// ============================================================

export async function createItem(data: InventoryItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = inventoryItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const itemData = parsed.data;

    // Check SKU uniqueness if provided
    if (itemData.sku) {
      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: itemData.sku },
      });
      if (existingSku) {
        return {
          success: false as const,
          error: "An item with this SKU already exists",
        };
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name: itemData.name,
        sku: itemData.sku || null,
        category: itemData.category,
        description: itemData.description || null,
        totalQuantity: itemData.totalQuantity,
        availableQty: itemData.availableQty,
        reorderLevel: itemData.reorderLevel ?? 5,
        unitCost: itemData.unitCost ?? null,
        location: itemData.location || null,
        isActive: itemData.isActive ?? true,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "InventoryItem",
      entityId: item.id,
    });

    revalidatePath("/inventory");
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[CREATE_INVENTORY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to create inventory item" };
  }
}

// ============================================================
// Update Inventory Item
// ============================================================

export async function updateItem(id: string, data: InventoryItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = inventoryItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Item not found" };
    }

    const itemData = parsed.data;

    // Check SKU uniqueness if changed
    if (itemData.sku && itemData.sku !== existing.sku) {
      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: itemData.sku },
      });
      if (existingSku) {
        return {
          success: false as const,
          error: "An item with this SKU already exists",
        };
      }
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: itemData.name,
        sku: itemData.sku || null,
        category: itemData.category,
        description: itemData.description || null,
        totalQuantity: itemData.totalQuantity,
        availableQty: itemData.availableQty,
        reorderLevel: itemData.reorderLevel ?? existing.reorderLevel,
        unitCost: itemData.unitCost ?? null,
        location: itemData.location || null,
        isActive: itemData.isActive ?? existing.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "InventoryItem",
      entityId: item.id,
    });

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_INVENTORY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to update inventory item" };
  }
}

// ============================================================
// Delete Inventory Item
// ============================================================

export async function deleteItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: { select: { reservations: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Item not found" };
    }

    // Check for active reservations (RESERVED or IN_USE)
    const activeReservations = await prisma.inventoryReservation.count({
      where: {
        itemId: id,
        status: { in: ["RESERVED", "IN_USE"] },
      },
    });

    if (activeReservations > 0) {
      return {
        success: false as const,
        error: "Cannot delete item with active reservations",
      };
    }

    await prisma.inventoryItem.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "InventoryItem",
      entityId: id,
    });

    revalidatePath("/inventory");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_INVENTORY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to delete inventory item" };
  }
}

// ============================================================
// Reserve for Booking
// ============================================================

export async function reserveForBooking(data: InventoryReservationInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = inventoryReservationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const resData = parsed.data;

    // Verify item exists (pre-flight for a clear error message)
    const item = await prisma.inventoryItem.findUnique({
      where: { id: resData.itemId },
      select: { id: true, availableQty: true },
    });

    if (!item) {
      return { success: false as const, error: "Inventory item not found" };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: resData.bookingId },
      select: { id: true, bookingNumber: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Create reservation and decrement available qty atomically.
    // The stock check is performed INSIDE the transaction via a conditional
    // update (WHERE availableQty >= quantity) so that two concurrent
    // reservations cannot both pass a stale pre-check and drive availableQty
    // negative. If the conditional update matches 0 rows, stock ran out
    // between the pre-flight read and the write, so we roll back.
    let insufficientStock = false;
    const reservation = await prisma.$transaction(async (tx) => {
      const stockUpdate = await tx.inventoryItem.updateMany({
        where: {
          id: resData.itemId,
          availableQty: { gte: resData.quantity },
        },
        data: {
          availableQty: { decrement: resData.quantity },
        },
      });

      if (stockUpdate.count === 0) {
        insufficientStock = true;
        // Abort the transaction; nothing has been written yet.
        throw new Error("INSUFFICIENT_STOCK");
      }

      return tx.inventoryReservation.create({
        data: {
          quantity: resData.quantity,
          date: resData.date,
          returnDate: resData.returnDate ?? null,
          status: resData.status ?? "RESERVED",
          notes: resData.notes || null,
          itemId: resData.itemId,
          bookingId: resData.bookingId,
        },
        include: {
          item: { select: { id: true, name: true } },
          booking: { select: { id: true, bookingNumber: true, eventName: true } },
        },
      });
    }).catch((err: unknown) => {
      if (insufficientStock) return null;
      throw err;
    });

    if (!reservation) {
      return {
        success: false as const,
        error: `Insufficient stock. Available: ${item.availableQty}, Requested: ${resData.quantity}`,
      };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "InventoryReservation",
      entityId: reservation.id,
      changes: {
        itemId: resData.itemId,
        bookingId: resData.bookingId,
        quantity: resData.quantity,
      },
    });

    revalidatePath(`/inventory/${resData.itemId}`);
    revalidatePath(`/bookings/${resData.bookingId}`);
    revalidatePath("/inventory");
    return { success: true as const, data: serialize(reservation) };
  } catch (error) {
    console.error("[RESERVE_FOR_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to create reservation" };
  }
}

// ============================================================
// Release Reservation (Return or Mark Damaged)
// ============================================================

export async function releaseReservation(
  reservationId: string,
  data: ReleaseReservationInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = releaseReservationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const releaseData = parsed.data;

    const existing = await prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!existing) {
      return { success: false as const, error: "Reservation not found" };
    }

    if (existing.status === "RETURNED" || existing.status === "DAMAGED") {
      return {
        success: false as const,
        error: "Reservation has already been released",
      };
    }

    // Update reservation status and adjust stock in a transaction.
    //
    // Business logic:
    //  - RETURNED: items come back into circulation, so restore them to
    //    availableQty.
    //  - DAMAGED: items are lost and must NOT re-enter available stock.
    //    Write them off by reducing totalQuantity instead. availableQty is
    //    left untouched (it was already decremented when reserved), keeping
    //    the invariant availableQty <= totalQuantity intact.
    const itemAdjustment =
      releaseData.status === "RETURNED"
        ? { availableQty: { increment: existing.quantity } }
        : { totalQuantity: { decrement: existing.quantity } };

    const [reservation] = await prisma.$transaction([
      prisma.inventoryReservation.update({
        where: { id: reservationId },
        data: {
          status: releaseData.status,
          notes: releaseData.notes || existing.notes,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: existing.itemId },
        data: itemAdjustment,
      }),
    ]);

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "InventoryReservation",
      entityId: reservationId,
      changes: { status: releaseData.status },
    });

    revalidatePath(`/inventory/${existing.itemId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    revalidatePath("/inventory");
    return { success: true as const, data: serialize(reservation) };
  } catch (error) {
    console.error("[RELEASE_RESERVATION_ERROR]", error);
    return { success: false as const, error: "Failed to release reservation" };
  }
}

// ============================================================
// Get Availability for a Date Range
// ============================================================

export async function getAvailability(
  itemId: string,
  date: Date,
  returnDate?: Date
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { success: false as const, error: "Item not found" };
    }

    // Find active reservations that overlap with the requested date range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlapWhere: any = {
      itemId,
      status: { in: ["RESERVED", "IN_USE"] },
      date: { lte: returnDate ?? date },
    };

    if (returnDate) {
      overlapWhere.OR = [
        { returnDate: null },
        { returnDate: { gte: date } },
      ];
    }

    const overlappingReservations = await prisma.inventoryReservation.findMany({
      where: overlapWhere,
    });

    const reservedQty = overlappingReservations.reduce(
      (sum, r) => sum + r.quantity,
      0
    );

    return {
      success: true as const,
      data: serialize({
        totalQuantity: item.totalQuantity,
        availableQty: item.availableQty,
        reservedQty,
        effectiveAvailable: item.totalQuantity - reservedQty,
      }),
    };
  } catch (error) {
    console.error("[GET_AVAILABILITY_ERROR]", error);
    return { success: false as const, error: "Failed to check availability" };
  }
}

// ============================================================
// Get Low Stock Alerts
// ============================================================

export async function getLowStockAlerts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "inventory:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        sku: string | null;
        category: string;
        totalQuantity: number;
        availableQty: number;
        reorderLevel: number;
        location: string | null;
        isActive: boolean;
      }>
    >(
      `SELECT id, name, sku, category, "totalQuantity", "availableQty", "reorderLevel", location, "isActive"
       FROM "InventoryItem"
       WHERE "availableQty" <= "reorderLevel" AND "isActive" = true
       ORDER BY ("availableQty"::float / GREATEST("reorderLevel", 1)) ASC`
    );

    return { success: true as const, data: serialize(items) };
  } catch (error) {
    console.error("[GET_LOW_STOCK_ALERTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch low stock alerts" };
  }
}
