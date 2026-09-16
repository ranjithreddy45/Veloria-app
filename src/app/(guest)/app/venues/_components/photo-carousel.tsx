"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { VenueImage } from "../../../_components/venue-image";
import { IllustrationBadge } from "../../../_components/ui";
import { hallCover } from "../../../_components/stock";
import { carouselGroupLabel, describeCarouselSlide, type CarouselSlide } from "./carousel-photo";

// ============================================================
// The photo area of a hall card — swipeable when the hall has pictures,
// a labelled illustration when it has none.
//
// Honesty first, per picture. `photos` are that hall's OWN published pictures,
// but a bundled illustration can be published as a gallery item, so every
// slide is checked on its own (describeCarouselSlide): an illustration carries
// the visible "Illustration" label and says so in its alt text, wherever it
// appears and whatever it sits next to. A hall with no pictures at all gets
// the bundled illustration for the hall, labelled, with no dots — so nothing
// can read as a photo set of a hall we have no photos of.
//
// Swiping is native scroll-snap (no gesture library, no scroll-jacking), the
// dots and arrow keys drive the same scroller, images after the first load
// lazily, and a picture that fails to load falls back to the brand gradient
// rather than a broken-image glyph.
//
// Accessibility: one tab stop for the whole carousel (the track), arrow keys
// and Home/End move between pictures, the position is spoken as it changes
// ("Photo 2 of 5"), every image has real alt text, and prefers-reduced-motion
// turns off both the scroll animation and the dot transition.
// ============================================================

export interface CarouselPhoto {
  url: string;
  title: string | null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PhotoCarousel({
  photos,
  name,
  seed,
  className,
  eager,
  onOpen,
  badgeClassName,
}: {
  /** The hall's own pictures. Empty renders the labelled illustration. */
  photos: readonly CarouselPhoto[];
  /** The hall's name — the accessible label for its pictures. */
  name: string;
  /** Hall id: picks the hall's stable illustration. */
  seed: string;
  className?: string;
  /** First card on the screen: its first picture loads eagerly. */
  eager?: boolean;
  /** Tapping the picture (as opposed to swiping it) opens the hall. */
  onOpen?: () => void;
  /** Where the "Illustration" label sits. */
  badgeClassName?: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const downAt = React.useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = React.useState(0);
  const count = photos.length;

  // Per-picture verdicts: which slides are illustrations, and what each says.
  const slides: CarouselSlide[] = React.useMemo(
    () => photos.map((p, i) => describeCarouselSlide(p, name, i, photos.length)),
    [photos, name]
  );

  const goTo = React.useCallback(
    (next: number) => {
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const clamped = Math.max(0, Math.min(count - 1, next));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      setIndex(clamped);
    },
    [count]
  );

  const onScroll = React.useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const at = Math.round(el.scrollLeft / el.clientWidth);
    setIndex((prev) => (prev === at ? prev : Math.max(0, Math.min(count - 1, at))));
  }, [count]);

  // No picture of this hall at all: one illustration, labelled, nothing swipeable.
  if (count === 0) {
    const cover = hallCover(null, seed);
    return (
      <VenueImage
        seed={seed}
        alt={`Illustration, not a photo of ${name}`}
        name={name}
        src={cover.src}
        illustration
        badgeClassName={badgeClassName ?? "bottom-3 right-3"}
        className={cn("h-full w-full", className)}
      />
    );
  }

  const multiple = count > 1;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        role="group"
        aria-label={carouselGroupLabel(name, slides)}
        tabIndex={multiple ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(index - 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            goTo(0);
          } else if (e.key === "End") {
            e.preventDefault();
            goTo(count - 1);
          } else if ((e.key === "Enter" || e.key === " ") && onOpen) {
            e.preventDefault();
            onOpen();
          }
        }}
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          // A tap opens the hall; a swipe does not. (The card's title below is
          // the real, labelled link — this is a convenience for pointers.)
          const from = downAt.current;
          downAt.current = null;
          if (!onOpen || !from) return;
          if (Math.abs(e.clientX - from.x) > 8 || Math.abs(e.clientY - from.y) > 8) return;
          onOpen();
        }}
        className={cn(
          "flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden outline-none",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          multiple && "focus-visible:ring-2 focus-visible:ring-[#6d1b52] focus-visible:ring-inset"
        )}
      >
        {photos.map((p, i) => (
          <div
            key={`${p.url}-${i}`}
            className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden bg-gradient-to-br from-[#7a2160] via-[#6d1b52] to-[#4d1239]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photos are served as data URLs through /api/guest/photo, which the image optimiser cannot take (same reason VenueImage paints a background). */}
            <img
              src={p.url}
              alt={slides[i].alt}
              loading={i === 0 && eager ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onError={(e) => {
                // A missing file shows the brand gradient, never a broken glyph.
                e.currentTarget.style.visibility = "hidden";
              }}
              className="h-full w-full object-cover"
            />
            {/* Per picture, not per mode: a bundled illustration says so even when
                it arrives as a published gallery item alongside real photos. */}
            {slides[i].illustration && <IllustrationBadge className={cn("absolute z-10", badgeClassName ?? "bottom-3 right-3")} />}
          </div>
        ))}
      </div>

      {/* Scrim so the heart, the rating and the dots stay legible on a bright photo. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" />

      {multiple && (
        <>
          {/* Swiping moves a value nothing is focused on, so the position is spoken. */}
          <span aria-live="polite" className="sr-only">
            Photo {index + 1} of {count}
            {slides[index].illustration ? ", an illustration rather than a photo of this hall" : ""}
          </span>
          <div className="absolute inset-x-0 bottom-2.5 z-20 flex justify-center gap-0.5">
            {photos.map((p, i) => (
              <button
                key={`dot-${p.url}-${i}`}
                type="button"
                // One tab stop per carousel: the track itself, driven with the arrow keys.
                tabIndex={-1}
                aria-label={`Photo ${i + 1} of ${count}`}
                aria-current={i === index}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className="flex size-5 items-center justify-center"
              >
                <span
                  className={cn(
                    // A dark halo so the dots clear 3:1 on a bright photo too.
                    "block h-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,.55)] transition-all duration-200 motion-reduce:transition-none",
                    i === index ? "w-4 bg-white" : "w-1.5 bg-white/75"
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
