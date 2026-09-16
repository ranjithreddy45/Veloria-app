import { notFound } from "next/navigation";
import { ArrowLeftRight, Car, ChevronRight, CirclePlay, ExternalLink, MapPin, Navigation, Rotate3d, Star, UtensilsCrossed } from "lucide-react";
import { NavLink } from "../../../_components/nav-transition";
import { Card, IconTile } from "../../../_components/ui";
import { getStorefrontVenue, getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestHallInfo, getGuestHallPrices, getGuestPhotos, getGuestVenueSocial } from "@/actions/guest-public.actions";
import { ContactChip } from "../../../_components/contact-chip";
import { hallPriceText } from "../../../_components/format";
import { hallCover } from "../../../_components/stock";
import { PlanLinks } from "../_components/plan-links";
import { compareHref } from "../_lib/links";
import { HallBooking } from "./_components/hall-booking";
import { PhotoHeader } from "./_components/photo-header";
import { AmenityIcon, hallAmenities } from "./_lib/amenities";
import { addressLocality } from "./_lib/locality";

// ============================================================
// One hall, in the order a customer decides in: see it, read what it is and
// who it fits, see what it comes with, check a date, and reserve.
//
// Every section is drawn from records and disappears when the record is
// empty: no photos means one labelled illustration and a plain sentence; no
// reviews means no rating and no review section at all; an address, parking
// note, directions, video or virtual tour appears only once the team has
// filled that field. The booking control carries the price and the way in to
// the reserve flow, and never claims a date is free or held.
//
// Shape: one column on a phone or tablet, with the control as a bar across the
// foot. At 1024px and up HallBooking splits the page — these sections on the
// left, the booking card sticky on the right — so `before` is everything above
// the calendar and `after` everything below it.
// ============================================================

export const revalidate = 60;

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <IconTile size={32}>{icon}</IconTile>
      <div className="min-w-0 flex-1 text-body leading-[1.5] text-[#1d1d1f]">
        <div className="text-meta font-semibold uppercase tracking-[.06em] text-[#636368]">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-copy font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export default async function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();
  const [photos, social, infos, prices, halls] = await Promise.all([
    getGuestPhotos({ venueId, limit: 12 }),
    getGuestVenueSocial(venueId),
    getGuestHallInfo([venueId]),
    getGuestHallPrices([venueId]),
    getStorefrontVenues(),
  ]);
  const info = infos[venue.id] ?? null;
  const price = hallPriceText(prices[venue.id]);
  // Real photos only, or one labelled illustration — never a mix, never a photo count.
  const cover = hallCover(photos[0]?.url ?? null, venue.id);
  const amenities = hallAmenities(venue.amenities);
  // The place beside the capacity comes from this hall's OWN public address;
  // the venue-wide fallback address is shown under "Getting here" instead, where
  // it is labelled for what it is.
  const locality = info?.address?.source === "HALL" ? addressLocality(info.address.text) : null;
  const hasReviews = social.rating != null && social.count > 0;
  const base = `/app/venues/${venue.id}`;
  const reviewsHref = `${base}/reviews`;
  const canCompare = halls.some((h) => h.id !== venue.id);
  const video = info?.video ?? null;
  const tourHref = info?.virtualTourHref ?? null;
  const mediaTitle = video && tourHref ? "Video and virtual tour" : video ? "Video" : "Virtual tour";
  const hasDirections = !!(info && (info.address || info.directionsNote || info.parkingInfo));

  // 2 — what this hall is, and 3 — what it comes with.
  const before = (
    <>
      <section>
        <h1 className="font-editorial text-[29px] font-semibold leading-[1.1] tracking-[-.018em] sm:text-[34px] lg:text-[38px]">{venue.name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-detail text-[#6e6e73]">
          <span>Up to {venue.capacity.toLocaleString("en-IN")} guests</span>
          {locality && (
            <>
              <span aria-hidden>·</span>
              <span>{locality}</span>
            </>
          )}
          {hasReviews && (
            <>
              <span aria-hidden>·</span>
              <NavLink href={reviewsHref} kind="push" className="inline-flex items-center gap-x-1.5">
                <Star className="size-3.5 fill-[#b88513] text-[#b88513]" aria-hidden />
                <span className="font-semibold text-[#1d1d1f]">{social.rating}</span>
                <span className="underline decoration-black/20 underline-offset-2">
                  {social.count} review{social.count === 1 ? "" : "s"}
                </span>
              </NavLink>
            </>
          )}
        </div>
        {cover.isStock && (
          <p className="mt-3 max-w-[70ch] text-meta leading-[1.5] text-[#636368]">
            The picture above is an illustration. We haven&apos;t published photos of {venue.name} yet — our own go here as
            soon as the team shoots them.
          </p>
        )}
        {venue.description && <p className="mt-3 max-w-[70ch] text-body leading-[1.6] text-[#3a3a3c]">{venue.description}</p>}
      </section>

      {amenities.length > 0 && (
        <section>
          <SectionHeading>What this space offers</SectionHeading>
          <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {amenities.map((a, i) => (
              <li key={`${a.label}-${i}`} className="vg-card flex items-start gap-2.5 rounded-[14px] px-3 py-3">
                <IconTile size={28}>
                  <AmenityIcon iconKey={a.iconKey} className="size-[15px]" />
                </IconTile>
                <span className="min-w-0 break-words text-detail font-medium leading-[1.35] text-[#1d1d1f]">{a.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  // 6 — the practical facts, each only once the team has filled it in — then
  // reviews, the compare shortcut and the price note.
  const after = (
    <>
      {info?.inHouseCateringRequired && (
        <Card className="flex items-start gap-3 p-4">
          <IconTile tone="gold" size={36}>
            <UtensilsCrossed className="size-[18px]" aria-hidden />
          </IconTile>
          <div className="min-w-0">
            <div className="text-body font-semibold">In-house catering</div>
            <p className="mt-0.5 text-detail leading-[1.5] text-[#3a3a3c]">
              {info.inHouseCateringNote ?? "Food must be purchased from the hall's own caterer."}
            </p>
          </div>
        </Card>
      )}

      {hasDirections && info && (
        <section>
          <SectionHeading>Getting here</SectionHeading>
          <Card className="vg-divide mt-2.5 overflow-hidden">
            {info.address && (
              <InfoRow icon={<MapPin className="size-4" aria-hidden />} label={info.address.source === "HALL" ? "Hall address" : "Venue address"}>
                {info.address.text && <p className="whitespace-pre-line">{info.address.text}</p>}
                {info.address.mapHref && (
                  <a
                    href={info.address.mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-detail font-semibold text-[#6d1b52]"
                  >
                    Open in Maps <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </InfoRow>
            )}
            {info.directionsNote && (
              <InfoRow icon={<Navigation className="size-4" aria-hidden />} label="Directions">
                <p className="whitespace-pre-line">{info.directionsNote}</p>
              </InfoRow>
            )}
            {info.parkingInfo && (
              <InfoRow icon={<Car className="size-4" aria-hidden />} label="Parking">
                <p className="whitespace-pre-line">{info.parkingInfo}</p>
              </InfoRow>
            )}
          </Card>
        </section>
      )}

      {(video || tourHref) && (
        <section>
          <SectionHeading>{mediaTitle}</SectionHeading>
          {video && video.kind !== "link" && (
            <div className="mt-2.5 aspect-video overflow-hidden rounded-2xl bg-[#1d1d1f]">
              <iframe
                src={video.embedUrl}
                title={`${venue.name} video`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
          )}
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {video && video.kind === "link" && (
              <a
                href={video.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[.08] bg-white px-5 py-3.5 text-body font-semibold text-[#1d1d1f]"
              >
                <CirclePlay className="size-4" aria-hidden /> Watch the video{" "}
                <ExternalLink className="size-3.5 text-[#636368]" aria-hidden />
              </a>
            )}
            {tourHref && (
              <a
                href={tourHref}
                target="_blank"
                rel="noopener noreferrer"
                className="vg-primary vg-press inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-body font-semibold"
              >
                <Rotate3d className="size-4" aria-hidden /> Take the virtual tour
              </a>
            )}
          </div>
        </section>
      )}

      <section>
        <SectionHeading>Plan your visit</SectionHeading>
        <PlanLinks className="mt-2.5" venueId={venue.id} quoteVenueId={venue.id} showQuote={!info?.inHouseCateringRequired} />
      </section>

      {/* 7 — reviews, absent entirely when there are none */}
      {social.reviews.length > 0 && (
        <section>
          <SectionHeading
            action={
              <NavLink href={reviewsHref} kind="push" className="inline-flex min-h-11 shrink-0 items-center text-detail font-semibold text-[#6d1b52]">
                All {social.count} review{social.count === 1 ? "" : "s"}
              </NavLink>
            }
          >
            What hosts say
          </SectionHeading>
          <div className="vg-scroll-x vg-bleed mt-2.5 gap-2.5">
            {social.reviews.map((r, i) => (
              <Card key={i} className="flex w-[250px] shrink-0 flex-col gap-2 p-3.5">
                <div className="text-meta tracking-[2px] text-[#b88513]" aria-label={`${r.rating} out of 5 stars`}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(Math.max(0, 5 - r.rating))}
                </div>
                <p className="line-clamp-6 text-detail leading-[1.5] text-[#3a3a3c]">{r.text}</p>
                <div className="mt-auto text-meta text-[#6e6e73]">
                  <span className="font-semibold text-[#1d1d1f]">{r.who}</span> · {r.when}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {canCompare && (
        <NavLink href={compareHref([venue.id])} kind="push" className="vg-card flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-3.5">
          <IconTile size={32}>
            <ArrowLeftRight className="size-4" aria-hidden />
          </IconTile>
          <span className="min-w-0 flex-1 text-body font-semibold">Compare with other halls</span>
          <ChevronRight className="size-4 text-[#c7c7cc]" aria-hidden />
        </NavLink>
      )}

      <ContactChip context={`Hi Veloria Grand, I have a question about ${venue.name}.`} />

      <div className="vg-gold-note max-w-[70ch] rounded-[14px] p-3.5 text-detail leading-[1.55] text-[#3a3a3c]">
        <span className="font-semibold text-[#1d1d1f]">About the price.</span>{" "}
        {price.amount ? `"From" is the lowest slot price for ${venue.name} over the next 12 months. ` : ""}
        Your final price depends on the date, slot, guest count and add-ons.
      </div>
      {/* Clears the sticky bar. At >= 1024px the bar is a card beside the page. */}
      <div className="h-24 lg:hidden" />
    </>
  );

  return (
    <div className="vg-rise">
      {/* 1 — photos */}
      <PhotoHeader
        venueId={venue.id}
        venueName={venue.name}
        photos={photos}
        photosHref={`${base}/photos`}
        backHref="/app/venues"
      />

      {/* 4 — the calendar, 5 — the booking control it feeds, and the shape of
          the page around them (one column, or content + sticky card). */}
      <div className="vg-gutter relative z-[1] -mt-6 rounded-t-3xl bg-[#f3f0ec] pt-[22px]">
        <HallBooking
          venueId={venue.id}
          venueName={venue.name}
          priceAmount={price.amount}
          perGuest={price.perGuest}
          before={before}
          after={after}
        />
      </div>
    </div>
  );
}
