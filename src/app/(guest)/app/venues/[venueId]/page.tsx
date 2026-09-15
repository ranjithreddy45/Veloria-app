import { notFound } from "next/navigation";
import { ArrowLeftRight, Car, ChevronRight, CirclePlay, ExternalLink, MapPin, Navigation, Rotate3d, Star, UtensilsCrossed } from "lucide-react";
import { BackButton, NavLink } from "../../../_components/nav-transition";
import { ParallaxHero } from "../../../_components/parallax-hero";
import { Card, IconTile, IllustrationBadge, Photo } from "../../../_components/ui";
import { getStorefrontVenue, getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestHallInfo, getGuestHallPrices, getGuestPhotos, getGuestVenueSocial } from "@/actions/guest-public.actions";
import { VenueImage } from "../../../_components/venue-image";
import { ContactChip } from "../../../_components/contact-chip";
import { hallPriceText } from "../../../_components/format";
import { hallPhotoSet } from "../../../_components/stock";
import { SaveButton } from "../../../_components/shortlist";
import { AvailabilityMonth } from "./_components/availability-month";
import { PlanLinks } from "../_components/plan-links";
import { compareHref } from "../_lib/links";

export const revalidate = 60;

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <IconTile size={32}>{icon}</IconTile>
      <div className="min-w-0 flex-1 text-body leading-[1.5] text-[#1d1d1f]">
        <div className="text-meta font-semibold uppercase tracking-[.06em] text-[#8a8a8e]">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
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
  const photoSet = hallPhotoSet(photos, venue.id);
  const reviewsHref = `/app/venues/${venue.id}/reviews`;
  const canCompare = halls.some((h) => h.id !== venue.id);
  const video = info?.video ?? null;
  const tourHref = info?.virtualTourHref ?? null;
  const mediaTitle = video && tourHref ? "Video and virtual tour" : video ? "Video" : "Virtual tour";

  return (
    <div className="vg-rise">
      {/* Hero */}
      <div className="relative h-[330px] overflow-hidden">
        <ParallaxHero className="absolute inset-0">
          <VenueImage seed={venue.id} alt={photoSet.isStock ? `Illustration, not a photo of ${venue.name}` : venue.name} name={venue.name} src={photoSet.hero} className="h-full w-full" />
        </ParallaxHero>
        <BackButton href="/app/venues" light className="absolute left-4 top-[calc(var(--sat)+0.75rem)]" />
        <SaveButton venueId={venue.id} className="absolute right-4 top-[calc(var(--sat)+0.75rem)]" />
        {photoSet.isStock && <IllustrationBadge className="absolute bottom-10 right-4" />}
      </div>

      <div className="relative z-[1] -mt-6 flex flex-col gap-[18px] rounded-t-3xl bg-[#f3f0ec] px-5 pt-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-editorial text-[29px] font-semibold leading-[1.1] tracking-[-.018em]">{venue.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-detail text-[#6e6e73]">
              {social.rating != null && (
                <>
                  <NavLink href={reviewsHref} kind="push" className="inline-flex items-center gap-x-1.5">
                    <Star className="size-3.5 fill-[#b88513] text-[#b88513]" aria-hidden />
                    <span className="font-semibold text-[#1d1d1f]">{social.rating}</span>
                    <span className="underline decoration-black/20 underline-offset-2">{social.count} review{social.count === 1 ? "" : "s"}</span>
                  </NavLink>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>Up to {venue.capacity.toLocaleString("en-IN")} guests</span>
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-[#f7eef2] px-3 py-2 text-right">
            {price.amount ? (
              <>
                <div className="text-[10px] uppercase tracking-[.08em] text-[#8a5a78]">from</div>
                <div className="numeric text-copy font-semibold text-[#6d1b52]">{price.amount}</div>
                <div className="text-[10px] text-[#8a5a78]">per slot</div>
                {price.perGuest && <div className="max-w-[112px] text-[10px] leading-[1.3] text-[#8a5a78]">{price.perGuest}</div>}
              </>
            ) : (
              <div className="max-w-[96px] text-detail font-semibold leading-[1.25] text-[#6d1b52]">Price on request</div>
            )}
          </div>
        </div>

        {venue.description && <p className="text-body leading-[1.6] text-[#3a3a3c]">{venue.description}</p>}
        {photoSet.isStock && (
          <p className="-mt-2 text-meta leading-[1.5] text-[#8a8a8e]">The picture above is an illustration. We haven&apos;t published photos of {venue.name} yet.</p>
        )}

        {photoSet.strip.length > 0 && (
          <div className="vg-scroll-x vg-bleed">
            {photoSet.strip.map((p) => (
              <Photo key={p.id} src={p.url} alt={p.title ?? venue.name} className="h-[90px] w-[120px] shrink-0 rounded-xl" />
            ))}
          </div>
        )}

        <div>
          <div className="text-copy font-semibold">Plan your visit</div>
          <PlanLinks className="mt-2.5" venueId={venue.id} quoteVenueId={venue.id} showQuote={!info?.inHouseCateringRequired} />
        </div>

        <AvailabilityMonth venueId={venue.id} venueName={venue.name} priceLabel={price.amount ? `from ${price.amount}` : null} />

        {venue.amenities && venue.amenities.length > 0 && (
          <div>
            <div className="text-copy font-semibold">What&apos;s included</div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {venue.amenities.map((a) => (
                <div key={a} className="vg-card flex items-center gap-2 rounded-xl px-3 py-2.5 text-detail font-medium">
                  <span className="size-[7px] shrink-0 rounded-full bg-[#34c759]" />{a}
                </div>
              ))}
            </div>
          </div>
        )}

        {info?.inHouseCateringRequired && (
          <Card className="flex items-start gap-3 p-4">
            <IconTile tone="gold" size={36}>
              <UtensilsCrossed className="size-[18px]" aria-hidden />
            </IconTile>
            <div className="min-w-0">
              <div className="text-body font-semibold">In-house catering</div>
              <p className="mt-0.5 text-detail leading-[1.5] text-[#3a3a3c]">{info.inHouseCateringNote ?? "Food must be purchased from the hall's own caterer."}</p>
            </div>
          </Card>
        )}

        {info && (info.address || info.directionsNote || info.parkingInfo) && (
          <div>
            <div className="text-copy font-semibold">Getting here</div>
            <Card className="vg-divide mt-2.5 overflow-hidden">
              {info.address && (
                <InfoRow icon={<MapPin className="size-4" aria-hidden />} label={info.address.source === "HALL" ? "Hall address" : "Venue address"}>
                  {info.address.text && <p className="whitespace-pre-line">{info.address.text}</p>}
                  {info.address.mapHref && (
                    <a href={info.address.mapHref} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-detail font-semibold text-[#6d1b52]">
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
          </div>
        )}

        {(video || tourHref) && (
          <div>
            <div className="text-copy font-semibold">{mediaTitle}</div>
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
            <div className="mt-2.5 flex flex-col gap-2">
              {video && video.kind === "link" && (
                <a href={video.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[.08] bg-white px-5 py-3.5 text-body font-semibold text-[#1d1d1f]">
                  <CirclePlay className="size-4" aria-hidden /> Watch the video <ExternalLink className="size-3.5 text-[#8a8a8e]" aria-hidden />
                </a>
              )}
              {tourHref && (
                <a href={tourHref} target="_blank" rel="noopener noreferrer" className="vg-primary vg-press inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-body font-semibold">
                  <Rotate3d className="size-4" aria-hidden /> Take the virtual tour
                </a>
              )}
            </div>
          </div>
        )}

        {social.reviews.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-copy font-semibold">What hosts say</div>
              <NavLink href={reviewsHref} kind="push" className="text-detail font-semibold text-[#6d1b52]">
                All {social.count} review{social.count === 1 ? "" : "s"}
              </NavLink>
            </div>
            <div className="vg-scroll-x vg-bleed mt-2.5 gap-2.5">
              {social.reviews.map((r, i) => (
                <Card key={i} className="flex w-[250px] shrink-0 flex-col gap-2 p-3.5">
                  <div className="text-meta tracking-[2px] text-[#b88513]" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}</div>
                  <p className="line-clamp-6 text-detail leading-[1.5] text-[#3a3a3c]">{r.text}</p>
                  <div className="mt-auto text-meta text-[#6e6e73]"><span className="font-semibold text-[#1d1d1f]">{r.who}</span> · {r.when}</div>
                </Card>
              ))}
            </div>
          </div>
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

        <div className="vg-gold-note rounded-[14px] p-3.5 text-detail leading-[1.55] text-[#3a3a3c]">
          <span className="font-semibold text-[#1d1d1f]">About the price.</span>{" "}
          {price.amount ? `"From" is the lowest slot price for ${venue.name} over the next 12 months. ` : ""}
          Your final price depends on the date, slot, guest count and add-ons.
        </div>
        <div className="h-24" />
      </div>
    </div>
  );
}
