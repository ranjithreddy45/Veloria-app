"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  menuItemSchema,
  saveBookingMenuSchema,
  type MenuItemInput,
  type SaveBookingMenuInput,
} from "@/schemas/menu.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Get Menu Items (Filtered)
// ============================================================

export async function getMenuItems(params?: {
  search?: string;
  category?: string;
  cuisine?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 100;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { cuisine: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.cuisine) {
      where.cuisine = params.cuisine;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.menuItem.count({ where }),
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
    console.error("[GET_MENU_ITEMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch menu items" };
  }
}

// ============================================================
// Get Single Menu Item
// ============================================================

export async function getMenuItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const item = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!item) {
      return { success: false as const, error: "Menu item not found" };
    }

    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[GET_MENU_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch menu item" };
  }
}

// ============================================================
// Create Menu Item
// ============================================================

export async function createMenuItem(data: MenuItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = menuItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const itemData = parsed.data;

    const item = await prisma.menuItem.create({
      data: {
        name: itemData.name,
        description: itemData.description || null,
        category: itemData.category,
        cuisine: itemData.cuisine || null,
        dietaryTags: itemData.dietaryTags ?? [],
        pricePerHead: itemData.pricePerHead,
        imageUrl: itemData.imageUrl || null,
        isActive: itemData.isActive ?? true,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "MenuItem",
      entityId: item.id,
    });

    revalidatePath("/menu");
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[CREATE_MENU_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to create menu item" };
  }
}

// ============================================================
// Update Menu Item
// ============================================================

export async function updateMenuItem(id: string, data: MenuItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = menuItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Menu item not found" };
    }

    const itemData = parsed.data;

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        name: itemData.name,
        description: itemData.description || null,
        category: itemData.category,
        cuisine: itemData.cuisine || null,
        dietaryTags: itemData.dietaryTags ?? [],
        pricePerHead: itemData.pricePerHead,
        imageUrl: itemData.imageUrl || null,
        isActive: itemData.isActive ?? existing.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "MenuItem",
      entityId: item.id,
    });

    revalidatePath("/menu");
    revalidatePath(`/menu/${id}/edit`);
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_MENU_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to update menu item" };
  }
}

// ============================================================
// Delete Menu Item
// ============================================================

export async function deleteMenuItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        _count: { select: { menuSelections: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Menu item not found" };
    }

    if (existing._count.menuSelections > 0) {
      return {
        success: false as const,
        error: "Cannot delete menu item that is used in booking menus",
      };
    }

    await prisma.menuItem.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "MenuItem",
      entityId: id,
    });

    revalidatePath("/menu");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_MENU_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to delete menu item" };
  }
}

// ============================================================
// Get Booking Menu (with selections + menu item details)
// ============================================================

export async function getBookingMenu(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const bookingMenu = await prisma.bookingMenu.findUnique({
      where: { bookingId },
      include: {
        selections: {
          include: {
            menuItem: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!bookingMenu) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(bookingMenu) };
  } catch (error) {
    console.error("[GET_BOOKING_MENU_ERROR]", error);
    return { success: false as const, error: "Failed to fetch booking menu" };
  }
}

// ============================================================
// Save Booking Menu (Upsert with selections)
// ============================================================

export async function saveBookingMenu(
  bookingId: string,
  data: SaveBookingMenuInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = saveBookingMenuSchema.safeParse(data);
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

    const menuData = parsed.data;

    // Calculate total price
    const totalPrice = menuData.pricePerHead * menuData.guestCount;

    // Upsert BookingMenu and replace all selections
    const existingMenu = await prisma.bookingMenu.findUnique({
      where: { bookingId },
    });

    let bookingMenu;

    if (existingMenu) {
      // Delete existing selections first
      await prisma.bookingMenuSelection.deleteMany({
        where: { menuId: existingMenu.id },
      });

      // Update booking menu
      bookingMenu = await prisma.bookingMenu.update({
        where: { id: existingMenu.id },
        data: {
          guestCount: menuData.guestCount,
          pricePerHead: menuData.pricePerHead,
          totalPrice,
          specialInstructions: menuData.specialInstructions || null,
          selections: {
            create: menuData.selections.map((sel, index) => ({
              menuItemId: sel.menuItemId,
              quantity: sel.quantity,
              customPrice: sel.customPrice ?? null,
              order: index,
            })),
          },
        },
        include: {
          selections: {
            include: { menuItem: true },
            orderBy: { order: "asc" },
          },
        },
      });
    } else {
      // Create new booking menu
      bookingMenu = await prisma.bookingMenu.create({
        data: {
          bookingId,
          guestCount: menuData.guestCount,
          pricePerHead: menuData.pricePerHead,
          totalPrice,
          specialInstructions: menuData.specialInstructions || null,
          selections: {
            create: menuData.selections.map((sel, index) => ({
              menuItemId: sel.menuItemId,
              quantity: sel.quantity,
              customPrice: sel.customPrice ?? null,
              order: index,
            })),
          },
        },
        include: {
          selections: {
            include: { menuItem: true },
            orderBy: { order: "asc" },
          },
        },
      });
    }

    await logActivity({
      userId: session.user.id as string,
      action: existingMenu ? "updated" : "created",
      entityType: "BookingMenu",
      entityId: bookingMenu.id,
      changes: {
        bookingId,
        guestCount: menuData.guestCount,
        totalPrice,
        selectionCount: menuData.selections.length,
      },
    });

    revalidatePath(`/bookings/${bookingId}/menu`);
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true as const, data: serialize(bookingMenu) };
  } catch (error) {
    console.error("[SAVE_BOOKING_MENU_ERROR]", error);
    return { success: false as const, error: "Failed to save booking menu" };
  }
}

// ============================================================
// Calculate Menu Total
// ============================================================

export async function calculateMenuTotal(
  selections: { menuItemId: string; quantity: number; customPrice?: number }[]
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!selections || selections.length === 0) {
      return {
        success: true as const,
        data: { totalPricePerHead: 0, items: [] },
      };
    }

    const menuItemIds = selections.map((s) => s.menuItemId);

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, pricePerHead: true },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    let totalPricePerHead = 0;
    const items: {
      menuItemId: string;
      name: string;
      quantity: number;
      pricePerHead: number;
      subtotal: number;
    }[] = [];

    for (const sel of selections) {
      const item = menuItemMap.get(sel.menuItemId);
      if (!item) continue;

      const price = sel.customPrice ?? Number(item.pricePerHead);
      const subtotal = price * sel.quantity;
      totalPricePerHead += subtotal;

      items.push({
        menuItemId: sel.menuItemId,
        name: item.name,
        quantity: sel.quantity,
        pricePerHead: price,
        subtotal,
      });
    }

    return {
      success: true as const,
      data: serialize({ totalPricePerHead, items }),
    };
  } catch (error) {
    console.error("[CALCULATE_MENU_TOTAL_ERROR]", error);
    return { success: false as const, error: "Failed to calculate menu total" };
  }
}
