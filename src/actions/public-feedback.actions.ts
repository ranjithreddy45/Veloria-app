"use server";

import { prisma } from "@/lib/prisma";
import { gateRoute } from "@/lib/reputation/review-request";
import {
  gateRatingSchema,
  privateFeedbackSchema,
} from "@/schemas/review-request.schema";

// ============================================================
// Reputation Flywheel — PUBLIC (no-auth) actions for /r/<token>
// ------------------------------------------------------------
// Mirrors getPublicInvoiceForPayment: access is controlled ONLY by an
// unguessable token. These actions NEVER return internal data — no ids,
// contact details, phone, amounts, booking numbers or internal notes. The
// landing page sees only what it strictly needs to render.
// ============================================================

// --- Minimal, non-leaking projection for the landing page -------------------
export interface PublicReviewRequestView {
  found: boolean;
  status: string;
  customerFirstName: string;
  eventName: string;
  venueName: string;
  googleReviewUrl: string;
  alreadyRated: boolean;
}

const NOT_FOUND: PublicReviewRequestView = {
  found: false,
  status: "",
  customerFirstName: "",
  eventName: "",
  venueName: "",
  googleReviewUrl: "",
  alreadyRated: false,
};

const ROUTED_STATUSES = ["ROUTED_PUBLIC", "ROUTED_PRIVATE", "COMPLETED"] as const;

// ---------------------------------------------------------------------------
// Load a review request by its public token — minimal projection only.
// ---------------------------------------------------------------------------
export async function getReviewRequestByToken(
  token: string,
): Promise<PublicReviewRequestView> {
  try {
    if (!token || typeof token !== "string") return NOT_FOUND;

    const req = await prisma.reviewRequest.findUnique({
      where: { token },
      select: {
        status: true,
        googleReviewUrl: true,
        contact: { select: { firstName: true } },
        booking: {
          select: {
            eventName: true,
            venue: { select: { name: true } },
          },
        },
      },
    });

    if (!req) return NOT_FOUND;

    const alreadyRated = (ROUTED_STATUSES as readonly string[]).includes(
      req.status,
    );

    return {
      found: true,
      status: req.status,
      customerFirstName: req.contact.firstName,
      eventName: req.booking.eventName,
      venueName: req.booking.venue.name,
      googleReviewUrl: req.googleReviewUrl ?? "",
      alreadyRated,
    };
  } catch (error) {
    console.error("[GET_REVIEW_REQUEST_BY_TOKEN_ERROR]", error);
    return NOT_FOUND;
  }
}

// ---------------------------------------------------------------------------
// Submit the 1–5 gating rating. Idempotent: if already routed, returns the
// prior route. >=4 → ROUTED_PUBLIC (+googleReviewUrl). <4 → ROUTED_PRIVATE
// and a PublicFeedback row (rating only; comment captured separately).
// ---------------------------------------------------------------------------
export async function submitGateRating(
  token: string,
  rating: number,
): Promise<
  | { success: true; route: "PUBLIC"; googleReviewUrl: string }
  | { success: true; route: "PRIVATE" }
  | { success: false; error: string }
> {
  try {
    const parsed = gateRatingSchema.safeParse({ rating });
    if (!parsed.success) {
      return { success: false, error: "Please pick a rating between 1 and 5" };
    }
    if (!token) return { success: false, error: "Invalid link" };

    const req = await prisma.reviewRequest.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        gateRating: true,
        googleReviewUrl: true,
      },
    });
    if (!req) return { success: false, error: "This link is no longer valid" };

    // Idempotent: already routed → return the prior outcome.
    if (req.status === "ROUTED_PUBLIC" || req.status === "COMPLETED") {
      return {
        success: true,
        route: "PUBLIC",
        googleReviewUrl: req.googleReviewUrl ?? "",
      };
    }
    if (req.status === "ROUTED_PRIVATE") {
      return { success: true, route: "PRIVATE" };
    }

    // Only allow rating from a fresh request.
    if (!["PENDING", "SENT", "RATED", "FAILED"].includes(req.status)) {
      return { success: false, error: "This request can no longer be rated" };
    }

    const value = parsed.data.rating;
    const route = gateRoute(value);
    const now = new Date();

    if (route === "PUBLIC") {
      await prisma.reviewRequest.update({
        where: { id: req.id },
        data: { gateRating: value, ratedAt: now, status: "ROUTED_PUBLIC" },
      });
      return {
        success: true,
        route: "PUBLIC",
        googleReviewUrl: req.googleReviewUrl ?? "",
      };
    }

    // PRIVATE path: route + capture rating-only PublicFeedback (idempotent
    // upsert keyed by reviewRequestId @unique).
    await prisma.reviewRequest.update({
      where: { id: req.id },
      data: { gateRating: value, ratedAt: now, status: "ROUTED_PRIVATE" },
    });
    await prisma.publicFeedback.upsert({
      where: { reviewRequestId: req.id },
      create: { reviewRequestId: req.id, rating: value },
      update: { rating: value },
    });

    return { success: true, route: "PRIVATE" };
  } catch (error) {
    console.error("[SUBMIT_GATE_RATING_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Attach the private comment to an already-ROUTED_PRIVATE request. Idempotent
// upsert by reviewRequestId @unique. Never published.
// ---------------------------------------------------------------------------
export async function submitPrivateFeedback(
  token: string,
  comment: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const parsed = privateFeedbackSchema.safeParse({ comment });
    if (!parsed.success) {
      return { success: false, error: "Please shorten your note and try again" };
    }
    if (!token) return { success: false, error: "Invalid link" };

    const req = await prisma.reviewRequest.findUnique({
      where: { token },
      select: { id: true, status: true, gateRating: true },
    });
    if (!req) return { success: false, error: "This link is no longer valid" };
    if (req.status !== "ROUTED_PRIVATE") {
      return { success: false, error: "Please submit your rating first" };
    }

    await prisma.publicFeedback.upsert({
      where: { reviewRequestId: req.id },
      create: {
        reviewRequestId: req.id,
        rating: req.gateRating ?? 1,
        comment: parsed.data.comment || null,
      },
      update: { comment: parsed.data.comment || null },
    });

    return { success: true };
  } catch (error) {
    console.error("[SUBMIT_PRIVATE_FEEDBACK_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
