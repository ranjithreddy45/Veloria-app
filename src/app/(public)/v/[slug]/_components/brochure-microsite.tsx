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
      <section className="bg-card shadow-card overflow-hidden rounded-3xl border">
        {brochure.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brochure.heroImageUrl}
            alt={brochure.title}
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="h-40 w-full bg-zinc-950 sm:h-52" />
        )}
        <div className="px-6 py-9 text-center">
          <h1 className="text-foreground text-[30px] sm:text-[36px]">
            {brochure.title}
          </h1>
          {brochure.subtitle && (
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
              {brochure.subtitle}
            </p>
          )}
          {brochure.startingFromAmount != null && (
            <div className="bg-muted mt-6 inline-flex items-baseline gap-2 rounded-full px-4 py-2">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]">
                Starting from
              </span>
              <span
                className="numeric text-[16px] font-semibold"
                style={{ color: "var(--brand)" }}
              >
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
                className="bg-muted aspect-square overflow-hidden rounded-xl"
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
    <h2 className="font-editorial text-foreground mb-5 text-center text-[24px] font-semibold">
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
    <div className="overflow-hidden rounded-2xl border bg-black">
      <div className="flex items-center gap-1.5 bg-zinc-900 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
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
    <div className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
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
        <p className="text-foreground text-sm font-semibold">{r.title}</p>
      )}
      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{r.content}</p>
      <p className="mt-3 text-muted-foreground text-xs font-medium">— {r.authorFirstName}</p>

      {total > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => go(-1)}
            aria-label="Previous testimonial"
            className="hover:bg-muted rounded-full border p-1.5 transition-colors"
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
            className="hover:bg-muted rounded-full border p-1.5 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
