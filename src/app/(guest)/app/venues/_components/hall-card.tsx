"use client";

import * as React from "react";
import { MapPin, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink, useNav } from "../../../_components/nav-transition";
import { SaveButton } from "../../../_components/shortlist";
import { formatPrice, hallPriceText, inr } from "../../../_components/format";
import { availabilityChip, formatSearchDate, type HallAvailability } from "../_lib/hall-search";
import { PhotoCarousel, type CarouselPhoto } from "./photo-carousel";

// ============================================================
// One hall, as a card. The feed and the home screen's rail render the SAME
// component (variant="feed" | "rail"), so a hall can never look like two
// different halls on two screens.
//
// Every line is a record the team keeps: the hall's own photos (or a labelled
// illustration), its capacity, the address only when the team has filled one
// in, the amenities it lists, the team's pricing engine, approved public
// reviews, and — only when a date is searched — the availability the booking
// flow itself enforces. Anything missing is left out; nothing is filled in.
// ============================================================

/** The shape the feed action returns (GuestHallFeedItem is assignable to this). */
export interface HallCardHall {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  amenities: string[];
  locality: string | null;
  photos: CarouselPhoto[];
  priceFrom: number | null;
  perGuestRate: number;
  priceForDate: number | null;
  availability: HallAvailability | null;
  freeSlots: string[];
  rating: { rating: number; count: number } | null;
}

export interface HallCardProps {
  hall: HallCardHall;
  /** "feed" = the full-width discovery card; "rail" = the fixed-width card in a horizontal row. */
  variant?: "feed" | "rail";
  /** The searched date, so the card can price and label that day. Null = no date searched. */
  dateISO?: string | null;
  /** The searched slot, so the availability chip speaks about that slot alone. */
  slot?: string | null;
  /** An amenity the customer filtered on — shown first among the highlights. */
  matchAmenity?: string | null;
  /** Where the card goes; defaults to the hall's page. */
  href?: string;
  /** The first card on screen: its first picture loads eagerly. */
  eager?: boolean;
  className?: string;
}

const TONE_CLASS = {
  green: "bg-[#e6f6ea] text-[#177c37]",
  amber: "bg-[#fdf3e1] text-[#a15f00]",
  grey: "bg-[#e9e9ec] text-[#4b4b50]",
} as const;

/** The price, in the app's one wording. Never ₹0, never a figure the engine did not give. */
function priceLine(hall: HallCardHall, dateISO: string | null): { main: string; sub: string | null } {
  const perGuest = hall.perGuestRate > 0 ? `+ ${inr(hall.perGuestRate)} per guest` : null;
  if (dateISO && hall.priceForDate != null && hall.priceForDate > 0) {
    return {
      main: `from ${formatPrice(hall.priceForDate)}`,
      sub: `per slot on ${formatSearchDate(dateISO)}${perGuest ? ` · ${perGuest}` : ""}`,
    };
  }
  const text = hallPriceText({ fromSlotPrice: hall.priceFrom, perGuestRate: hall.perGuestRate });
  return { main: text.main, sub: text.sub };
}

/** Two or three amenities, the searched one first — the team's own labels, never a category we invented. */
function highlights(hall: HallCardHall, matchAmenity: string | null, max: number): string[] {
  const key = matchAmenity?.trim().toLowerCase();
  const matched = key ? hall.amenities.filter((a) => a.trim().toLowerCase() === key) : [];
  const rest = key ? hall.amenities.filter((a) => a.trim().toLowerCase() !== key) : hall.amenities;
  return [...matched, ...rest].slice(0, max);
}

export function HallCard({
  hall,
  variant = "feed",
  dateISO = null,
  slot = null,
  matchAmenity = null,
  href,
  eager,
  className,
}: HallCardProps) {
  const go = useNav();
  const rail = variant === "rail";
  const target = href ?? `/app/venues/${hall.id}`;
  const price = priceLine(hall, dateISO);
  const chip = availabilityChip(hall.availability, hall.freeSlots, slot);
  const amenities = highlights(hall, matchAmenity, rail ? 2 : 3);

  // Unique per card, so a screen reader can list the halls by name. The variant
  // is in the id because the home screen could one day show a hall in the rail
  // and in a grid on the same page, and two elements may not share an id.
  const nameId = `hall-${rail ? "rail" : "feed"}-${hall.id}`;

  return (
    <article
      aria-labelledby={nameId}
      className={cn(
        "vg-press relative overflow-hidden rounded-[20px] border border-black/[.06] bg-white shadow-[0_12px_28px_-20px_rgba(29,29,31,.25)]",
        rail && "w-[268px] shrink-0",
        className
      )}
    >
      <div className={cn("relative", rail ? "h-[150px]" : "h-[206px]")}>
        <PhotoCarousel
          photos={hall.photos}
          name={hall.name}
          seed={hall.id}
          eager={eager}
          onOpen={() => go(target, "push")}
          badgeClassName="bottom-3 right-3"
        />
        {/* Labels only — they never swallow a tap meant for the picture. */}
        <SaveButton venueId={hall.id} className="absolute right-3 top-3 z-20 size-9 shadow-[0_1px_6px_rgba(0,0,0,.18)]" />
        {/* Top-LEFT: the save button already owns top-right, and this pill does
            not take pointer events, so sharing a corner would have made the
            heart untappable on every hall that has a rating. */}
        {hall.rating && (
          <span
            aria-label={`Rated ${hall.rating.rating} out of 5, ${hall.rating.count} ${hall.rating.count === 1 ? "review" : "reviews"}`}
            className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-white/[.94] px-2.5 py-1 text-meta font-semibold text-[#1d1d1f] backdrop-blur"
          >
            <Star className="size-3 fill-[#b88513] text-[#b88513]" aria-hidden />
            <span className="numeric">{hall.rating.rating}</span>
            <span className="font-medium text-[#6e6e73]">({hall.rating.count})</span>
          </span>
        )}
        {chip && (
          <span className={cn("pointer-events-none absolute bottom-3 left-3 z-20 inline-flex items-center rounded-full px-2.5 py-1 text-meta font-semibold", TONE_CLASS[chip.tone])}>
            {chip.label}
          </span>
        )}
      </div>

      {/* The card's real link. The outline is inset because the card clips its corners. */}
      <NavLink
        href={target}
        kind="push"
        className={cn(
          "block text-[#1d1d1f] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#6d1b52]",
          rail ? "px-3.5 py-3" : "px-4 py-3.5"
        )}
      >
        {/* h2: both callers (the feed and the home rail) put these directly
            under the screen's own h1, so the outline stays in order. */}
        <h2 id={nameId} className={cn("truncate font-semibold", rail ? "text-copy" : "text-lede")}>
          {hall.name}
        </h2>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-detail text-[#6e6e73]">
          <Users className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
          <span className="shrink-0">Up to {hall.capacity.toLocaleString("en-IN")} guests</span>
          {hall.locality && (
            <>
              <span aria-hidden className="shrink-0 text-[#c7c7cc]">·</span>
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              <span className="truncate">{hall.locality}</span>
            </>
          )}
        </div>

        {!rail && hall.description && <p className="mt-1 truncate text-detail text-[#636368]">{hall.description}</p>}

        {amenities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <span key={a} className="inline-flex max-w-full items-center truncate rounded-full bg-[#f7eef2] px-2.5 py-1 text-meta font-semibold text-[#6d1b52]">
                {a}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className={cn("font-semibold text-[#6d1b52]", price.sub ? "numeric text-copy" : "text-detail")}>{price.main}</span>
          {price.sub && <span className="text-meta text-[#636368]">{price.sub}</span>}
        </div>
      </NavLink>
    </article>
  );
}
