import Form from "next/form";
import { Check, Minus } from "lucide-react";
import { NavLink } from "../../../_components/nav-transition";
import { Card, EmptyNote, PrimaryButton, Screen, ScreenHeader } from "../../../_components/ui";
import { getStorefrontVenues, type StorefrontVenue } from "@/actions/storefront.actions";
import { getGuestHallInfo, getGuestHallPrices, getGuestVenueRatings } from "@/actions/guest-public.actions";
import { buildComparison, COMPARE_MAX, parseCompareIds, type CompareCell, type Comparison } from "../_lib/compare";

// Compare 2–3 halls side by side. Every fact is read from the records the team
// uses: Venue (capacity, amenities, in-house catering), the team's hall pricing
// engine (price) and approved public reviews (rating).

export const metadata = { title: "Compare halls — Veloria Grand" };

type SearchParams = Promise<{ h?: string | string[]; ids?: string | string[] }>;

export default async function CompareHallsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const venues = await getStorefrontVenues();
  const { ids, extra } = parseCompareIds(sp, venues.map((v) => v.id));
  const picked = ids.flatMap((id) => venues.filter((v) => v.id === id));

  let comparison: Comparison | null = null;
  if (picked.length >= 2) {
    const [ratings, prices, infos] = await Promise.all([getGuestVenueRatings(), getGuestHallPrices(ids), getGuestHallInfo(ids)]);
    comparison = buildComparison(
      picked.map((v) => ({
        id: v.id,
        name: v.name,
        capacity: v.capacity,
        amenities: v.amenities,
        price: prices[v.id] ?? null,
        rating: ratings[v.id] ?? null,
        inHouseCateringRequired: infos[v.id] ? infos[v.id].inHouseCateringRequired : null,
        inHouseCateringNote: infos[v.id]?.inHouseCateringNote ?? null,
      }))
    );
  }

  return (
    <Screen className="gap-4 pb-6">
      <ScreenHeader title="Compare halls" backHref="/app/venues" />

      {venues.length < 2 ? (
        <EmptyNote>There is only one hall to choose from, so there is nothing to compare.</EmptyNote>
      ) : (
        <>
          {comparison ? (
            <>
              {extra > 0 && (
                <p className="text-meta text-[#6e6e73]">
                  You can compare up to {COMPARE_MAX} halls at a time, so these are the first {COMPARE_MAX} you picked.
                </p>
              )}
              <ComparisonTable comparison={comparison} />
              <p className="text-meta leading-[1.5] text-[#8a8a8e]">
                Prices are each hall&apos;s lowest slot price over the next 12 months; your final price depends on the date, slot, guest count and add-ons. Ratings come from published reviews. A tick means our team lists that amenity for the hall.
              </p>
            </>
          ) : (
            <p className="text-detail text-[#6e6e73]">{picked.length === 1 ? "Pick one or two more halls to compare." : `Pick 2 or ${COMPARE_MAX} halls to see them side by side.`}</p>
          )}
          <HallPicker venues={venues} selected={ids} collapsed={!!comparison} />
        </>
      )}
    </Screen>
  );
}

function ComparisonTable({ comparison }: { comparison: Comparison }) {
  const cols = comparison.halls.length >= 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className="vg-card overflow-hidden rounded-2xl">
      <div className={`grid ${cols} gap-3 px-3 py-3`}>
        {comparison.halls.map((h) => (
          <NavLink key={h.id} href={`/app/venues/${h.id}`} kind="push" className="min-w-0 break-words font-editorial text-[17px] font-semibold leading-[1.2] text-[#6d1b52]">
            {h.name}
          </NavLink>
        ))}
      </div>
      <FactRow label="Guests" cells={comparison.capacity} cols={cols} />
      <FactRow label="Price" cells={comparison.price} cols={cols} />
      <FactRow label="Rating" cells={comparison.rating} cols={cols} />
      <FactRow label="In-house catering" cells={comparison.catering} cols={cols} />
      <div className="border-t border-black/[.06] px-3 pb-3 pt-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#8a8a8e]">Amenities</div>
        {comparison.amenities.length === 0 ? (
          <p className="mt-1 text-meta text-[#6e6e73]">No amenities are listed for these halls.</p>
        ) : (
          comparison.amenities.map((a) => (
            <div key={a.label} className="mt-2">
              <div className="text-meta text-[#3a3a3c]">{a.label}</div>
              <div className={`mt-0.5 grid ${cols} gap-3`}>
                {a.has.map((has, i) => (
                  <span key={comparison.halls[i].id} className={has ? "text-[#2a9d4a]" : "text-[#c7c7cc]"}>
                    {has ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                    <span className="sr-only">
                      {comparison.halls[i].name}: {has ? "listed" : "not listed"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FactRow({ label, cells, cols }: { label: string; cells: CompareCell[]; cols: string }) {
  return (
    <div className="border-t border-black/[.06]">
      <div className="px-3 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#8a8a8e]">{label}</div>
      <div className={`grid ${cols} gap-3 px-3 pb-3 pt-1`}>
        {cells.map((c, i) => (
          <div key={i} className="min-w-0 break-words">
            <div className="text-body font-semibold text-[#1d1d1f]">{c.main}</div>
            {c.sub && <div className="mt-0.5 text-meta leading-[1.4] text-[#6e6e73]">{c.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HallPicker({ venues, selected, collapsed }: { venues: StorefrontVenue[]; selected: string[]; collapsed: boolean }) {
  const form = (
    <Form action="/app/venues/compare" className="flex flex-col gap-3">
      <Card className="vg-divide overflow-hidden">
        {venues.map((v) => (
          <label key={v.id} className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-3">
            <input type="checkbox" name="h" value={v.id} defaultChecked={selected.includes(v.id)} className="size-5 shrink-0 accent-[#6d1b52]" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">{v.name}</span>
              <span className="block text-meta text-[#6e6e73]">Up to {v.capacity.toLocaleString("en-IN")} guests</span>
            </span>
          </label>
        ))}
      </Card>
      <PrimaryButton type="submit">Compare</PrimaryButton>
    </Form>
  );
  if (!collapsed) return form;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-detail font-semibold text-[#6d1b52]">Change halls</summary>
      <div className="mt-3">{form}</div>
    </details>
  );
}
