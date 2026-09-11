import { NavLink } from "../../_components/nav-transition";
import { Star } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestPhotos, getGuestVenueRatings } from "@/actions/guest-public.actions";
import { VenueImage } from "../../_components/venue-image";
import { Screen, Title, Chip, EmptyNote } from "../../_components/ui";
import { formatPrice } from "../../_components/format";
import { hallStock } from "../../_components/stock";
import { SavedMark } from "../../_components/shortlist";

export const metadata = { title: "Our halls — Veloria Grand" };
export const revalidate = 60;

const CAPS = [
  { key: "all", label: "All" },
  { key: "200", label: "Up to 200" },
  { key: "500", label: "Up to 500" },
  { key: "501", label: "500+" },
] as const;

export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ cap?: string }> }) {
  const { cap = "all" } = await searchParams;
  const [venues, ratings, photos] = await Promise.all([getStorefrontVenues(), getGuestVenueRatings(), getGuestPhotos({ limit: 60 })]);
  const cover = new Map<string, string>();
  for (const p of photos) if (p.venueId && !cover.has(p.venueId)) cover.set(p.venueId, p.url);

  const visible = venues.filter((v) =>
    cap === "200" ? v.capacity <= 200 : cap === "500" ? v.capacity <= 500 : cap === "501" ? v.capacity > 500 : true
  );

  return (
    <Screen className="gap-4 pt-[calc(var(--sat)+1rem)]">
      <div>
        <Title>Our halls</Title>
        <p className="mt-1.5 text-detail text-[#6e6e73]">
          {venues.length > 1 ? `${venues.length} spaces, one address.` : "One address."} Pick the one that fits your celebration.
        </p>
      </div>

      <div className="vg-scroll-x vg-bleed">
        {CAPS.map((c) => (
          <Chip key={c.key} active={cap === c.key} href={c.key === "all" ? "/app/venues" : `/app/venues?cap=${c.key}`}>{c.label}</Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyNote>{venues.length === 0 ? "Halls will appear here once published." : "No hall matches that size — try another filter."}</EmptyNote>
      ) : (
        visible.map((v, i) => {
          const r = ratings[v.id];
          return (
            <NavLink key={v.id} href={`/app/venues/${v.id}`} kind="push" className="vg-press block overflow-hidden rounded-[20px] border border-black/[.06] bg-white shadow-[0_12px_28px_-20px_rgba(29,29,31,.25)]">
              <div className="relative h-[170px]">
                <VenueImage seed={v.id} alt={v.name} name={v.name} src={cover.get(v.id) ?? hallStock(v.id).cover} priority={i === 0} className="h-full w-full" />
                <SavedMark venueId={v.id} className="absolute left-3 top-3" />
                {r && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#fdf5f3]/[.92] px-2.5 py-1 text-meta font-semibold text-[#1d1d1f]">
                    <Star className="size-3 fill-[#b88513] text-[#b88513]" /> {r.rating}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-copy font-semibold">{v.name}</div>
                  <div className="mt-0.5 truncate text-meta text-[#6e6e73]">Up to {v.capacity.toLocaleString("en-IN")} guests{v.description ? ` · ${v.description}` : ""}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10.5px] text-[#8a8a8e]">from</div>
                  <div className="numeric text-copy font-semibold text-[#6d1b52]">{formatPrice(v.pricePerSlot)}</div>
                </div>
              </div>
            </NavLink>
          );
        })
      )}
    </Screen>
  );
}
