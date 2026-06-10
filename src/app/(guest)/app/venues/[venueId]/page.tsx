import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Check,
  Star,
  MapPin,
  ParkingCircle,
} from "lucide-react";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { VenueImage } from "../../../_components/venue-image";
import { formatPrice } from "../../../_components/format";

export const revalidate = 60;

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();

  return (
    <div className="bg-zinc-50">
      {/* Hero image */}
      <div className="relative">
        <VenueImage
          seed={venue.id}
          alt={venue.name}
          priority
          className="h-72 w-full"
        />
        <Link
          href="/app/venues"
          className="absolute left-4 top-[calc(var(--sat)+0.75rem)] flex size-10 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md backdrop-blur-sm"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="absolute right-4 top-[calc(var(--sat)+0.75rem)] inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-zinc-800 shadow-sm">
          <Star className="size-3.5 fill-amber-400 text-amber-400" /> 4.8
        </span>
      </div>

      {/* Title card overlapping the hero */}
      <div className="relative -mt-6 rounded-t-3xl bg-zinc-50 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[24px] font-extrabold tracking-tight text-zinc-900">
            {venue.name}
          </h1>
          <div className="shrink-0 rounded-2xl bg-violet-50 px-3 py-1.5 text-right">
            <div className="text-[10px] uppercase tracking-wide text-violet-400">
              from
            </div>
            <div className="text-[17px] font-extrabold text-violet-700">
              {formatPrice(venue.pricePerSlot)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-medium text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-violet-500" /> Up to {venue.capacity} guests
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-violet-500" /> Bangalore
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ParkingCircle className="size-4 text-violet-500" /> Valet parking
          </span>
        </div>

        {venue.description && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">
            {venue.description}
          </p>
        )}

        {/* Amenities */}
        {venue.amenities && venue.amenities.length > 0 && (
          <div className="mt-5">
            <h2 className="text-[15px] font-extrabold text-zinc-900">
              What&apos;s included
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {venue.amenities.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-100"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
          <p className="text-[12.5px] leading-relaxed text-violet-900/80">
            <span className="font-bold text-violet-900">
              Flexible &amp; transparent.
            </span>{" "}
            Bring your own caterer and decorator. No hidden charges — final
            pricing depends on date, guests, and add-ons.
          </p>
        </div>
      </div>

      {/* Sticky book bar */}
      <div className="fixed inset-x-0 bottom-[calc(var(--sab)+60px)] z-30 mx-auto max-w-md border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)]">
        <Link
          href={`/app/book?venueId=${venue.id}&venueName=${encodeURIComponent(venue.name)}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-[15px] font-extrabold text-white shadow-md shadow-violet-600/25 transition active:scale-[0.99]"
        >
          Enquire &amp; check availability
        </Link>
      </div>
      <div className="h-24" />
    </div>
  );
}
