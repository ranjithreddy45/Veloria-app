// ============================================================
// Public social-proof fetcher — PUBLIC-safe, no auth, read-only.
// ------------------------------------------------------------
// Injects approved 5★ Reviews + matched public GalleryItems into the
// customer-facing funnel surfaces (configurator, hold, pay, quote, storefront)
// at the decision moment. There is NO new content model: this queries the
// EXISTING approved Review rows (isApproved && isPublic && rating>=5) joined
// through Booking.eventType / Booking.venueId for relevance, and the public
// GalleryItem rows (isPublic).
//
// SECURITY (see spec risks):
//  - Runs with NO auth()/hasPermission — it deliberately bypasses
//    reviews:read / gallery:read because it ONLY ever reads already-public,
//    already-approved rows.
//  - Reviews carry contact identity. The projection exposes the reviewer's
//    FIRST name only (contact.firstName) + rating + truncated content. It
//    NEVER selects/returns email, phone, last name, bookingId or contactId.
//  - Inputs are clamped strings only — no raw where-clause / id list from the
//    caller (no IDOR). The same already-public rows are returned to anyone.
//
// RESILIENCE: all four surfaces are revenue-critical pay/hold pages, so this
// fetcher is best-effort — it swallows errors and returns EMPTY_SOCIAL_PROOF
// rather than throwing, so a proof-query failure can never block a Razorpay
// button or a hold confirmation (mirrors the lead-pipeline best-effort rule).
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  EMPTY_SOCIAL_PROOF,
  type PublicGalleryPhoto,
  type PublicReview,
  type SocialProofData,
  type SocialProofQuery,
} from "./social-proof-types";

// Hard caps so an unauthenticated, uncached path can never be made to pull
// large result sets. Reviews cap 6, photos cap 8 (spec performance note).
const MAX_REVIEWS = 6;
const MAX_PHOTOS = 8;
const CONTENT_TRUNCATE = 320; // chars — keep the strip compact, avoid PII spill

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

/** Relevance rank: exact eventType+venue (0) → eventType (1) → venue (2) → global (3). */
function reviewRank(
  bookingEventType: string | null | undefined,
  bookingVenueId: string | null | undefined,
  wantEventType?: string,
  wantVenueId?: string,
): number {
  const eventMatch = !!wantEventType && bookingEventType === wantEventType;
  const venueMatch = !!wantVenueId && bookingVenueId === wantVenueId;
  if (eventMatch && venueMatch) return 0;
  if (eventMatch) return 1;
  if (venueMatch) return 2;
  return 3;
}

/**
 * Read-only, public-safe social proof for a funnel surface.
 *
 * Matching strategy (so the strip is never empty on a valid surface):
 *  reviews — pull a recent pool of approved+public 5★ reviews (with their
 *  booking eventType/venueId), then rank exact eventType+venue first, falling
 *  back through eventType, venue, and finally global-recent. We over-fetch a
 *  small pool and rank in memory to avoid N separate queries (no N+1).
 *
 *  photos — public GalleryItems matched by eventType in tags[], by venueId,
 *  or by the linked booking's eventType; ordered by curated `order` then recent.
 *
 * NEVER throws — returns EMPTY_SOCIAL_PROOF on any failure.
 */
export async function getSocialProof(query: SocialProofQuery = {}): Promise<SocialProofData> {
  const eventType = typeof query.eventType === "string" ? query.eventType.trim() || undefined : undefined;
  const venueId = typeof query.venueId === "string" ? query.venueId.trim() || undefined : undefined;
  const reviewLimit = clampLimit(query.limit, MAX_REVIEWS, MAX_REVIEWS);
  const photoLimit = MAX_PHOTOS;

  try {
    // GalleryItem has no Prisma relation to Booking (only a plain bookingId
    // String? ref), so to match photos by their booking's eventType we first
    // resolve the matching booking ids (bounded), then filter on bookingId.
    let eventTypeBookingIds: string[] = [];
    if (eventType) {
      const bks = await prisma.booking.findMany({
        where: { eventType },
        select: { id: true },
        take: 200,
      });
      eventTypeBookingIds = bks.map((b) => b.id);
    }

    const [reviewPool, aggregate, photoRows] = await Promise.all([
      // Over-fetch a small pool of public 5★ reviews for in-memory ranking.
      prisma.review.findMany({
        where: { isApproved: true, isPublic: true, rating: { gte: 5 } },
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          respondedAt: true,
          createdAt: true,
          contact: { select: { firstName: true } },
          booking: { select: { eventType: true, venueId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60, // bounded pool; ranked + sliced to reviewLimit below
      }),
      prisma.review.aggregate({
        where: { isApproved: true, isPublic: true, rating: { gte: 5 } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.galleryItem.findMany({
        where: {
          isPublic: true,
          OR: [
            ...(eventType ? [{ tags: { has: eventType } }] : []),
            ...(venueId ? [{ venueId }] : []),
            ...(eventTypeBookingIds.length ? [{ bookingId: { in: eventTypeBookingIds } }] : []),
            // global-recent fallback so the grid is never empty on a valid surface
            {},
          ],
        },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          title: true,
          mediaType: true,
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: photoLimit,
      }),
    ]);

    const reviews: PublicReview[] = reviewPool
      .map((r) => ({
        row: r,
        rank: reviewRank(r.booking?.eventType, r.booking?.venueId, eventType, venueId),
      }))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.row.createdAt.getTime() - a.row.createdAt.getTime();
      })
      .slice(0, reviewLimit)
      .map(({ row }) => ({
        id: row.id,
        reviewerFirstName: row.contact?.firstName?.trim() || "A happy guest",
        rating: row.rating,
        title: row.title,
        content: truncate(row.content, CONTENT_TRUNCATE),
        eventTypeLabel: row.booking?.eventType ?? null,
        respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      }));

    const photos: PublicGalleryPhoto[] = photoRows.map((g) => ({
      id: g.id,
      url: g.url,
      thumbnailUrl: g.thumbnailUrl,
      title: g.title,
      mediaType: g.mediaType,
    }));

    const avg = aggregate._avg.rating ?? 0;

    return {
      reviews,
      photos,
      aggregate: {
        averageRating: Math.round(avg * 10) / 10,
        totalCount: aggregate._count._all ?? 0,
      },
    };
  } catch {
    // Best-effort: a proof-query failure must never break a pay/hold page.
    return EMPTY_SOCIAL_PROOF;
  }
}
