import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { VenueImage } from "../../_components/venue-image";
import { formatPrice } from "../../_components/format";

export const metadata = { title: "Our Venues — Veloria Grand" };
export const revalidate = 60;

export default async function VenuesPage() {
  const venues = await getStorefrontVenues();

  return (
    <div className="bg-aura bg-grid-faint min-h-screen bg-zinc-50 px-4 pt-[calc(var(--sat)+1.25rem)]">
      <h1 className="large-title text-ink-gradient text-h2">Our halls</h1>
      <p className="mt-1 text-body text-zinc-500">
        Pick the space that fits your celebration.
      </p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-body text-zinc-500">
          No venues published yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {venues.map((v, i) => (
            <Link
              key={v.id}
              href={`/app/venues/${v.id}`}
              className="sheen-sweep hover-lift block w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99]"
            >
              <div className="relative">
                <VenueImage
                  seed={v.id}
                  alt={v.name}
                  priority={i === 0}
                  className="h-40 w-full"
                />
                <h2 className="absolute bottom-3 left-3 text-lede font-extrabold text-white drop-shadow">
                  {v.name}
                </h2>
              </div>
              <div className="flex items-center justify-between p-3.5">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-detail text-zinc-500">
                    <Users className="size-3.5" /> Up to {v.capacity} guests
                  </span>
                  {v.description && (
                    <p className="mt-0.5 line-clamp-1 text-detail text-zinc-400">
                      {v.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-meta text-zinc-400">from</div>
                    <div className="text-copy font-extrabold text-violet-700">
                      {formatPrice(v.pricePerSlot)}
                    </div>
                    <div className="text-meta leading-tight text-zinc-400">
                      / slot · rental
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-zinc-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
