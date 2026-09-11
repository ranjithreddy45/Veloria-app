import { notFound } from "next/navigation";
import { Star, MapPin } from "lucide-react";
import { BackButton } from "../../../_components/nav-transition";
import { ParallaxHero } from "../../../_components/parallax-hero";
import { Photo } from "../../../_components/ui";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { getGuestPhotos, getGuestVenueSocial } from "@/actions/guest-public.actions";
import { COMPANY_ADDRESS } from "@/lib/constants";
import { VenueImage } from "../../../_components/venue-image";
import { formatPrice } from "../../../_components/format";
import { Card } from "../../../_components/ui";
import { AvailabilityMonth } from "./_components/availability-month";

export const revalidate = 60;

export default async function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();
  const [photos, social] = await Promise.all([getGuestPhotos({ venueId, limit: 12 }), getGuestVenueSocial(venueId)]);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY_ADDRESS)}`;

  return (
    <div className="vg-rise">
      {/* Hero */}
      <div className="relative h-[330px] overflow-hidden">
        <ParallaxHero className="absolute inset-0">
          <VenueImage seed={venue.id} alt={venue.name} name={venue.name} src={photos[0]?.url} className="h-full w-full" />
        </ParallaxHero>
        <BackButton href="/app/venues" light className="absolute left-4 top-[calc(var(--sat)+0.75rem)]" />
        {photos.length > 1 && (
          <span className="absolute bottom-10 right-4 rounded-full bg-[#1d1d1f]/55 px-2.5 py-1 text-meta font-semibold text-white backdrop-blur">
            {photos.length} photos
          </span>
        )}
      </div>

      <div className="relative z-[1] -mt-6 flex flex-col gap-[18px] rounded-t-3xl bg-[#f3f0ec] px-5 pt-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-editorial text-[29px] font-semibold leading-[1.1] tracking-[-.018em]">{venue.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-detail text-[#6e6e73]">
              {social.rating != null ? (
                <>
                  <Star className="size-3.5 fill-[#b88513] text-[#b88513]" />
                  <span className="font-semibold text-[#1d1d1f]">{social.rating}</span>
                  <span>· {social.count} review{social.count === 1 ? "" : "s"}</span>
                  <span>·</span>
                </>
              ) : null}
              <span>Up to {venue.capacity.toLocaleString("en-IN")} guests</span>
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-[#f7eef2] px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[.08em] text-[#8a5a78]">from</div>
            <div className="numeric text-copy font-semibold text-[#6d1b52]">{formatPrice(venue.pricePerSlot)}</div>
            <div className="text-[10px] text-[#8a5a78]">per slot</div>
          </div>
        </div>

        {venue.description && <p className="text-body leading-[1.6] text-[#3a3a3c]">{venue.description}</p>}

        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-detail font-medium text-[#6d1b52]">
          <MapPin className="size-4" /> {COMPANY_ADDRESS}
        </a>

        {photos.length > 1 && (
          <div className="vg-scroll-x vg-bleed">
            {photos.slice(1, 9).map((p) => (
              <Photo key={p.id} src={p.url} alt={p.title ?? venue.name} className="h-[90px] w-[120px] shrink-0 rounded-xl" />
            ))}
          </div>
        )}

        <AvailabilityMonth venueId={venue.id} venueName={venue.name} priceLabel={formatPrice(venue.pricePerSlot)} />

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

        {social.reviews.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-copy font-semibold">What hosts say</div>
              <div className="text-detail font-semibold text-[#6d1b52]">All {social.count}</div>
            </div>
            <div className="vg-scroll-x vg-bleed mt-2.5 gap-2.5">
              {social.reviews.map((r, i) => (
                <Card key={i} className="flex w-[250px] shrink-0 flex-col gap-2 p-3.5">
                  <div className="text-meta tracking-[2px] text-[#b88513]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                  <p className="text-detail leading-[1.5] text-[#3a3a3c]">{r.text}</p>
                  <div className="mt-auto text-meta text-[#6e6e73]"><span className="font-semibold text-[#1d1d1f]">{r.who}</span> · {r.when}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="vg-gold-note rounded-[14px] p-3.5 text-detail leading-[1.55] text-[#3a3a3c]">
          <span className="font-semibold text-[#1d1d1f]">Flexible and transparent.</span> Bring your own caterer and decorator, or choose from our curated partners. No hidden charges — final pricing depends on date, guests and add-ons.
        </div>
        <div className="h-24" />
      </div>
    </div>
  );
}
