"use server";

// ============================================================
// Digital brochure — PUBLIC read (no auth) for /v/<slug>.
// ------------------------------------------------------------
// The slug is the unguessable public access token. This file returns ONLY a
// sanitised DTO for a published brochure and bumps a vanity view counter.
//
// SECURITY (see digital-brochure risks):
//  - getPublicGallery / getReviews are AUTH-GATED, so we query GalleryItem and
//    Review DIRECTLY here and re-filter by isPublic / isApproved at query time.
//    This means un-approving a review or making a gallery item private removes
//    it from the live brochure immediately (stale curated ids cannot bypass
//    moderation).
//  - Reviewer identity is reduced to a first name only. No contactId,
//    bookingId, createdById or other internal fields ever leave this boundary.
//  - A referenced venue that is later deactivated → 404 (mirror createPublicHold
//    isActive guard) so we never offer holds on an unbookable venue.
//  - videoEmbedUrl / tour360Url are re-checked against the host allowlist before
//    they reach the iframe renderer (defence-in-depth).
//  - Decimal money is serialized to a number only here, at the DTO boundary.
// ============================================================

import { prisma } from "@/lib/prisma";
import { isAllowedEmbedUrl, toEmbedUrl } from "@/lib/marketing/brochure-embed";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface BrochureGalleryItemDTO {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
}

export interface BrochureReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  authorFirstName: string;
}

export interface PublicBrochureDTO {
  slug: string;
  title: string;
  subtitle: string | null;
  seoDescription: string | null;
  heroImageUrl: string | null;
  /** Embed-safe (host-allowlisted) iframe src, or null. */
  videoEmbedUrl: string | null;
  tour360Url: string | null;
  galleryItems: BrochureGalleryItemDTO[];
  reviews: BrochureReviewDTO[];
  startingFromAmount: number | null;
  currency: string;
  enabledCtas: string[];
  whatsappNumber: string | null;
  /** venueId only when the venue is active + bookable (drives Hold/Visit CTAs). */
  venueId: string | null;
}

/**
 * Load ONE published brochure by its public slug, resolving curated proof by
 * re-querying GalleryItem (isPublic) + Review (isApproved & isPublic). Returns
 * a sanitised DTO. Null/404 when missing, unpublished, or its venue is inactive.
 */
export async function getPublicBrochure(slug: string): Promise<Result<PublicBrochureDTO>> {
  try {
    const normalized = (slug ?? "").trim().toLowerCase();
    if (!normalized) return { success: false, error: "Not found." };

    const brochure = await prisma.digitalBrochure.findUnique({
      where: { slug: normalized },
      select: {
        slug: true,
        title: true,
        subtitle: true,
        seoDescription: true,
        heroImageUrl: true,
        videoEmbedUrl: true,
        tour360Url: true,
        galleryItemIds: true,
        reviewIds: true,
        startingFromAmount: true,
        currency: true,
        enabledCtas: true,
        whatsappNumber: true,
        isPublished: true,
        venueId: true,
      },
    });

    if (!brochure || !brochure.isPublished) {
      return { success: false, error: "Not found." };
    }

    // Venue lifecycle guard: if the brochure pins a venue, it must be active —
    // otherwise we'd offer Hold/Visit CTAs on an unbookable venue. 404 instead.
    let activeVenueId: string | null = null;
    if (brochure.venueId) {
      const venue = await prisma.venue.findFirst({
        where: { id: brochure.venueId, isActive: true },
        select: { id: true },
      });
      if (!venue) return { success: false, error: "Not found." };
      activeVenueId = venue.id;
    }

    // Curated proof — re-filter by live moderation flags so stale ids can't
    // resurrect un-approved / private content. Preserve the curator's ordering.
    const [galleryRows, reviewRows] = await Promise.all([
      brochure.galleryItemIds.length
        ? prisma.galleryItem.findMany({
            where: { id: { in: brochure.galleryItemIds }, isPublic: true },
            select: { id: true, mediaType: true, url: true, thumbnailUrl: true, title: true },
          })
        : Promise.resolve([]),
      brochure.reviewIds.length
        ? prisma.review.findMany({
            where: { id: { in: brochure.reviewIds }, isApproved: true, isPublic: true },
            select: {
              id: true,
              rating: true,
              title: true,
              content: true,
              contact: { select: { firstName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const galleryById = new Map(galleryRows.map((g) => [g.id, g]));
    const galleryItems: BrochureGalleryItemDTO[] = brochure.galleryItemIds
      .map((id) => galleryById.get(id))
      .filter((g): g is (typeof galleryRows)[number] => Boolean(g))
      .map((g) => ({
        id: g.id,
        mediaType: g.mediaType,
        url: g.url,
        thumbnailUrl: g.thumbnailUrl,
        title: g.title,
      }));

    const reviewById = new Map(reviewRows.map((r) => [r.id, r]));
    const reviews: BrochureReviewDTO[] = brochure.reviewIds
      .map((id) => reviewById.get(id))
      .filter((r): r is (typeof reviewRows)[number] => Boolean(r))
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        // First name only — never the full reviewer identity.
        authorFirstName: (r.contact?.firstName ?? "Guest").trim().split(/\s+/)[0] || "Guest",
      }));

    // Re-validate embed hosts at the boundary (defence-in-depth) and normalise
    // to an embeddable src; off-allowlist or malformed → omit.
    const videoEmbedUrl = isAllowedEmbedUrl(brochure.videoEmbedUrl)
      ? toEmbedUrl(brochure.videoEmbedUrl)
      : null;
    const tour360Url = isAllowedEmbedUrl(brochure.tour360Url)
      ? toEmbedUrl(brochure.tour360Url)
      : null;

    return {
      success: true,
      data: {
        slug: brochure.slug,
        title: brochure.title,
        subtitle: brochure.subtitle,
        seoDescription: brochure.seoDescription,
        heroImageUrl: brochure.heroImageUrl,
        videoEmbedUrl,
        tour360Url,
        galleryItems,
        reviews,
        startingFromAmount:
          brochure.startingFromAmount != null ? Number(brochure.startingFromAmount) : null,
        currency: brochure.currency,
        enabledCtas: brochure.enabledCtas as string[],
        whatsappNumber: brochure.whatsappNumber,
        venueId: activeVenueId,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_BROCHURE_ERROR]", error);
    return { success: false, error: "Failed to load." };
  }
}

/**
 * Best-effort vanity view bump. Called from the page via after() so a slow
 * write never blocks render. Never throws; under-counting is acceptable (do not
 * use for billing).
 */
export async function bumpBrochureView(slug: string): Promise<void> {
  try {
    const normalized = (slug ?? "").trim().toLowerCase();
    if (!normalized) return;
    await prisma.digitalBrochure.updateMany({
      where: { slug: normalized, isPublished: true },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
  } catch (error) {
    console.error("[BUMP_BROCHURE_VIEW_ERROR]", error);
  }
}
