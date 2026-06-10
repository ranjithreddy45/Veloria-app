import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Check,
  Sparkles,
  MapPin,
  ParkingCircle,
} from "lucide-react";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { VenueCover } from "../../../_components/venue-cover";
import { formatPrice } from "../../../_components/format";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();

  return (
    <div>
      {/* Hero with back button */}
      <div className="relative">
        <VenueCover
          name={venue.name}
          seed={venue.id}
          rounded={false}
          className="h-60 w-full"
        />
        <Link
          href="/app/venues"
          className="absolute left-4 top-[calc(var(--sat)+0.75rem)] flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-[24px] font-semibold tracking-tight text-foreground">
            {venue.name}
          </h1>
          <div className="shrink-0 text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              from
            </div>
            <div className="text-[17px] font-semibold text-primary">
              {formatPrice(venue.pricePerSlot)}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> Up to {venue.capacity} guests
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" /> Bangalore
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ParkingCircle className="size-4" /> Valet parking
          </span>
        </div>

        {venue.description && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-foreground/80">
            {venue.description}
          </p>
        )}

        {/* Amenities */}
        {venue.amenities && venue.amenities.length > 0 && (
          <div className="mt-5">
            <h2 className="text-[14px] font-semibold text-foreground">
              What&apos;s included
            </h2>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {venue.amenities.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 text-[12.5px] text-foreground/85"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reassurance */}
        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Flexible &amp; transparent.
            </span>{" "}
            Bring your own caterer and decorator. No hidden charges — final
            pricing depends on your date, guest count, and add-ons.
          </p>
        </div>
      </div>

      {/* Sticky book bar */}
      <div
        className="fixed inset-x-0 bottom-[calc(var(--sab)+56px)] z-30 mx-auto max-w-md border-t border-border bg-background/95 px-5 py-3 backdrop-blur-lg"
      >
        <Link
          href={`/app/book?venueId=${venue.id}&venueName=${encodeURIComponent(venue.name)}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99]"
        >
          <Sparkles className="size-4" />
          Enquire &amp; check this venue
        </Link>
      </div>
      {/* Spacer so content isn't hidden behind the sticky bar */}
      <div className="h-20" />
    </div>
  );
}
