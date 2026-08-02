import { Star, Quote, BadgeCheck } from "lucide-react";
import type { SocialProofData, SocialProofVariant } from "@/lib/public/social-proof-types";

// ============================================================
// SocialProofStrip — reusable, presentational, PUBLIC-safe.
// ------------------------------------------------------------
// Renders matched approved 5★ reviews + past-event photos at the decision
// moment on a customer-facing funnel surface. Pure props in (no data fetch),
// so it can be used in a server OR client component. It never links to an
// internal route and only ever renders the slim public projection.
//
// Renders NOTHING when both reviews and photos are empty, so a proof-query
// failure (which returns empty arrays) silently vanishes rather than breaking
// the surface.
//
// Variants control density:
//   inline  — narrow aside (configurator next to PriceSummary)
//   banner  — full-width strip above a Pay/Hold card
//   gallery — storefront gallery emphasis (more photos)
// ============================================================

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? "size-3.5 fill-amber-400 text-amber-400"
              : "size-3.5 fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
          }
        />
      ))}
    </span>
  );
}

export function SocialProofStrip({
  data,
  variant = "banner",
  heading,
  className,
}: {
  data: SocialProofData;
  variant?: SocialProofVariant;
  heading?: string;
  className?: string;
}) {
  const { reviews, photos, aggregate } = data;
  if (reviews.length === 0 && photos.length === 0) return null;

  const showAggregate = aggregate.totalCount > 0 && aggregate.averageRating > 0;
  // Photo grid columns by variant.
  const photoCols =
    variant === "gallery"
      ? "grid-cols-3 sm:grid-cols-4"
      : variant === "inline"
        ? "grid-cols-3"
        : "grid-cols-4";
  const photoCap = variant === "inline" ? 3 : variant === "gallery" ? 8 : 4;
  const reviewCap = variant === "inline" ? 2 : variant === "gallery" ? 4 : 3;

  return (
    <section
      className={[
        "rounded-2xl border border-zinc-200/70 bg-white/70 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60",
        variant === "banner" ? "shadow-sm" : "",
        className || "",
      ].join(" ")}
      aria-label="What our guests say"
    >
      {/* Headline */}
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-body font-semibold text-zinc-900 dark:text-zinc-100">
          <BadgeCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          {heading || "Loved by guests like you"}
        </p>
        {showAggregate && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-detail font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {aggregate.averageRating.toFixed(1)}
            <span className="font-medium text-amber-600/80 dark:text-amber-400/80">
              · {aggregate.totalCount} {aggregate.totalCount === 1 ? "review" : "reviews"}
            </span>
          </span>
        )}
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <ul className={variant === "inline" ? "mt-3 space-y-2.5" : "mt-3 grid gap-2.5 sm:grid-cols-2"}>
          {reviews.slice(0, reviewCap).map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30"
            >
              <div className="flex items-center justify-between gap-2">
                <Stars rating={Math.min(5, Math.max(0, r.rating))} />
                {r.eventTypeLabel && (
                  <span className="truncate text-meta font-medium text-zinc-400">
                    {r.eventTypeLabel}
                  </span>
                )}
              </div>
              <p className="mt-2 flex gap-1.5 text-detail leading-relaxed text-zinc-600 dark:text-zinc-300">
                <Quote className="mt-0.5 size-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                <span className="line-clamp-4">{r.content}</span>
              </p>
              <p className="mt-2 text-meta font-semibold text-zinc-500 dark:text-zinc-400">
                — {r.reviewerFirstName}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className={`mt-3 grid gap-1.5 ${photoCols}`}>
          {photos.slice(0, photoCap).map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumbnailUrl || p.url}
                alt={p.title || "Past event at Veloria Grand"}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 hover:scale-105"
              />
              {p.mediaType === "VIDEO" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white/90 text-zinc-900">
                    ▶
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
