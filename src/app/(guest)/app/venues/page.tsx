import Link from "next/link";
import { Users, Star, ChevronRight } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { VenueImage } from "../../_components/venue-image";
import { formatPrice } from "../../_components/format";

export const metadata = { title: "Our Venues — Veloria Grand" };
export const revalidate = 60;

export default async function VenuesPage() {
  const venues = await getStorefrontVenues();

  return (
    <div className="bg-aura bg-grid-faint min-h-screen bg-zinc-50 px-4 pt-[calc(var(--sat)+1.25rem)]">
      <h1 className="large-title text-ink-gradient text-[24px]">Our halls</h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        Pick the space that fits your celebration.
      </p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-[13px] text-zinc-500">
          No venues published yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {venues.map((v, i) => (
            <Link
              key={v.id}
              href={`/app/venues/${v.id}`}
              className="sheen-sweep hover-lift block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99]"
            >
              <div className="relative">
                <VenueImage
                  seed={v.id}
                  alt={v.name}
                  priority={i === 0}
                  className="h-40 w-full"
                />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-zinc-800 shadow-sm">
                  <Star className="size-3 fill-amber-400 text-amber-400" /> 4.8
                </span>
                <h2 className="absolute bottom-3 left-3 text-[17px] font-extrabold text-white drop-shadow">
                  {v.name}
                </h2>
              </div>
              <div className="flex items-center justify-between p-3.5">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                    <Users className="size-3.5" /> Up to {v.capacity} guests
                  </span>
                  {v.description && (
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-zinc-400">
                      {v.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10.5px] text-zinc-400">from</div>
                    <div className="text-[15px] font-extrabold text-violet-700">
                      {formatPrice(v.pricePerSlot)}
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
