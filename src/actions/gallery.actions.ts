"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  galleryItemSchema,
  updateGalleryItemSchema,
  type GalleryItemInput,
  type UpdateGalleryItemInput,
} from "@/schemas/gallery.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Gallery Items (Paginated + Filtered)
// ============================================================

export async function getGalleryItems(params?: {
  search?: string;
  mediaType?: string;
  bookingId?: string;
  venueId?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "gallery:read")) {
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
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    if (params?.mediaType) {
      where.mediaType = params.mediaType;
    }

    if (params?.bookingId) {
      where.bookingId = params.bookingId;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.isPublic !== undefined) {
      where.isPublic = params.isPublic;
    }

    const [items, total] = await Promise.all([
      prisma.galleryItem.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.galleryItem.count({ where }),
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
    console.error("[GET_GALLERY_ITEMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch gallery items" };
  }
}

// ============================================================
// Get Single Gallery Item
// ============================================================

export async function getGalleryItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "gallery:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const item = await prisma.galleryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return { success: false as const, error: "Gallery item not found" };
    }

    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[GET_GALLERY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch gallery item" };
  }
}

// ============================================================
// Create Gallery Item
// ============================================================

export async function createGalleryItem(data: GalleryItemInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "gallery:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = galleryItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const itemData = parsed.data;

    const item = await prisma.galleryItem.create({
      data: {
        title: itemData.title || null,
        description: itemData.description || null,
        mediaType: itemData.mediaType ?? "PHOTO",
        url: itemData.url,
        thumbnailUrl: itemData.thumbnailUrl || null,
        tags: itemData.tags ?? [],
        isPublic: itemData.isPublic ?? false,
        order: itemData.order ?? 0,
        bookingId: itemData.bookingId || null,
        venueId: itemData.venueId || null,
        uploadedById: session.user.id as string,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "GalleryItem",
      entityId: item.id,
    });

    revalidatePath("/gallery");
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[CREATE_GALLERY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to create gallery item" };
  }
}

// ============================================================
// Update Gallery Item
// ============================================================

export async function updateGalleryItem(
  id: string,
  data: UpdateGalleryItemInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "gallery:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateGalleryItemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.galleryItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Gallery item not found" };
    }

    const updateData = parsed.data;

    const item = await prisma.galleryItem.update({
      where: { id },
      data: {
        ...(updateData.title !== undefined && {
          title: updateData.title || null,
        }),
        ...(updateData.description !== undefined && {
          description: updateData.description || null,
        }),
        ...(updateData.mediaType !== undefined && {
          mediaType: updateData.mediaType,
        }),
        ...(updateData.url !== undefined && { url: updateData.url }),
        ...(updateData.thumbnailUrl !== undefined && {
          thumbnailUrl: updateData.thumbnailUrl || null,
        }),
        ...(updateData.tags !== undefined && { tags: updateData.tags }),
        ...(updateData.isPublic !== undefined && {
          isPublic: updateData.isPublic,
        }),
        ...(updateData.order !== undefined && { order: updateData.order }),
        ...(updateData.bookingId !== undefined && {
          bookingId: updateData.bookingId || null,
        }),
        ...(updateData.venueId !== undefined && {
          venueId: updateData.venueId || null,
        }),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "GalleryItem",
      entityId: item.id,
    });

    revalidatePath("/gallery");
    return { success: true as const, data: serialize(item) };
  } catch (error) {
    console.error("[UPDATE_GALLERY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to update gallery item" };
  }
}

// ============================================================
// Delete Gallery Item
// ============================================================

export async function deleteGalleryItem(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "gallery:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.galleryItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Gallery item not found" };
    }

    await prisma.galleryItem.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "GalleryItem",
      entityId: id,
    });

    revalidatePath("/gallery");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_GALLERY_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to delete gallery item" };
  }
}

// ============================================================
// Get Gallery Items by Booking
// ============================================================

export async function getGalleryByBooking(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const items = await prisma.galleryItem.findMany({
      where: { bookingId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return { success: true as const, data: serialize(items) };
  } catch (error) {
    console.error("[GET_GALLERY_BY_BOOKING_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch gallery items for booking",
    };
  }
}

// ============================================================
// Get Gallery Items by Venue
// ============================================================

export async function getGalleryByVenue(venueId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const items = await prisma.galleryItem.findMany({
      where: { venueId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return { success: true as const, data: serialize(items) };
  } catch (error) {
    console.error("[GET_GALLERY_BY_VENUE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch gallery items for venue",
    };
  }
}

// ============================================================
// Get Public Gallery (for portal / public display)
// ============================================================

export async function getPublicGallery(params?: {
  bookingId?: string;
  venueId?: string;
  mediaType?: string;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isPublic: true };

    if (params?.bookingId) {
      where.bookingId = params.bookingId;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.mediaType) {
      where.mediaType = params.mediaType;
    }

    const [items, total] = await Promise.all([
      prisma.galleryItem.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.galleryItem.count({ where }),
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
    console.error("[GET_PUBLIC_GALLERY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch public gallery" };
  }
}

// ============================================================
// Get Portal Gallery (client's own booking photos)
// ============================================================

export async function getPortalGallery(userId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Get bookings belonging to this client
    const bookings = await prisma.booking.findMany({
      where: { contactId: userId },
      select: { id: true, eventName: true },
    });

    const bookingIds = bookings.map((b) => b.id);

    if (bookingIds.length === 0) {
      return {
        success: true as const,
        data: { items: [], bookings: [] },
      };
    }

    // Get gallery items linked to their bookings that are public
    const items = await prisma.galleryItem.findMany({
      where: {
        bookingId: { in: bookingIds },
        isPublic: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return {
      success: true as const,
      data: {
        items: serialize(items),
        bookings: serialize(bookings),
      },
    };
  } catch (error) {
    console.error("[GET_PORTAL_GALLERY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch gallery" };
  }
}
