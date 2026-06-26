// ============================================================
// Social-proof shared serializable shapes — PUBLIC-safe.
// ------------------------------------------------------------
// These slim interfaces are the SINGLE SOURCE OF TRUTH for what an
// unauthenticated funnel page (configurator, hold, pay, quote, storefront)
// is allowed to see about a Review / GalleryItem. They intentionally carry
// only ids/labels/urls and a reviewer FIRST name — never contact email/phone,
// last name, bookingId, contactId or any internal field.
//
// Both the public fetcher (lib/public/social-proof.ts) and the presentational
// <SocialProofStrip> component import from here, so a customer-facing page
// never has to touch an internal Prisma model.
// ============================================================

/** A single approved 5★ review, projected to public-safe fields only. */
export interface PublicReview {
  id: string;
  /** Reviewer's FIRST name only (e.g. "Aarav"). Never last name / contact PII. */
  reviewerFirstName: string;
  /** 1–5; the public strip only ever shows 5★ rows but the field is carried. */
  rating: number;
  title: string | null;
  /** Truncated review body — capped server-side to avoid leaking long PII. */
  content: string;
  /** Human label of the event type this review's booking was for, if known. */
  eventTypeLabel: string | null;
  /** When the venue responded (proof of engagement), ISO string or null. */
  respondedAt: string | null;
  /** ISO date the review was created — for "recent" ordering / display. */
  createdAt: string;
}

/** A single public gallery photo/video, projected to render-safe fields only. */
export interface PublicGalleryPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  /** "PHOTO" | "VIDEO" — drives <img> vs video poster rendering. */
  mediaType: string;
}

/** Aggregate headline numbers for the "4.9★ from N events" line. */
export interface SocialProofAggregate {
  averageRating: number; // e.g. 4.9 (1-decimal)
  totalCount: number; // number of approved+public reviews considered
}

/** The full bundle returned by getSocialProof and consumed by the strip. */
export interface SocialProofData {
  reviews: PublicReview[];
  photos: PublicGalleryPhoto[];
  aggregate: SocialProofAggregate;
}

/** Visual density variants of the strip across the funnel surfaces. */
export type SocialProofVariant = "inline" | "banner" | "gallery";

/** Inputs accepted by the public fetcher / action (no raw where-clauses). */
export interface SocialProofQuery {
  eventType?: string;
  venueId?: string;
  limit?: number;
}

/** An empty, render-safe bundle — returned on any error (never throws). */
export const EMPTY_SOCIAL_PROOF: SocialProofData = {
  reviews: [],
  photos: [],
  aggregate: { averageRating: 0, totalCount: 0 },
};
