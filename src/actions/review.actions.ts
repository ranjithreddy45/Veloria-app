"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  submitReviewSchema,
  respondToReviewSchema,
  type SubmitReviewInput,
  type RespondToReviewInput,
} from "@/schemas/review.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Helper: Get contact IDs linked to this user's email
// ============================================================

async function getClientContactIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) return [];

  const contacts = await prisma.contact.findMany({
    where: { email: user.email },
    select: { id: true },
  });

  return contacts.map((c) => c.id);
}

// ============================================================
// Get Reviews (Dashboard - Paginated + Filtered)
// ============================================================

export async function getReviews(params?: {
  search?: string;
  status?: "all" | "approved" | "pending";
  rating?: number;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:read")) {
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
        { content: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        {
          booking: {
            eventName: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    if (params?.status === "approved") {
      where.isApproved = true;
    } else if (params?.status === "pending") {
      where.isApproved = false;
    }

    if (params?.rating) {
      where.rating = params.rating;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
              date: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(reviews),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_REVIEWS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch reviews" };
  }
}

// ============================================================
// Submit Review (Portal - Client submits)
// ============================================================

export async function submitReview(data: SubmitReviewInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = submitReviewSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const reviewData = parsed.data;

    // Get contact IDs for this user
    const contactIds = await getClientContactIds(session.user.id);
    if (contactIds.length === 0) {
      return { success: false as const, error: "No contact profile found" };
    }

    // Verify booking belongs to this client and is completed
    const booking = await prisma.booking.findFirst({
      where: {
        id: reviewData.bookingId,
        contactId: { in: contactIds },
        status: "COMPLETED",
      },
      select: { id: true, contactId: true, eventName: true },
    });

    if (!booking) {
      return {
        success: false as const,
        error: "Booking not found or event not yet completed",
      };
    }

    // Check if a review already exists for this booking
    const existingReview = await prisma.review.findFirst({
      where: {
        bookingId: reviewData.bookingId,
        contactId: booking.contactId,
      },
    });

    if (existingReview) {
      return {
        success: false as const,
        error: "You have already submitted a review for this booking",
      };
    }

    const review = await prisma.review.create({
      data: {
        rating: reviewData.rating,
        title: reviewData.title || null,
        content: reviewData.content,
        isPublic: reviewData.isPublic ?? true,
        isApproved: false,
        contactId: booking.contactId,
        bookingId: reviewData.bookingId,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Review",
      entityId: review.id,
      changes: { bookingId: reviewData.bookingId, rating: reviewData.rating },
    });

    revalidatePath("/portal/reviews");
    revalidatePath("/reviews");
    return { success: true as const, data: serialize(review) };
  } catch (error) {
    console.error("[SUBMIT_REVIEW_ERROR]", error);
    return { success: false as const, error: "Failed to submit review" };
  }
}

// ============================================================
// Approve Review (Dashboard Moderation)
// ============================================================

export async function approveReview(id: string, approved: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:moderate")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Review not found" };
    }

    const review = await prisma.review.update({
      where: { id },
      data: { isApproved: approved },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Review",
      entityId: id,
      changes: { isApproved: approved },
    });

    revalidatePath("/reviews");
    return { success: true as const, data: serialize(review) };
  } catch (error) {
    console.error("[APPROVE_REVIEW_ERROR]", error);
    return { success: false as const, error: "Failed to update review" };
  }
}

// ============================================================
// Respond to Review (Dashboard Moderation)
// ============================================================

export async function respondToReview(id: string, data: RespondToReviewInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:moderate")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = respondToReviewSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Review not found" };
    }

    const review = await prisma.review.update({
      where: { id },
      data: {
        response: parsed.data.response,
        respondedAt: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Review",
      entityId: id,
      changes: { responded: true },
    });

    revalidatePath("/reviews");
    return { success: true as const, data: serialize(review) };
  } catch (error) {
    console.error("[RESPOND_REVIEW_ERROR]", error);
    return { success: false as const, error: "Failed to respond to review" };
  }
}

// ============================================================
// Get Average Rating
// ============================================================

export async function getAverageRating() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !hasPermission(role, "reviews:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const result = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { isApproved: true },
    });

    const ratingDistribution = await prisma.review.groupBy({
      by: ["rating"],
      _count: { id: true },
      where: { isApproved: true },
      orderBy: { rating: "desc" },
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of ratingDistribution) {
      distribution[row.rating] = row._count.id;
    }

    return {
      success: true as const,
      data: {
        average: Math.round((result._avg.rating ?? 0) * 10) / 10,
        total: result._count.id,
        distribution,
      },
    };
  } catch (error) {
    console.error("[GET_AVERAGE_RATING_ERROR]", error);
    return { success: false as const, error: "Failed to fetch rating stats" };
  }
}

// ============================================================
// Get Client's Completed Bookings (for review submission form)
// ============================================================

export async function getCompletedBookingsForReview() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const contactIds = await getClientContactIds(session.user.id);
    if (contactIds.length === 0) {
      return { success: true as const, data: [] };
    }

    // Get completed bookings that don't have a review yet
    const bookings = await prisma.booking.findMany({
      where: {
        contactId: { in: contactIds },
        status: "COMPLETED",
        reviews: {
          none: {
            contactId: { in: contactIds },
          },
        },
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        date: true,
        venue: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    return {
      success: true as const,
      data: serialize(
        bookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          eventName: b.eventName,
          eventType: b.eventType,
          date: b.date,
          venueName: b.venue.name,
        }))
      ),
    };
  } catch (error) {
    console.error("[GET_COMPLETED_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}

// ============================================================
// Staff-entered guest feedback + rating (item 10). submitReview is client-only
// (must be the guest's own booking); this lets an ops/sales moderator record a
// guest's post-event feedback on their behalf. It writes an unpublished Review
// (isApproved/isPublic false) that flows through the normal moderation queue.
// ============================================================
export async function recordGuestFeedback(input: {
  bookingId: string;
  rating: number;
  content: string;
  title?: string;
}): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !role || !hasPermission(role, "reviews:moderate")) {
    return { success: false as const, error: "Not authorized." };
  }
  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { success: false as const, error: "Rating must be 1–5." };
  const content = input.content?.trim();
  if (!content) return { success: false as const, error: "Feedback text is required." };

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, contactId: true },
  });
  if (!booking) return { success: false as const, error: "Booking not found." };

  // If a review already exists for this booking, update it; else create one.
  const existing = await prisma.review.findFirst({ where: { bookingId: booking.id }, select: { id: true } });
  let id: string;
  if (existing) {
    await prisma.review.update({
      where: { id: existing.id },
      data: { rating, content, title: input.title?.trim() || null },
    });
    id = existing.id;
  } else {
    const created = await prisma.review.create({
      data: {
        bookingId: booking.id,
        contactId: booking.contactId,
        rating,
        content,
        title: input.title?.trim() || null,
        isApproved: false,
        isPublic: false,
      },
      select: { id: true },
    });
    id = created.id;
  }
  await logActivity({ userId: session.user.id as string, action: "recorded_feedback", entityType: "Review", entityId: id });
  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath("/reviews");
  return { success: true as const, data: { id } };
}
