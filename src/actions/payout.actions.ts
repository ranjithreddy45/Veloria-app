"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createPayoutSchema,
  approvePayoutSchema,
  type CreatePayoutInput,
} from "@/schemas/payout.schema";
import type { PayoutStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { postPayoutPaid, findDuplicatePayouts } from "@/lib/finance/payables";

// ============================================================
// Generate Reference Number
// ============================================================

function generateReferenceNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${y}${m}-${rand}`;
}

// ============================================================
// Get Payouts (Filtered)
// ============================================================

export async function getPayouts(params?: {
  status?: PayoutStatus;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:read")) {
      return { success: false as const, error: "Not authorized to view payouts" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true as const,
      data: serialize(payouts),
    };
  } catch (error) {
    console.error("[GET_PAYOUTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payouts" };
  }
}

// ============================================================
// Get Payout By ID
// ============================================================

export async function getPayoutById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:read")) {
      return { success: false as const, error: "Not authorized to view payouts" };
    }

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            category: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
            date: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!payout) {
      return { success: false as const, error: "Payout not found" };
    }

    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[GET_PAYOUT_BY_ID_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payout" };
  }
}

// ============================================================
// Create Payout
// ============================================================

export async function createPayout(data: CreatePayoutInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:create")) {
      return { success: false as const, error: "Not authorized to create payouts" };
    }

    const parsed = createPayoutSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const payoutData = parsed.data;

    const payout = await prisma.payout.create({
      data: {
        amount: payoutData.amount,
        type: payoutData.type,
        description: payoutData.description || null,
        referenceNumber: generateReferenceNumber(),
        vendorId: payoutData.vendorId || null,
        bookingId: payoutData.bookingId || null,
        notes: payoutData.notes || null,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Payout",
      entityId: payout.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Payout Created",
      message: `Payout ${payout.referenceNumber} for ${payoutData.type.replace("_", " ")} has been created.`,
      actionUrl: `/payouts/${payout.id}`,
    });

    // Duplicate-payment control (Rule 4): warn the maker if a near-identical
    // payout to the same vendor was raised recently. Non-blocking — surfaced so
    // the approver can double-check before money moves.
    let duplicateWarning: string | undefined;
    try {
      const dupes = await findDuplicatePayouts({
        vendorId: payoutData.vendorId || null,
        amount: payoutData.amount,
        type: payoutData.type,
        excludePayoutId: payout.id,
      });
      if (dupes.length > 0) {
        const refs = dupes.map((d) => d.referenceNumber ?? d.id).join(", ");
        duplicateWarning = `Possible duplicate: ${dupes.length} recent payout(s) to this vendor for the same amount (${refs}). Verify before approving.`;
      }
    } catch (dupErr) {
      console.error("[PAYOUT_DUP_CHECK_ERROR]", dupErr);
    }

    revalidatePath("/payouts");
    return { success: true as const, data: serialize(payout), duplicateWarning };
  } catch (error) {
    console.error("[CREATE_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to create payout" };
  }
}

// ============================================================
// Approve Payout
// ============================================================

export async function approvePayout(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:approve")) {
      return { success: false as const, error: "Not authorized to approve payouts" };
    }

    const parsed = approvePayoutSchema.safeParse({ id });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }

    if (existing.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only pending payouts can be approved",
      };
    }

    const payout = await prisma.payout.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id as string,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Payout",
      entityId: id,
      changes: { status: "APPROVED" },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Payout Approved",
      message: `Payout ${payout.referenceNumber} has been approved.`,
      actionUrl: `/payouts/${payout.id}`,
    });

    revalidatePath("/payouts");
    revalidatePath(`/payouts/${id}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[APPROVE_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to approve payout" };
  }
}

// ============================================================
// Mark Payout as Paid
// ============================================================

export async function markPayoutPaid(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:approve")) {
      return { success: false as const, error: "Not authorized to mark payouts as paid" };
    }

    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }

    if (existing.status !== "APPROVED") {
      return {
        success: false as const,
        error: "Only approved payouts can be marked as paid",
      };
    }

    const payout = await prisma.payout.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Payout",
      entityId: id,
      changes: { status: "PAID" },
    });

    // Post the disbursement to the General Ledger (best-effort, idempotent).
    postPayoutPaid(payout.id, session.user.id as string).catch((err) =>
      console.error("[PAYOUT_GL_POST_ERROR]", err),
    );

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Payout Paid",
      message: `Payout ${payout.referenceNumber} has been marked as paid.`,
      actionUrl: `/payouts/${payout.id}`,
    });

    revalidatePath("/payouts");
    revalidatePath(`/payouts/${id}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[MARK_PAYOUT_PAID_ERROR]", error);
    return { success: false as const, error: "Failed to mark payout as paid" };
  }
}

// ============================================================
// Cancel Payout
// ============================================================

export async function cancelPayout(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:approve")) {
      return { success: false as const, error: "Not authorized to cancel payouts" };
    }

    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }

    if (existing.status === "PAID" || existing.status === "CANCELLED") {
      return {
        success: false as const,
        error: `Cannot cancel a payout that is already ${existing.status.toLowerCase()}`,
      };
    }

    const payout = await prisma.payout.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Payout",
      entityId: id,
      changes: { status: "CANCELLED" },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Payout Cancelled",
      message: `Payout ${payout.referenceNumber} has been cancelled.`,
      actionUrl: `/payouts/${payout.id}`,
    });

    revalidatePath("/payouts");
    revalidatePath(`/payouts/${id}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[CANCEL_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to cancel payout" };
  }
}

// ============================================================
// Get Payout Stats
// ============================================================

export async function getPayoutStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:read")) {
      return { success: false as const, error: "Not authorized to view payout stats" };
    }

    const [pendingResult, approvedResult, paidResult] = await Promise.all([
      prisma.payout.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where: { status: "APPROVED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      success: true as const,
      data: serialize({
        totalPending: pendingResult._sum.amount ?? 0,
        pendingCount: pendingResult._count,
        totalApproved: approvedResult._sum.amount ?? 0,
        approvedCount: approvedResult._count,
        totalPaid: paidResult._sum.amount ?? 0,
        paidCount: paidResult._count,
      }),
    };
  } catch (error) {
    console.error("[GET_PAYOUT_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payout stats" };
  }
}

// ============================================================
// Generate Venue Owner Payout from Booking
// ============================================================

export async function generateVenueOwnerPayout(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:create")) {
      return { success: false as const, error: "Not authorized to generate payouts" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        totalAmount: true,
        status: true,
      },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    if (booking.status !== "COMPLETED" && booking.status !== "CONFIRMED") {
      return {
        success: false as const,
        error: "Can only generate payouts for confirmed or completed bookings",
      };
    }

    // Check if a payout already exists for this booking
    const existingPayout = await prisma.payout.findFirst({
      where: {
        bookingId,
        type: "OWNER_PAYOUT",
        status: { not: "CANCELLED" },
      },
    });

    if (existingPayout) {
      return {
        success: false as const,
        error: "An owner payout already exists for this booking",
      };
    }

    // Calculate owner payout: booking total amount (full amount for venue owner)
    const payoutAmount = Number(booking.totalAmount);

    const payout = await prisma.payout.create({
      data: {
        amount: payoutAmount,
        type: "OWNER_PAYOUT",
        description: `Owner payout for booking ${booking.bookingNumber} - ${booking.eventName}`,
        referenceNumber: generateReferenceNumber(),
        bookingId: booking.id,
        notes: `Auto-generated from booking ${booking.bookingNumber}`,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Payout",
      entityId: payout.id,
      changes: { bookingId, type: "OWNER_PAYOUT", amount: payoutAmount },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Owner Payout Generated",
      message: `Owner payout ${payout.referenceNumber} generated from booking ${booking.bookingNumber}.`,
      actionUrl: `/payouts/${payout.id}`,
    });

    revalidatePath("/payouts");
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[GENERATE_VENUE_OWNER_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to generate owner payout" };
  }
}

// ============================================================
// Get Vendors (for payout form select)
// ============================================================

export async function getVendorsForPayout() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const vendors = await prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(vendors) };
  } catch (error) {
    console.error("[GET_VENDORS_FOR_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendors" };
  }
}

// ============================================================
// Get Bookings (for payout form select)
// ============================================================

export async function getBookingsForPayout() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        totalAmount: true,
      },
      orderBy: { date: "desc" },
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_BOOKINGS_FOR_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}
