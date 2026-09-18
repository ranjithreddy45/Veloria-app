import { ArrowLeftRight } from "lucide-react";
import { NavLink } from "../../_components/nav-transition";
import { getGuestHallFeed } from "@/actions/guest-public.actions";
import { Chip, EmptyNote, Title } from "../../_components/ui";
import { CompareSavedLink } from "../../_components/shortlist";
import { compareHref } from "./_lib/links";
import { HALL_CAP_BANDS, hallSearchHref, hallSearchIsEmpty, noMatchAdvice, parseHallSearch, resultCountText } from "./_lib/hall-search";
import { HallCard } from "./_components/hall-card";
import { HallSearchPill } from "./_components/search-sheet";

// ============================================================
// The halls feed — the screen someone lands on to choose a space.
//
// One read (getGuestHallFeed) gives every card its photos, capacity, price,
// rating and, when a date is searched, that date's availability and price.
// The whole search lives in the query string, so this page is shareable and
// the back button undoes one search at a time.
//
// Honesty rules this screen: halls with no photo show a labelled illustration
// and say so at the foot; a hall with no usable price reads "Price on
// request"; a location line appears only for a hall whose address the team has
// filled in; availability is only ever shown for a date actually searched, and
// a busy hall is sorted lower, never hidden.
// ============================================================

export const metadata = { title: "Our halls — Veloria Grand" };
// Availability and prices are read per request: a stale cache could offer a date that has since gone.
export const dynamic = "force-dynamic";

const BASE = "/app/venues";

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; slot?: string | string[]; guests?: string | string[]; amenity?: string | string[]; cap?: string | string[] }>;
}) {
  const params = await searchParams;
  const feed = await getGuestHallFeed(parseHallSearch(params));
  // What the server actually applied — an unreal date or an amenity no hall lists was dropped.
  const search = feed.applied;

  const freeCount = feed.halls.filter((h) => h.availability === "FREE").length;
  const countLine = resultCountText({ total: feed.totalPublished, shown: feed.halls.length, dateISO: search.dateISO, freeCount });
  const anyIllustration = feed.halls.some((h) => h.photos.length === 0);
  const filtered = !hallSearchIsEmpty(search);

  const chips = [
    ...HALL_CAP_BANDS.filter((b) => feed.capacityOptions.includes(b.key)).map((b) => ({
      key: `cap-${b.key}`,
      label: b.label,
      active: search.cap === b.key,
      href: hallSearchHref(BASE, search, { cap: search.cap === b.key ? null : b.key }),
    })),
    ...feed.amenityOptions.map((a) => ({
      key: `amenity-${a}`,
      label: a,
      active: search.amenity === a,
      href: hallSearchHref(BASE, search, { amenity: search.amenity === a ? null : a }),
    })),
  ];

  return (
    <div className="vg-rise flex flex-col">
      {/* The pill sticks under the laptop's top bar (56px of row + its 1px rule),
          and under nothing on a phone; its padding tracks the column's gutter so
          the search box lines up with the headings below it. */}
      <HallSearchPill search={search} amenityOptions={feed.amenityOptions} basePath={BASE} className="sm:px-7 lg:top-[57px] lg:px-8" />

      <div className="vg-gutter flex flex-col gap-4 pt-2">
        <div>
          <Title>Our halls</Title>
          <p className="mt-1.5 max-w-[60ch] text-detail text-[#6e6e73]">
            {feed.totalPublished > 1 ? `${feed.totalPublished} spaces to choose from.` : "One space."} Pick the one that fits your celebration.
          </p>
        </div>

        {/* A rail on a phone; on a wider column every chip fits, so they wrap instead. */}
        {chips.length > 0 && (
          <div className="vg-scroll-x vg-bleed sm:flex-wrap">
            {chips.map((c) => (
              <Chip key={c.key} active={c.active} href={c.href}>
                {c.label}
              </Chip>
            ))}
            {filtered && (
              <Chip href={BASE} className="border-dashed text-[#6e6e73]">
                Clear all
              </Chip>
            )}
          </div>
        )}

        {feed.totalPublished > 1 && (
          <div className="-mt-1 flex flex-wrap gap-2">
            <NavLink
              href={compareHref()}
              kind="push"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-black/[.08] bg-white px-3.5 py-2 text-detail font-semibold text-[#1d1d1f]"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden /> Compare halls
            </NavLink>
            <CompareSavedLink />
          </div>
        )}

        {/* role=status: applying a search from the sheet is a client navigation,
            so this line changes with nothing else moving. A screen-reader user
            has to be told what the search did. */}
        {countLine && (
          <div role="status" className="-mb-1 flex items-baseline justify-between gap-3">
            <p className="text-detail font-semibold text-[#1d1d1f]">{countLine}</p>
            {search.dateISO && <p className="shrink-0 text-meta text-[#636368]">Free halls first</p>}
          </div>
        )}

        {feed.totalPublished === 0 ? (
          <EmptyNote>Halls will appear here once published. Call or message us and we will talk you through the spaces.</EmptyNote>
        ) : feed.halls.length === 0 ? (
          <EmptyNote className="flex flex-col items-center gap-3">
            <span>{noMatchAdvice(search)}</span>
            <NavLink href={BASE} kind="push" className="inline-flex min-h-10 items-center rounded-full border border-[#6d1b52]/25 bg-[#f7eef2] px-4 py-2 text-detail font-semibold text-[#6d1b52]">
              Show all {feed.totalPublished} halls
            </NavLink>
          </EmptyNote>
        ) : (
          // One column on a phone, two on a tablet, three on a laptop — the
          // same card either way, so a hall never reads as two different halls.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.halls.map((hall, i) => (
              <HallCard
                key={hall.id}
                hall={hall}
                dateISO={search.dateISO}
                slot={search.slot}
                matchAmenity={search.amenity}
                eager={i === 0}
              />
            ))}
          </div>
        )}

        {anyIllustration && feed.halls.length > 0 && (
          <p className="max-w-[70ch] text-meta leading-[1.5] text-[#636368]">
            Pictures marked &ldquo;Illustration&rdquo; are not photos of our halls. Each is replaced as soon as our team publishes a real photo of that hall.
          </p>
        )}
      </div>
    </div>
  );
}
