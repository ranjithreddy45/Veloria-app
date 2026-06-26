"use client";

import * as React from "react";
import { Star, Quote, ChevronLeft, ChevronRight, Play, Box } from "lucide-react";

import { formatINR } from "@/lib/utils";
import type { PublicBrochureDTO } from "@/actions/brochure-public.actions";
import { BrochureCtas } from "./brochure-ctas";

// ============================================================
// Immersive, mobile-first brochure microsite (public, no auth).
// ------------------------------------------------------------
// Sections: hero → optional sandboxed video/360 embeds → curated gallery grid →
// "starting from" price teaser → testimonials carousel → sticky CTA bar.
// Everything is pre-shaped + sanitised by getPublicBrochure; no internal data.
// Brand accent applied via the --brand CSS-var idiom (see white-label-shell).
// ============================================================

const ACCENT = "#7c3aed"; // brand violet; brochures don't carry a per-venue hex

export function BrochureMicrosite({ brochure }: { brochure: PublicBrochureDTO }) {
  const hasMedia = !!brochure.videoEmbedUrl || !!brochure.tour360Url;

  return (
    <div
      className="space-y-10 pb-4"
      style={{ ["--brand" as string]: ACCENT } as React.CSSProperties}
    >
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {brochure.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brochure.heroImageUrl}
            alt={brochure.title}
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div
            className="h-40 w-full sm:h-52"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #db2777)`,
            }}
          />
        )}
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            {brochure.title}
          </h1>
          {brochure.subtitle && (
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {brochure.subtitle}
            </p>
          )}
          {brochure.startingFromAmount != null && (
            <div className="mt-4 inline-flex items-baseline gap-1.5 rounded-full bg-zinc-100 px-4 py-1.5 dark:bg-zinc-800">
              <span className="text-xs text-zinc-500">Starting from</span>
              <span className="text-base font-bold tabular-nums" style={{ color: "var(--brand)" }}>
                {formatINR(brochure.startingFromAmount)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Immersive media — sandboxed, lazy, host-allowlisted iframes */}
      {hasMedia && (
        <section className="space-y-4">
          {brochure.videoEmbedUrl && (
            <EmbedFrame
              src={brochure.videoEmbedUrl}
              title={`${brochure.title} — video`}
              icon={<Play className="size-3.5" />}
              label="Video tour"
            />
          )}
          {brochure.tour360Url && (
            <EmbedFrame
              src={brochure.tour360Url}
              title={`${brochure.title} — 360° tour`}
              icon={<Box className="size-3.5" />}
              label="360° walkthrough"
            />
          )}
        </section>
      )}

      {/* Curated gallery */}
      {brochure.galleryItems.length > 0 && (
        <section>
          <SectionHeading>Gallery</SectionHeading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {brochure.galleryItems.map((g) => (
              <div
                key={g.id}
                className="aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.thumbnailUrl || g.url}
                  alt={g.title || brochure.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {brochure.reviews.length > 0 && (
        <section>
          <SectionHeading>What couples say</SectionHeading>
          <TestimonialCarousel reviews={brochure.reviews} />
        </section>
      )}

      {/* CTA bar (sticky) */}
      <BrochureCtas
        ctas={brochure.enabledCtas}
        venueId={brochure.venueId}
        whatsappNumber={brochure.whatsappNumber}
        title={brochure.title}
        accent={ACCENT}
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
      {children}
    </h2>
  );
}

function EmbedFrame({
  src,
  title,
  icon,
  label,
}: {
  src: string;
  title: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-black dark:border-zinc-800">
      <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300">
        {icon} {label}
      </div>
      <div className="aspect-video w-full">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className="h-full w-full"
          // Host is allowlisted server-side; sandbox + permissive only for media.
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; xr-spatial-tracking"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function TestimonialCarousel({
  reviews,
}: {
  reviews: PublicBrochureDTO["reviews"];
}) {
  const [idx, setIdx] = React.useState(0);
  const total = reviews.length;
  const r = reviews[idx];

  const go = (delta: number) => setIdx((i) => (i + delta + total) % total);

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Quote className="mb-3 size-6" style={{ color: "var(--brand)" }} />
      <div className="mb-2 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="size-4"
            style={{ color: i < r.rating ? "var(--brand)" : "#d4d4d8" }}
            fill={i < r.rating ? "currentColor" : "none"}
          />
        ))}
      </div>
      {r.title && (
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</p>
      )}
      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{r.content}</p>
      <p className="mt-3 text-xs font-medium text-zinc-500">— {r.authorFirstName}</p>

      {total > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => go(-1)}
            aria-label="Previous testimonial"
            className="rounded-full border border-zinc-200 p-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex gap-1.5">
            {reviews.map((rv, i) => (
              <span
                key={rv.id}
                className="size-1.5 rounded-full transition-colors"
                style={{ backgroundColor: i === idx ? "var(--brand)" : "#d4d4d8" }}
              />
            ))}
          </div>
          <button
            onClick={() => go(1)}
            aria-label="Next testimonial"
            className="rounded-full border border-zinc-200 p-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
