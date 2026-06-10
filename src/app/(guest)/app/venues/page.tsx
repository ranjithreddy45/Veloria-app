import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { VenueCover } from "../../_components/venue-cover";
import { formatPrice } from "../../_components/format";

export const metadata = { title: "Our Venues — Veloria Grand" };

export default async function VenuesPage() {
  const venues = await getStorefrontVenues();

  return (
    <div className="px-5 pt-[calc(var(--sat)+1.25rem)]">
      <h1 className="font-serif text-[24px] font-semibold tracking-tight text-foreground">
        Our halls
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Pick the space that fits your celebration.
      </p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
          No venues published yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {venues.map((v) => (
            <Link
              key={v.id}
              href={`/app/venues/${v.id}`}
              className="block overflow-hidden rounded-2xl border border-border bg-card transition active:scale-[0.99]"
            >
              <VenueCover
                name={v.name}
                seed={v.id}
                rounded={false}
                className="h-36 w-full"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {v.name}
                  </h2>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    from {formatPrice(v.pricePerSlot)}
                  </span>
                </div>
                {v.description && (
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Users className="size-3.5" /> Up to {v.capacity} guests
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-primary">
                    View <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
