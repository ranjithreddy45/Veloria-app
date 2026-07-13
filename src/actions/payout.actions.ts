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
import { reportSystemFailure } from "@/lib/ops-alert";
import { after } from "next/server";
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
        bill: {
          select: {
            id: true,
            billNumber: true,
            amount: true,
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

    // Normalize optional FKs ("" is allowed by the schema but is not a real id).
    const vendorId = payoutData.vendorId || null;
    const bookingId = payoutData.bookingId || null;

    // Validate that referenced vendor/booking actually exist before creating the
    // payout. The schema only checks these are strings, so without this guard we
    // could persist orphaned payouts pointing at non-existent records.
    if (vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!vendor) {
        return { success: false as const, error: "Selected vendor does not exist" };
      }
    }

    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true },
      });
      if (!booking) {
        return { success: false as const, error: "Selected booking does not exist" };
      }
    }

    // Duplicate-payment control (Rule 4): block a near-identical payout to the
    // same vendor (same amount + type within the dedup window) BEFORE creating
    // it. Checking up-front — rather than warning after the row is already
    // persisted — also closes the double-submit / retry race that would
    // otherwise create two identical payouts. A failure in the dedup query
    // itself must not block legitimate creation, so it is caught and ignored.
    if (vendorId) {
      try {
        const dupes = await findDuplicatePayouts({
          vendorId,
          amount: payoutData.amount,
          type: payoutData.type,
        });
        if (dupes.length > 0) {
          const refs = dupes.map((d) => d.referenceNumber ?? d.id).join(", ");
          return {
            success: false as const,
            error: `Duplicate payout blocked: ${dupes.length} recent payout(s) to this vendor for the same amount and type already exist (${refs}). Cancel the existing payout or change the amount/type before creating a new one.`,
          };
        }
      } catch (dupErr) {
        console.error("[PAYOUT_DUP_CHECK_ERROR]", dupErr);
      }
    }

    const payout = await prisma.payout.create({
      data: {
        amount: payoutData.amount,
        type: payoutData.type,
        description: payoutData.description || null,
        referenceNumber: generateReferenceNumber(),
        vendorId,
        bookingId,
        billId: payoutData.billId ?? null,
        // isAdvance is meaningful only for a vendor payment (a prepayment that
        // debits Advances-to-Vendors 1300). Coerce false otherwise, so a crafted
        // call can't mis-post an owner/commission payout to the 1300 asset.
        isAdvance: payoutData.type === "VENDOR_PAYMENT" ? (payoutData.isAdvance ?? false) : false,
        notes: payoutData.notes || null,
        createdById: session.user.id as string,
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

    revalidatePath("/payouts");
    return { success: true as const, data: serialize(payout) };
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

    // Segregation of duties (maker-checker): the user who created a payout
    // cannot approve it — except SUPER_ADMIN, who is never gated by the approval
    // process in any module.
    if (
      existing.createdById &&
      existing.createdById === (session.user.id as string) &&
      (session.user.role as string) !== "SUPER_ADMIN"
    ) {
      return {
        success: false as const,
        error: "You can't approve a payout you created.",
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

    // Post the disbursement to the General Ledger via after() so it survives a
    // serverless freeze (idempotent; reconcile backstop). Alerts on failure.
    after(async () => {
      try {
        const res = await postPayoutPaid(payout.id, session.user.id as string);
        // postPayoutPaid never throws — it returns {posted:false,reason} on a
        // real failure (vs. benign no-ops like "not-seeded"/"already-posted").
        // Surface only genuine failures so the accounting gap is auditable and
        // can be retried/investigated, not silently swallowed.
        const benign = new Set([
          "not-seeded",
          "already-posted",
          "non-positive-amount",
        ]);
        if (!res.posted && !benign.has(res.reason)) {
          console.error("[PAYOUT_GL_POST_ERROR]", payout.id, res.reason);
          logActivity({
            userId: session.user.id as string,
            action: "updated",
            entityType: "Payout",
            entityId: payout.id,
            changes: { glPostingFailed: res.reason },
          });
          void reportSystemFailure({
            area: "GL posting",
            title: "Vendor payout failed to post",
            detail: `Payout ${payout.id}: ${res.reason}. AP/cash may be unreconciled.`,
            actionUrl: "/finance",
          });
        }
      } catch (err) {
        console.error("[PAYOUT_GL_POST_ERROR]", err);
        void reportSystemFailure({
          area: "GL posting",
          title: "Vendor payout failed to post",
          detail: `Payout ${payout.id}: ${err instanceof Error ? err.message : "unknown"}. AP/cash may be unreconciled.`,
          actionUrl: "/finance",
        });
      }
    });

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
// Get Vendors (for payout form select)
// ============================================================

export async function getVendorsForPayout() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payouts:read")) {
      return { success: false as const, error: "Not authorized to view vendors" };
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

    if (!hasPermission(session.user.role as string, "payouts:read")) {
      return { success: false as const, error: "Not authorized to view bookings" };
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
