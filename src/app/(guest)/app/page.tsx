import Link from "next/link";
import { Bell } from "lucide-react";
import {
  getGuestHallFeed,
  getGuestMostBookedVenueId,
  getGuestPeakDates,
  getGuestPhotos,
} from "@/actions/guest-public.actions";
import { getGuestOverview } from "@/actions/guest-host.actions";
import { ContactChip } from "../_components/contact-chip";
import { Card, Chip, Photo, PrimaryButton, SectionTitle } from "../_components/ui";
import { initials, inr, toISODateIST } from "../_components/format";
import { teaserPhotos } from "../_components/stock";
import { formatIstDate } from "./event/_components/event-view";
import { PlanLinks } from "./venues/_components/plan-links";
import { HallSearchPill } from "./venues/_components/search-sheet";
import { EMPTY_HALL_SEARCH, HALL_CAP_BANDS } from "./venues/_lib/hall-search";
import { browseSubtitle, capacityRangeText } from "./_components/home-browse";
import { browseHref } from "./_components/home-links";
import { SpacesRail } from "./_components/spaces-rail";
import { EventStrip, EventSummary, NextTaskRow } from "./_components/your-event";

// ============================================================
// The customer app's home screen — browse first.
//
// The screen opens on the spaces: a heading, the feed's own search (a date and
// a party size), the halls themselves in a rail, then the size bands. A
// visitor who has never spoken to us sees real halls without signing in or
// scrolling.
//
// A host who already has a booking still reaches it in one tap — EventStrip
// sits above the browse block, and the full summary (countdown, readiness,
// next task) follows it below. A signed-out visitor is shown none of that
// shell: every event block is gated on a booking that really exists.
// ============================================================

export const dynamic = "force-dynamic";

const OCCASIONS = ["Wedding", "Reception", "Engagement", "Sangeet", "Birthday Party", "Corporate Event"];

/**
 * Grid for one to three teaser photos; with three, the first spans both rows.
 * The rows grow with the column, so the strip keeps roughly its proportions
 * on a tablet and a laptop instead of flattening into a letterbox.
 */
const TEASER_GRID: Record<number, string> = {
  1: "grid-cols-1 grid-rows-[196px] sm:grid-rows-[280px] lg:grid-rows-[340px]",
  2: "grid-cols-2 grid-rows-[160px] sm:grid-rows-[240px] lg:grid-rows-[300px]",
  3: "grid-cols-[2fr_1fr] grid-rows-[96px_96px] sm:grid-rows-[140px_140px] lg:grid-rows-[170px_170px]",
};

function greeting(name: string | null) {
  // Rendered on the server (UTC) — greet in IST, where every guest is.
  const h = Math.floor(((Date.now() / 60000 + 330) % 1440) / 60);
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${g}, ${name.split(" ")[0]}` : g;
}

export default async function GuestHomePage() {
  const now = new Date();
  const todayISO = toISODateIST(now);
  // The feed the halls screen itself renders — same halls, same photos, same
  // prices — plus the signals the rail and the season row are ordered by.
  const [feed, mostBooked, peaks, photos, ov] = await Promise.all([
    getGuestHallFeed(),
    getGuestMostBookedVenueId(),
    getGuestPeakDates(todayISO, toISODateIST(new Date(now.getTime() + 60 * 86400000))),
    getGuestPhotos({ limit: 3 }),
    getGuestOverview(),
  ]);
  // Real public photos; labelled illustrations appear only when none are published.
  const teaser = teaserPhotos(photos);
  // Only the size bands a published hall really falls into.
  const sizeBands = HALL_CAP_BANDS.filter((band) => feed.capacityOptions.includes(band.key));
  const b = ov?.booking ?? null;

  return (
    <div className="vg-rise vg-gutter flex flex-col gap-[22px] pt-[calc(var(--sat)+0.75rem)] sm:gap-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-detail text-[#6e6e73]">{greeting(ov?.user.name ?? null)}</div>
          <div className="mt-0.5 font-editorial text-[22px] font-semibold leading-[1.1] tracking-[-.01em]">Veloria Grand</div>
        </div>
        <div className="flex gap-2">
          <Link href={ov ? "/app/notifications" : "/app/welcome?next=%2Fapp%2Fnotifications"} aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-full border border-black/[.07] bg-white">
            <Bell className="size-5" strokeWidth={1.8} />
            {ov && ov.unread > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-[#e8b631] ring-2 ring-white" />}
          </Link>
          <Link href={ov ? "/app/account" : "/app/welcome"} aria-label="Account" className="flex size-10 items-center justify-center rounded-full bg-[#6d1b52] text-meta font-semibold text-[#fdf5f3] shadow-[0_0_0_1.5px_rgba(232,182,49,.6)]">
            {ov ? initials(ov.user.name) : "→"}
          </Link>
        </div>
      </div>

      {/* A host's own event is one tap away, without pushing the halls off the screen. */}
      {b && <EventStrip booking={b} now={now} />}

      {/* ---- Browse. The screen opens here. ---- */}
      <div className="-mt-1">
        <h1 className="font-editorial text-[30px] font-medium leading-[1.1] tracking-[-.018em] [text-wrap:pretty] sm:text-[38px] lg:text-[44px]">Find your space.</h1>
        <p className="mt-2 max-w-[60ch] text-detail leading-[1.5] text-[#6e6e73]">{browseSubtitle(feed.totalPublished, capacityRangeText(feed.halls))}</p>
      </div>

      {/* The feed's OWN search entry — same pill, same sheet, same availability
          calendar — writing the search into /app/venues, so the date and party
          size chosen here are the results that open. Home starts from an empty
          search; it is not showing one in progress. Laid inline rather than
          stuck under the status bar, which is the feed's job, not this one's. */}
      {feed.totalPublished > 0 && (
        <HallSearchPill
          search={EMPTY_HALL_SEARCH}
          amenityOptions={feed.amenityOptions}
          // Inline here, so the pill drops the sticky header's frosted panel,
          // its rule and the status-bar inset — it is a control on the page,
          // not a bar over it. Capped on a wide column: a search field the
          // width of a laptop reads as a banner, not as something to type in.
          className="relative z-auto border-b-0 bg-transparent px-0 pb-0 pt-0 backdrop-blur-none backdrop-saturate-100 sm:max-w-xl"
        />
      )}

      <SpacesRail halls={feed.halls} mostBookedId={mostBooked} total={feed.totalPublished} />

      {/* Straight into the filtered feed — the feed's own capacity bands, so a
          chip here and a chip there filter the same halls. Only bands a hall
          actually falls into are offered (capacityOptions), so no shortcut
          leads to an empty screen. */}
      {sizeBands.length > 1 && (
        <div className="-mt-2.5">
          <div className="text-meta font-semibold uppercase tracking-[.08em] text-[#636368]">Browse by guest count</div>
          <nav aria-label="Browse spaces by guest count" className="vg-scroll-x vg-bleed mt-2.5 pb-1">
            {sizeBands.map((band) => (
              <Chip key={band.key} href={browseHref({ cap: band.key })} className="min-h-11">{band.label}</Chip>
            ))}
          </nav>
        </div>
      )}

      {/* ---- Everything the screen already carried, now below the browsing. ---- */}

      {/* Your event — only for a signed-in host with a booking */}
      {b && <EventSummary booking={b} readiness={ov?.readiness ?? null} now={now} />}
      {b && ov?.nextTask && <NextTaskRow task={ov.nextTask} openTasks={ov.openTasks} />}

      {/* This season — only what is true */}
      <div>
        <SectionTitle title="This season" action={{ label: "All packages", href: "/app/packages" }} />
        <div className="vg-scroll-x vg-bleed mt-3 gap-2.5 pb-1.5">
          {peaks.length > 0 && (
            <Link href={browseHref({ dateISO: peaks[0].dateISO })} className="vg-hero flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] p-4">
              <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Auspicious dates</span>
              <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">{peaks.length} muhurtham date{peaks.length === 1 ? "" : "s"} in the next 60 days</span><span className="mt-1 block text-meta opacity-80">Next: {formatIstDate(`${peaks[0].dateISO}T00:00:00.000Z`)} · {peaks[0].label}</span></span>
            </Link>
          )}
          <Link href="/app/book" className="flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] bg-gradient-to-br from-[#fff8e6] to-[#f3d489] p-4 text-[#3b2a05]">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Online hold</span>
            <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">Hold a date in minutes</span><span className="mt-1 block text-meta opacity-80">Small refundable token · Razorpay</span></span>
          </Link>
          <Link href="/app/packages" className="flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] bg-[#1d1d1f] p-4 text-white">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Partners</span>
            <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">Curated catering &amp; decor</span><span className="mt-1 block text-meta opacity-80">Partners who know our halls</span></span>
          </Link>
        </div>
      </div>

      {/* Plan — the public visit scheduler and instant quote (a host's own hall and event prefill the visits) */}
      <div>
        <SectionTitle title="Plan your visit" />
        <PlanLinks className="mt-3" venueId={b?.venueId ?? null} eventType={b?.eventType ?? null} />
        <nav aria-label="Start a reservation by occasion" className="vg-scroll-x vg-bleed mt-3 pb-1">
          {OCCASIONS.map((o) => (
            <Link key={o} href={`/app/book?occasion=${encodeURIComponent(o)}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/[.08] bg-white px-4 py-2.5 text-detail font-medium">{o.replace(" Party", "").replace(" Event", "")}</Link>
          ))}
        </nav>
      </div>

      {/* Gallery teaser — real photos; labelled illustrations only when none are published */}
      {teaser.items.length > 0 && (
        <div>
          <SectionTitle title={teaser.isStock ? "Ideas for your celebration" : "From our gallery"} action={{ label: "Gallery", href: "/app/gallery" }} />
          <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-[18px] ${TEASER_GRID[teaser.items.length] ?? TEASER_GRID[3]}`}>
            {teaser.items.map((p, i) => (
              <Photo key={p.id} src={p.url} alt={p.title ?? "Photo"} illustration={teaser.isStock} className={teaser.items.length === 3 && i === 0 ? "row-span-2" : ""} />
            ))}
          </div>
          {teaser.isStock && <p className="mt-2 text-meta text-[#636368]">Illustrations, not photos of Veloria Grand.</p>}
        </div>
      )}

      {ov?.preview && b && (
        <p className="-mt-3 text-center text-meta text-[#6e6e73]">Staff preview · showing {b.eventName} as its host would see it</p>
      )}
      {ov && !ov.verified && !ov.preview && (
        <Card className="p-4 text-detail leading-[1.5] text-[#3a3a3c]">
          <span className="font-semibold text-[#1d1d1f]">We couldn&apos;t link this sign-in to a booking yet.</span> If you have an event with us, message the concierge or hold a date and it will appear here.
        </Card>
      )}

      {/* Full width on a phone; on a wide column a button that runs the whole
          way across stops reading as a button. */}
      <PrimaryButton href="/app/book" className="sm:max-w-sm sm:self-center">Reserve a date</PrimaryButton>
      {ov && ov.balanceDue > 0 && <p className="-mt-3 text-center text-meta text-[#6e6e73]">Balance due {inr(ov.balanceDue)} · <Link href="/app/payments" className="font-semibold text-[#6d1b52]">Payments</Link></p>}
      <ContactChip context="Hi Veloria Grand, I have a question about an event." />
    </div>
  );
}
