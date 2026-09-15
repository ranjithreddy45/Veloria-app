import { NavLink } from "../../_components/nav-transition";
import { ArrowLeftRight, Star } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestHallCovers, getGuestHallPrices, getGuestVenueRatings } from "@/actions/guest-public.actions";
import { VenueImage } from "../../_components/venue-image";
import { Screen, Title, Chip, EmptyNote } from "../../_components/ui";
import { hallPriceText } from "../../_components/format";
import { hallCover } from "../../_components/stock";
import { CompareSavedLink, SavedMark } from "../../_components/shortlist";
import { compareHref } from "./_lib/links";

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
  // Covers: each hall's own first real photo. Prices: the team's hall pricing engine. Ratings: approved public reviews.
  const [venues, ratings, covers, prices] = await Promise.all([getStorefrontVenues(), getGuestVenueRatings(), getGuestHallCovers(), getGuestHallPrices()]);

  const visible = venues.filter((v) =>
    cap === "200" ? v.capacity <= 200 : cap === "500" ? v.capacity <= 500 : cap === "501" ? v.capacity > 500 : true
  );
  const anyIllustration = visible.some((v) => !covers[v.id]);

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

      {venues.length > 1 && (
        <div className="-mt-1 flex flex-wrap gap-2">
          <NavLink href={compareHref()} kind="push" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-black/[.08] bg-white px-3.5 py-2 text-detail font-semibold text-[#1d1d1f]">
            <ArrowLeftRight className="size-3.5" aria-hidden /> Compare halls
          </NavLink>
          <CompareSavedLink />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyNote>{venues.length === 0 ? "Halls will appear here once published." : "No hall matches that size — try another filter."}</EmptyNote>
      ) : (
        visible.map((v, i) => {
          const r = ratings[v.id];
          const cover = hallCover(covers[v.id], v.id);
          const price = hallPriceText(prices[v.id]);
          return (
            <NavLink key={v.id} href={`/app/venues/${v.id}`} kind="push" className="vg-press block overflow-hidden rounded-[20px] border border-black/[.06] bg-white shadow-[0_12px_28px_-20px_rgba(29,29,31,.25)]">
              <div className="relative h-[170px]">
                <VenueImage seed={v.id} alt={v.name} name={v.name} src={cover.src} illustration={cover.isStock} badgeClassName="bottom-3 left-3" priority={i === 0} className="h-full w-full" />
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
                  {price.amount ? (
                    <>
                      <div className="text-[10.5px] text-[#8a8a8e]">from</div>
                      <div className="numeric text-copy font-semibold text-[#6d1b52]">{price.amount}</div>
                      {price.perGuest && <div className="text-[10.5px] text-[#8a8a8e]">{price.perGuest}</div>}
                    </>
                  ) : (
                    <div className="text-detail font-semibold text-[#6d1b52]">Price on request</div>
                  )}
                </div>
              </div>
            </NavLink>
          );
        })
      )}

      {anyIllustration && visible.length > 0 && (
        <p className="text-meta leading-[1.5] text-[#8a8a8e]">
          Pictures marked &ldquo;Illustration&rdquo; are not photos of our halls. Each is replaced as soon as our team publishes a real photo of that hall.
        </p>
      )}
    </Screen>
  );
}
