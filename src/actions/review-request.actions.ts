"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { enqueueReviewRequestForBooking } from "@/lib/reputation/review-request";

// ============================================================
// Reputation Flywheel — INTERNAL gated actions (RBAC at top)
// ------------------------------------------------------------
// Staff funnel dashboard + private-feedback resolution. All return the
// Result<T> shape ({ success, error?, data? }) and serialize() dates.
// ============================================================

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Paginated funnel list with booking/contact joins. [reviews:read]
// ---------------------------------------------------------------------------
export async function getReviewRequests(input?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:read")) {
      return { success: false as const, error: "You do not have permission to view feedback" };
    }

    const page = Math.max(1, input?.page ?? 1);
    const limit = Math.min(100, Math.max(1, input?.limit ?? PAGE_SIZE));

    const where = input?.status
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { status: input.status as any }
      : {};

    const [rows, total] = await Promise.all([
      prisma.reviewRequest.findMany({
        where,
        select: {
          id: true,
          status: true,
          gateRating: true,
          sentAt: true,
          ratedAt: true,
          createdAt: true,
          failReason: true,
          contact: { select: { firstName: true, lastName: true } },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
              date: true,
              venue: { select: { name: true } },
            },
          },
          feedback: {
            select: {
              id: true,
              rating: true,
              comment: true,
              isResolved: true,
              resolvedAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reviewRequest.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      gateRating: r.gateRating,
      sentAt: r.sentAt,
      ratedAt: r.ratedAt,
      createdAt: r.createdAt,
      failReason: r.failReason,
      customerName: `${r.contact.firstName} ${r.contact.lastName ?? ""}`.trim(),
      bookingId: r.booking.id,
      bookingNumber: r.booking.bookingNumber,
      eventName: r.booking.eventName,
      eventDate: r.booking.date,
      venueName: r.booking.venue.name,
      feedback: r.feedback,
    }));

    return {
      success: true as const,
      data: serialize({
        data,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }),
    };
  } catch (error) {
    console.error("[GET_REVIEW_REQUESTS_ERROR]", error);
    return { success: false as const, error: "Failed to load review requests" };
  }
}

// ---------------------------------------------------------------------------
// Funnel counts by status + unresolved private-feedback count. [reviews:read]
// ---------------------------------------------------------------------------
export async function getReviewRequestStats() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:read")) {
      return { success: false as const, error: "You do not have permission to view feedback" };
    }

    const [grouped, total, unresolvedPrivate] = await Promise.all([
      prisma.reviewRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.reviewRequest.count(),
      prisma.publicFeedback.count({ where: { isResolved: false } }),
    ]);

    const byStatus: Record<string, number> = {
      PENDING: 0,
      SENT: 0,
      RATED: 0,
      ROUTED_PUBLIC: 0,
      ROUTED_PRIVATE: 0,
      COMPLETED: 0,
      FAILED: 0,
      SKIPPED: 0,
    };
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
    }

    return {
      success: true as const,
      data: { total, byStatus, unresolvedPrivate },
    };
  } catch (error) {
    console.error("[GET_REVIEW_REQUEST_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to load feedback stats" };
  }
}

// ---------------------------------------------------------------------------
// Mark a private feedback row resolved. [reviews:moderate]
// ---------------------------------------------------------------------------
export async function resolveFeedback(reviewRequestId: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:moderate")) {
      return { success: false as const, error: "You do not have permission to resolve feedback" };
    }

    const feedback = await prisma.publicFeedback.findUnique({
      where: { reviewRequestId },
      select: { id: true, isResolved: true },
    });
    if (!feedback) return { success: false as const, error: "Feedback not found" };
    if (feedback.isResolved) {
      return { success: true as const, data: { id: feedback.id } };
    }

    const updated = await prisma.publicFeedback.update({
      where: { reviewRequestId },
      data: { isResolved: true, resolvedAt: new Date() },
      select: { id: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "resolved_feedback",
      entityType: "PublicFeedback",
      entityId: updated.id,
      changes: { reviewRequestId },
    });

    revalidatePath("/feedback");
    return { success: true as const, data: { id: updated.id } };
  } catch (error) {
    console.error("[RESOLVE_FEEDBACK_ERROR]", error);
    return { success: false as const, error: "Failed to resolve feedback" };
  }
}

// ---------------------------------------------------------------------------
// Manually enqueue + send a review request for one COMPLETED booking.
// [reviews:moderate]
// ---------------------------------------------------------------------------
export async function manualEnqueueReviewRequest(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:moderate")) {
      return { success: false as const, error: "You do not have permission to send review requests" };
    }

    const result = await enqueueReviewRequestForBooking(bookingId);
    if (!result.ok) {
      return { success: false as const, error: result.error };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "enqueued_review_request",
      entityType: "Booking",
      entityId: bookingId,
      changes: { outcome: result.outcome, alreadyExisted: result.alreadyExisted },
    });

    revalidatePath("/feedback");

    const message =
      result.outcome === "sent"
        ? "Review request sent."
        : result.outcome === "skippedNoPhone"
          ? "No phone number on file — could not send."
          : "Send failed — it will retry on the next daily run.";

    return { success: true as const, data: { outcome: result.outcome, message } };
  } catch (error) {
    console.error("[MANUAL_ENQUEUE_REVIEW_REQUEST_ERROR]", error);
    return { success: false as const, error: "Failed to send review request" };
  }
}
