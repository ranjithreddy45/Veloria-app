"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { assertTransition } from "@/lib/ops/state-machine";
import {
  vendorPortalBidSchema,
  vendorEventsFilterSchema,
  vendorBidsFilterSchema,
  vendorPayoutsFilterSchema,
  type VendorPortalBidInput,
  type VendorEventsFilterInput,
  type VendorBidsFilterInput,
  type VendorPayoutsFilterInput,
} from "@/schemas/vendor-portal.schema";

// ============================================================
// Helper: Get Current Vendor for the Logged-in User
// ============================================================

async function getCurrentVendor(email: string) {
  // Bind DETERMINISTICALLY: with no DB unique on Vendor.email (deferred), two rows
  // could share an email — a plain findFirst would bind the portal to an arbitrary
  // one (a data-isolation risk). Match case-insensitively, prefer the earliest row,
  // and warn on ambiguity so it can be cleaned up. The create-guards now prevent
  // NEW email dupes from forming.
  const matches = await prisma.vendor.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
  if (matches.length > 1) {
    console.warn(`[VENDOR_PORTAL] ${matches.length} vendors share email "${email}"; binding to the earliest. Clean up the duplicates.`);
  }
  return matches[0] ?? null;
}

// ============================================================
// Get Vendor Dashboard Stats
// ============================================================

export async function getVendorDashboard() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:access")) {
      return { success: false as const, error: "Not authorized to access vendor portal" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [
      upcomingEventsCount,
      pendingBidsCount,
      paidPayoutsAggregate,
      recentAssignments,
      pendingBids,
    ] = await Promise.all([
      // Count upcoming events (bookings with date >= today)
      prisma.bookingVendor.count({
        where: {
          vendorId: vendor.id,
          booking: {
            date: { gte: now },
            status: { in: ["CONFIRMED", "IN_PROGRESS", "HOLD", "TENTATIVE"] },
          },
        },
      }),

      // Count pending bids
      prisma.vendorBid.count({
        where: {
          vendorId: vendor.id,
          status: "PENDING",
        },
      }),

      // Total paid payouts
      prisma.payout.aggregate({
        where: {
          vendorId: vendor.id,
          status: "PAID",
        },
        _sum: { amount: true },
      }),

      // Recent assigned bookings (limit 5)
      prisma.bookingVendor.findMany({
        where: { vendorId: vendor.id },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
              eventType: true,
              date: true,
              status: true,
              venue: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Pending bids (limit 5)
      prisma.vendorBid.findMany({
        where: {
          vendorId: vendor.id,
          status: "PENDING",
        },
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
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      success: true as const,
      data: serialize({
        vendorName: vendor.name,
        vendorCategory: vendor.category,
        vendorRating: vendor.rating,
        upcomingEvents: upcomingEventsCount,
        pendingBids: pendingBidsCount,
        totalPayouts: paidPayoutsAggregate._sum.amount ?? 0,
        recentAssignments,
        pendingBidsList: pendingBids,
      }),
    };
  } catch (error) {
    console.error("[GET_VENDOR_DASHBOARD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor dashboard" };
  }
}

// ============================================================
// Get Vendor Events (Bookings Assigned to Vendor)
// ============================================================

export async function getVendorEvents(params?: VendorEventsFilterInput) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:access")) {
      return { success: false as const, error: "Not authorized to access vendor portal" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const parsed = vendorEventsFilterSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return { success: false as const, error: "Invalid filter parameters" };
    }

    const { status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { vendorId: vendor.id };

    if (status) {
      where.status = status;
    }

    const [assignments, total] = await Promise.all([
      prisma.bookingVendor.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
              eventType: true,
              date: true,
              timeSlot: true,
              guestCount: true,
              status: true,
              venue: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.bookingVendor.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(assignments),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_VENDOR_EVENTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor events" };
  }
}

// ============================================================
// Get Vendor Bids
// ============================================================

export async function getVendorBids(params?: VendorBidsFilterInput) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:bids")) {
      return { success: false as const, error: "Not authorized to view bids" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const parsed = vendorBidsFilterSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return { success: false as const, error: "Invalid filter parameters" };
    }

    const { status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { vendorId: vendor.id };

    if (status) {
      where.status = status;
    }

    const [bids, total] = await Promise.all([
      prisma.vendorBid.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
              eventType: true,
              date: true,
              status: true,
              venue: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vendorBid.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(bids),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_VENDOR_BIDS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor bids" };
  }
}

// ============================================================
// Get Vendor Payouts
// ============================================================

export async function getVendorPayouts(params?: VendorPayoutsFilterInput) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:payouts")) {
      return { success: false as const, error: "Not authorized to view payouts" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const parsed = vendorPayoutsFilterSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return { success: false as const, error: "Invalid filter parameters" };
    }

    const { status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { vendorId: vendor.id };

    if (status) {
      where.status = status;
    }

    const [payouts, total, stats] = await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where }),
      // Aggregate stats for all payouts (not filtered by status for the summary)
      Promise.all([
        prisma.payout.aggregate({
          where: { vendorId: vendor.id, status: "PAID" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payout.aggregate({
          where: { vendorId: vendor.id, status: "PENDING" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payout.aggregate({
          where: { vendorId: vendor.id, status: "APPROVED" },
          _sum: { amount: true },
          _count: true,
        }),
      ]),
    ]);

    const [paidStats, pendingStats, approvedStats] = stats;

    return {
      success: true as const,
      data: {
        data: serialize(payouts),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: serialize({
          totalPaid: paidStats._sum.amount ?? 0,
          paidCount: paidStats._count,
          totalPending: pendingStats._sum.amount ?? 0,
          pendingCount: pendingStats._count,
          totalApproved: approvedStats._sum.amount ?? 0,
          approvedCount: approvedStats._count,
        }),
      },
    };
  } catch (error) {
    console.error("[GET_VENDOR_PAYOUTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor payouts" };
  }
}

// ============================================================
// Submit Vendor Bid (from Vendor Portal)
// ============================================================

export async function submitVendorBid(data: VendorPortalBidInput) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:bids")) {
      return { success: false as const, error: "Not authorized to submit bids" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const parsed = vendorPortalBidSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const bidData = parsed.data;

    // Verify booking exists AND is in a biddable state (mirror the read-path
    // guard in getAvailableBookingsForBid — the mutating action must not trust
    // the client-supplied bookingId for state/date).
    const booking = await prisma.booking.findFirst({
      where: {
        id: bidData.bookingId,
        status: { in: ["CONFIRMED", "IN_PROGRESS", "HOLD", "TENTATIVE"] },
        date: { gte: new Date() },
      },
      select: { id: true, bookingNumber: true, eventName: true },
    });

    if (!booking) {
      return { success: false as const, error: "This booking is not open for bids" };
    }

    // Dedup guard: one active bid per vendor per booking (no DB unique
    // constraint by design, so guard in code).
    const existingBid = await prisma.vendorBid.findFirst({
      where: { bookingId: bidData.bookingId, vendorId: vendor.id },
      select: { id: true },
    });
    if (existingBid) {
      return { success: false as const, error: "You have already bid on this booking" };
    }

    const bid = await prisma.vendorBid.create({
      data: {
        bookingId: bidData.bookingId,
        vendorId: vendor.id,
        amount: bidData.amount,
        message: bidData.message || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true, eventName: true } },
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "VendorBid",
      entityId: bid.id,
      changes: { bookingId: bidData.bookingId, vendorId: vendor.id, amount: bidData.amount },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Bid Submitted",
      message: `Bid of ${bidData.amount} submitted for booking ${booking.bookingNumber} - ${booking.eventName}.`,
      actionUrl: `/vendor-portal/bids`,
    });

    revalidatePath("/vendor-portal/bids");
    revalidatePath("/vendor-portal");
    return { success: true as const, data: serialize(bid) };
  } catch (error) {
    console.error("[SUBMIT_VENDOR_BID_ERROR]", error);
    return { success: false as const, error: "Failed to submit bid" };
  }
}

// ============================================================
// Get Available Bookings for Bid Submission
// ============================================================

export async function getAvailableBookingsForBid() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:bids")) {
      return { success: false as const, error: "Not authorized" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    // Get bookings that are confirmed/in-progress and the vendor hasn't already bid on
    const existingBidBookingIds = await prisma.vendorBid.findMany({
      where: { vendorId: vendor.id },
      select: { bookingId: true },
    });

    const excludeIds = existingBidBookingIds.map((b) => b.bookingId);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "HOLD", "TENTATIVE"] },
        date: { gte: new Date() },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        date: true,
        venue: { select: { name: true } },
      },
      orderBy: { date: "asc" },
      take: 50,
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_AVAILABLE_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch available bookings" };
  }
}

// ============================================================
// Get My Operation Assignments (per-operation vendor confirm/decline)
// ------------------------------------------------------------
// OperationVendorAssignment rows join to this vendor ONLY through
// bookingVendor.vendorId — we filter on that so a vendor can never see another
// vendor's operation assignments. `actionable` mirrors the public confirm flow:
// the vendor can still respond only while the row is NOTIFIED.
// ============================================================

export async function getMyOperationAssignments() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:access")) {
      return { success: false as const, error: "Not authorized to access vendor portal" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const assignments = await prisma.operationVendorAssignment.findMany({
      // Ownership is enforced by the join: only rows whose bookingVendor belongs
      // to the current vendor are ever returned.
      where: { bookingVendor: { vendorId: vendor.id } },
      select: {
        id: true,
        status: true,
        arrivalTime: true,
        setupTime: true,
        teardownTime: true,
        notes: true,
        confirmedAt: true,
        declinedAt: true,
        createdAt: true,
        operation: {
          select: {
            id: true,
            status: true,
          },
        },
        bookingVendor: {
          select: {
            role: true,
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                eventName: true,
                eventType: true,
                date: true,
                timeSlot: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const shaped = assignments.map((a) => ({
      id: a.id,
      status: a.status,
      actionable: a.status === "NOTIFIED",
      role: a.bookingVendor.role,
      arrivalTime: a.arrivalTime,
      setupTime: a.setupTime,
      teardownTime: a.teardownTime,
      notes: a.notes,
      confirmedAt: a.confirmedAt,
      declinedAt: a.declinedAt,
      // EventOperation has no display name of its own; surface its lifecycle
      // status so the vendor can tell operations apart, plus booking context.
      operationStatus: a.operation.status,
      booking: a.bookingVendor.booking,
    }));

    return { success: true as const, data: serialize(shaped) };
  } catch (error) {
    console.error("[GET_MY_OPERATION_ASSIGNMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch operation assignments" };
  }
}

// ============================================================
// Respond to My Operation Assignment (Confirm / Decline)
// ------------------------------------------------------------
// Reuses the exact assertTransition + atomic status-guarded updateMany flip from
// submitVendorResponse, but access is by the LOGGED-IN vendor (not a token): we
// load the row, join through bookingVendor, and assert its vendorId === the
// current vendor's id before touching anything.
// ============================================================

export async function respondToMyAssignment(
  assignmentId: string,
  action: "CONFIRM" | "DECLINE",
  note?: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:access")) {
      return { success: false as const, error: "Not authorized to access vendor portal" };
    }

    if (action !== "CONFIRM" && action !== "DECLINE") {
      return { success: false as const, error: "Please choose Confirm or Decline." };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const target: "CONFIRMED" | "DECLINED" =
      action === "CONFIRM" ? "CONFIRMED" : "DECLINED";

    const assignment = await prisma.operationVendorAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        status: true,
        bookingVendor: { select: { vendorId: true } },
      },
    });
    if (!assignment) {
      return { success: false as const, error: "Assignment not found" };
    }

    // Ownership check — never trust the client-supplied id blindly.
    if (assignment.bookingVendor.vendorId !== vendor.id) {
      return { success: false as const, error: "Not authorized" };
    }

    // Idempotent: re-submitting the SAME response is a no-op success.
    if (assignment.status === target) {
      revalidatePath("/vendor-portal/events");
      return { success: true as const, data: { status: target, alreadyDone: true } };
    }

    const check = assertTransition("vendorAssignment", assignment.status, target);
    if (!check.ok) {
      return {
        success: false as const,
        error: check.error ?? "This assignment can no longer be changed.",
      };
    }

    const trimmedNote = (note ?? "").trim().slice(0, 500);

    // Atomic guard: only flip from the status we read (concurrency-safe).
    const flipped = await prisma.operationVendorAssignment.updateMany({
      where: { id: assignment.id, status: assignment.status },
      data:
        target === "CONFIRMED"
          ? {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              declinedAt: null,
              ...(trimmedNote ? { notes: `Vendor note: ${trimmedNote}` } : {}),
            }
          : {
              status: "DECLINED",
              declinedAt: new Date(),
              confirmedAt: null,
              ...(trimmedNote ? { notes: `Vendor declined: ${trimmedNote}` } : {}),
            },
    });

    if (flipped.count === 0) {
      const fresh = await prisma.operationVendorAssignment.findUnique({
        where: { id: assignment.id },
        select: { status: true },
      });
      if (fresh?.status === target) {
        revalidatePath("/vendor-portal/events");
        return { success: true as const, data: { status: target, alreadyDone: true } };
      }
      return { success: false as const, error: "This assignment was just updated. Please reload." };
    }

    logActivity({
      userId: session.user.id as string,
      action: target === "CONFIRMED" ? "confirmed" : "declined",
      entityType: "OperationVendorAssignment",
      entityId: assignment.id,
      changes: { status: target, vendorId: vendor.id },
    });

    revalidatePath("/vendor-portal/events");
    revalidatePath("/vendor-portal");
    return { success: true as const, data: { status: target, alreadyDone: false } };
  } catch (error) {
    console.error("[RESPOND_TO_MY_ASSIGNMENT_ERROR]", error);
    return { success: false as const, error: "Failed to update assignment" };
  }
}

// ============================================================
// Withdraw a Pending Bid
// ------------------------------------------------------------
// The VendorBidStatus enum is PENDING | ACCEPTED | REJECTED — there is NO
// "WITHDRAWN" state, so a withdrawal DELETES the row (guarded to PENDING only so
// an already-decided bid can never be retracted). The atomic deleteMany where
// status=PENDING makes this concurrency-safe.
// ============================================================

export async function withdrawBid(bidId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "vendor-portal:bids")) {
      return { success: false as const, error: "Not authorized to manage bids" };
    }

    const vendor = await getCurrentVendor(session.user.email);
    if (!vendor) {
      return { success: false as const, error: "Vendor profile not found for this account" };
    }

    const bid = await prisma.vendorBid.findUnique({
      where: { id: bidId },
      select: { id: true, vendorId: true, status: true, bookingId: true },
    });
    if (!bid) {
      return { success: false as const, error: "Bid not found" };
    }

    // Ownership check — never trust the client-supplied id blindly.
    if (bid.vendorId !== vendor.id) {
      return { success: false as const, error: "Not authorized" };
    }

    if (bid.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only pending bids can be withdrawn.",
      };
    }

    // No WITHDRAWN enum value exists → delete, guarded atomically to PENDING so a
    // concurrent accept/reject wins instead of being silently discarded.
    const removed = await prisma.vendorBid.deleteMany({
      where: { id: bid.id, vendorId: vendor.id, status: "PENDING" },
    });

    if (removed.count === 0) {
      return {
        success: false as const,
        error: "This bid was just updated and can no longer be withdrawn.",
      };
    }

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "VendorBid",
      entityId: bid.id,
      changes: { withdrawn: true, vendorId: vendor.id, bookingId: bid.bookingId },
    });

    revalidatePath("/vendor-portal/bids");
    revalidatePath("/vendor-portal");
    return { success: true as const, data: { id: bid.id } };
  } catch (error) {
    console.error("[WITHDRAW_BID_ERROR]", error);
    return { success: false as const, error: "Failed to withdraw bid" };
  }
}
