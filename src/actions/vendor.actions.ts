"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  vendorSchema,
  assignVendorSchema,
  updateAssignmentSchema,
  vendorBidSchema,
  type VendorInput,
  type AssignVendorInput,
  type UpdateAssignmentInput,
  type VendorBidInput,
} from "@/schemas/vendor.schema";
import type { VendorCategory, VendorStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";

// ============================================================
// Get Vendors (Paginated + Filtered)
// ============================================================

export async function getVendors(params?: {
  search?: string;
  category?: VendorCategory;
  status?: VendorStatus;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
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
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.status) {
      where.status = params.status;
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          _count: {
            select: {
              bookingVendors: true,
              bids: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(vendors),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_VENDORS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendors" };
  }
}

// ============================================================
// Get Single Vendor
// ============================================================

export async function getVendor(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        bookingVendors: {
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
        bids: {
          orderBy: { submittedAt: "desc" },
          include: {
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                eventName: true,
                date: true,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return { success: false as const, error: "Vendor not found" };
    }

    return { success: true as const, data: serialize(vendor) };
  } catch (error) {
    console.error("[GET_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor" };
  }
}

// ============================================================
// Create Vendor
// ============================================================

export async function createVendor(data: VendorInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = vendorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const vendorData = parsed.data;

    const vendor = await prisma.vendor.create({
      data: {
        name: vendorData.name,
        category: vendorData.category,
        status: vendorData.status ?? "ACTIVE",
        email: vendorData.email || null,
        phone: vendorData.phone || null,
        company: vendorData.company || null,
        address: vendorData.address || null,
        gstin: vendorData.gstin || null,
        website: vendorData.website || null,
        tags: vendorData.tags ?? [],
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Vendor",
      entityId: vendor.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Vendor Created",
      message: `Vendor "${vendor.name}" has been added to the marketplace.`,
      actionUrl: `/vendors/${vendor.id}`,
    });

    revalidatePath("/vendors");
    return { success: true as const, data: serialize(vendor) };
  } catch (error) {
    console.error("[CREATE_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to create vendor" };
  }
}

// ============================================================
// Update Vendor
// ============================================================

export async function updateVendor(id: string, data: VendorInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = vendorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Vendor not found" };
    }

    const vendorData = parsed.data;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name: vendorData.name,
        category: vendorData.category,
        status: vendorData.status ?? existing.status,
        email: vendorData.email || null,
        phone: vendorData.phone || null,
        company: vendorData.company || null,
        address: vendorData.address || null,
        gstin: vendorData.gstin || null,
        website: vendorData.website || null,
        tags: vendorData.tags ?? [],
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Vendor",
      entityId: vendor.id,
    });

    revalidatePath("/vendors");
    revalidatePath(`/vendors/${id}`);
    return { success: true as const, data: serialize(vendor) };
  } catch (error) {
    console.error("[UPDATE_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to update vendor" };
  }
}

// ============================================================
// Delete Vendor
// ============================================================

export async function deleteVendor(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: { select: { bookingVendors: true, bids: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Vendor not found" };
    }

    if (existing._count.bookingVendors > 0 || existing._count.bids > 0) {
      return {
        success: false as const,
        error: "Cannot delete vendor with existing booking assignments or bids",
      };
    }

    await prisma.vendor.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Vendor",
      entityId: id,
    });

    revalidatePath("/vendors");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to delete vendor" };
  }
}

// ============================================================
// Assign Vendor to Booking
// ============================================================

export async function assignVendorToBooking(
  bookingId: string,
  vendorId: string,
  data: AssignVendorInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = assignVendorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Check booking and vendor exist
    const [booking, vendor] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, bookingNumber: true } }),
      prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true } }),
    ]);

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }
    if (!vendor) {
      return { success: false as const, error: "Vendor not found" };
    }

    const assignData = parsed.data;

    const bookingVendor = await prisma.bookingVendor.create({
      data: {
        bookingId,
        vendorId,
        role: assignData.role || null,
        agreedRate: assignData.agreedRate ?? null,
        notes: assignData.notes || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true, eventName: true } },
      },
    });

    // Increment vendor totalBookings
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { totalBookings: { increment: 1 } },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "BookingVendor",
      entityId: bookingVendor.id,
      changes: { bookingId, vendorId, vendorName: vendor.name },
    });

    revalidatePath(`/vendors/${vendorId}`);
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/vendors");
    return { success: true as const, data: serialize(bookingVendor) };
  } catch (error) {
    console.error("[ASSIGN_VENDOR_ERROR]", error);
    // Handle unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return {
        success: false as const,
        error: "This vendor is already assigned to this booking",
      };
    }
    return { success: false as const, error: "Failed to assign vendor" };
  }
}

// ============================================================
// Remove Vendor from Booking
// ============================================================

export async function removeVendorFromBooking(bookingVendorId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.bookingVendor.findUnique({
      where: { id: bookingVendorId },
      select: { id: true, bookingId: true, vendorId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Assignment not found" };
    }

    await prisma.bookingVendor.delete({ where: { id: bookingVendorId } });

    // Decrement vendor totalBookings
    await prisma.vendor.update({
      where: { id: existing.vendorId },
      data: { totalBookings: { decrement: 1 } },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "BookingVendor",
      entityId: bookingVendorId,
    });

    revalidatePath(`/vendors/${existing.vendorId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    revalidatePath("/vendors");
    return { success: true as const, data: { id: bookingVendorId } };
  } catch (error) {
    console.error("[REMOVE_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to remove vendor" };
  }
}

// ============================================================
// Update Vendor Assignment
// ============================================================

export async function updateVendorAssignment(
  bookingVendorId: string,
  data: UpdateAssignmentInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateAssignmentSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.bookingVendor.findUnique({
      where: { id: bookingVendorId },
    });

    if (!existing) {
      return { success: false as const, error: "Assignment not found" };
    }

    const updateData = parsed.data;

    const bookingVendor = await prisma.bookingVendor.update({
      where: { id: bookingVendorId },
      data: {
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.agreedRate !== undefined && { agreedRate: updateData.agreedRate }),
        ...(updateData.notes !== undefined && { notes: updateData.notes || null }),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "BookingVendor",
      entityId: bookingVendorId,
    });

    revalidatePath(`/vendors/${existing.vendorId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    return { success: true as const, data: serialize(bookingVendor) };
  } catch (error) {
    console.error("[UPDATE_VENDOR_ASSIGNMENT_ERROR]", error);
    return { success: false as const, error: "Failed to update assignment" };
  }
}

// ============================================================
// Rate Vendor
// ============================================================

export async function rateVendor(vendorId: string, rating: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (rating < 0 || rating > 5 || !Number.isInteger(rating)) {
      return { success: false as const, error: "Rating must be an integer between 0 and 5" };
    }

    const existing = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!existing) {
      return { success: false as const, error: "Vendor not found" };
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: { rating },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Vendor",
      entityId: vendorId,
      changes: { rating },
    });

    revalidatePath(`/vendors/${vendorId}`);
    revalidatePath("/vendors");
    return { success: true as const, data: serialize(vendor) };
  } catch (error) {
    console.error("[RATE_VENDOR_ERROR]", error);
    return { success: false as const, error: "Failed to rate vendor" };
  }
}

// ============================================================
// Submit Bid
// ============================================================

export async function submitBid(
  bookingId: string,
  vendorId: string,
  data: VendorBidInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = vendorBidSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const [booking, vendor] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, bookingNumber: true } }),
      prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true } }),
    ]);

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }
    if (!vendor) {
      return { success: false as const, error: "Vendor not found" };
    }

    const bidData = parsed.data;

    const bid = await prisma.vendorBid.create({
      data: {
        bookingId,
        vendorId,
        amount: bidData.amount,
        message: bidData.message || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true, eventName: true } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "VendorBid",
      entityId: bid.id,
      changes: { bookingId, vendorId, amount: bidData.amount },
    });

    revalidatePath(`/vendors/${vendorId}`);
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true as const, data: serialize(bid) };
  } catch (error) {
    console.error("[SUBMIT_BID_ERROR]", error);
    return { success: false as const, error: "Failed to submit bid" };
  }
}

// ============================================================
// Accept Bid
// ============================================================

export async function acceptBid(bidId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.vendorBid.findUnique({
      where: { id: bidId },
      include: {
        vendor: { select: { name: true } },
        booking: { select: { bookingNumber: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Bid not found" };
    }

    if (existing.status !== "PENDING") {
      return { success: false as const, error: "Bid has already been responded to" };
    }

    // Accept this bid and reject all other PENDING bids for the same booking+vendor
    await prisma.$transaction([
      prisma.vendorBid.update({
        where: { id: bidId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      }),
      prisma.vendorBid.updateMany({
        where: {
          bookingId: existing.bookingId,
          vendorId: existing.vendorId,
          id: { not: bidId },
          status: "PENDING",
        },
        data: { status: "REJECTED", respondedAt: new Date() },
      }),
    ]);

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "VendorBid",
      entityId: bidId,
      changes: { status: "ACCEPTED" },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Bid Accepted",
      message: `Bid from "${existing.vendor.name}" for booking ${existing.booking.bookingNumber} has been accepted.`,
      actionUrl: `/vendors/${existing.vendorId}`,
    });

    revalidatePath(`/vendors/${existing.vendorId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    return { success: true as const, data: { id: bidId } };
  } catch (error) {
    console.error("[ACCEPT_BID_ERROR]", error);
    return { success: false as const, error: "Failed to accept bid" };
  }
}

// ============================================================
// Reject Bid
// ============================================================

export async function rejectBid(bidId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.vendorBid.findUnique({
      where: { id: bidId },
    });

    if (!existing) {
      return { success: false as const, error: "Bid not found" };
    }

    if (existing.status !== "PENDING") {
      return { success: false as const, error: "Bid has already been responded to" };
    }

    await prisma.vendorBid.update({
      where: { id: bidId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "VendorBid",
      entityId: bidId,
      changes: { status: "REJECTED" },
    });

    revalidatePath(`/vendors/${existing.vendorId}`);
    revalidatePath(`/bookings/${existing.bookingId}`);
    return { success: true as const, data: { id: bidId } };
  } catch (error) {
    console.error("[REJECT_BID_ERROR]", error);
    return { success: false as const, error: "Failed to reject bid" };
  }
}

// ============================================================
// Get Booking Vendors (vendors assigned to a booking)
// ============================================================

export async function getBookingVendors(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bookingVendors = await prisma.bookingVendor.findMany({
      where: { bookingId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            email: true,
            phone: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(bookingVendors) };
  } catch (error) {
    console.error("[GET_BOOKING_VENDORS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch booking vendors" };
  }
}

// ============================================================
// Get Vendor Bids (bids for a booking)
// ============================================================

export async function getVendorBids(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bids = await prisma.vendorBid.findMany({
      where: { bookingId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            rating: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return { success: true as const, data: serialize(bids) };
  } catch (error) {
    console.error("[GET_VENDOR_BIDS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor bids" };
  }
}
