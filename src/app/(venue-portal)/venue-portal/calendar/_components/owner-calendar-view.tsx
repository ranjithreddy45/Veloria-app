import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import type { VenueCalendar, VenuePortalScope } from "@/lib/venue-owner/portal-data";
import { cn } from "@/lib/utils";
import {
  calendarBounds,
  compareMonths,
  countLabel,
  monthTitle,
  portalHref,
  shiftMonth,
  type YearMonth,
} from "../../../_lib/portal-params";
import { LinkSegments } from "../../../_components/link-segments";
import { OwnerCalendar } from "./owner-calendar";

// ============================================================
// Venue owner calendar — the markup, from plain props.
// ------------------------------------------------------------
// The page clamps the month, checks the venue against the scope and fetches;
// this file only lays it out. Month and venue changes are links (the URL is
// the state), so the grid below needs no data access of its own.
// ============================================================

const NAV_LINK =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground pointer-coarse:size-11";

// Not passed through cn(): tailwind-merge reads text-body as a text colour and
// would drop it in favour of text-foreground.
const THIS_MONTH_LINK =
  "h-9 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-body font-medium text-foreground transition-colors hover:bg-muted/50 pointer-coarse:h-11";

export function OwnerCalendarView({
  scope,
  selected,
  shown,
  current,
  calendar,
  today,
}: {
  scope: VenuePortalScope;
  /** A venue id from the scope, or "all". */
  selected: string;
  shown: YearMonth;
  /** The current India month. */
  current: YearMonth;
  calendar: VenueCalendar;
  /** Today's India date, yyyy-mm-dd. */
  today: string;
}) {
  const { min, max } = calendarBounds(current);
  const prev = shiftMonth(shown, -1);
  const next = shiftMonth(shown, 1);
  const canPrev = compareMonths(prev, min) >= 0;
  const canNext = compareMonths(next, max) <= 0;
  const isCurrent = compareMonths(shown, current) === 0;
  const hrefFor = (ym: YearMonth, venue: string = selected) =>
    portalHref("/venue-portal/calendar", { year: ym.year, month: ym.month, venue });

  const selectedVenue = scope.venues.find((v) => v.id === selected);
  const title = selectedVenue?.name ?? (scope.venues.length === 1 ? scope.venues[0].name : "All your venues");
  const venueSegments = [
    { key: "all", label: "All venues", href: hrefFor(shown, "all") },
    ...scope.venues.map((v) => ({ key: v.id, label: v.name, href: hrefFor(shown, v.id) })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={scope.preview ? "Owner preview · Calendar" : "Calendar"}
        title={title}
        description="What is booked, held and being asked about, date by date."
        module={false}
      />

      {scope.venues.length > 1 && <LinkSegments label="Venue" segments={venueSegments} active={selected} />}

      {/* Month bar: prev / month / next, then the month's totals. */}
      <div className="flex flex-col gap-3 surface-glass rounded-2xl p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {canPrev ? (
            <Link href={hrefFor(prev)} scroll={false} className={NAV_LINK} aria-label={`Previous month, ${monthTitle(prev)}`}>
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className={cn(NAV_LINK, "pointer-events-none opacity-40")} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
          <h2 className="min-w-0 flex-1 text-center text-lede font-semibold tracking-[-0.01em] tabular-nums sm:min-w-[180px] sm:flex-none">
            {monthTitle(shown)}
          </h2>
          {canNext ? (
            <Link href={hrefFor(next)} scroll={false} className={NAV_LINK} aria-label={`Next month, ${monthTitle(next)}`}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={cn(NAV_LINK, "pointer-events-none opacity-40")} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
          {!isCurrent && (
            <Link href={hrefFor(current)} scroll={false} className={`${THIS_MONTH_LINK} ml-1 hidden sm:inline-flex`}>
              This month
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* On a phone the month row has no room left for this link (44px
              touch arrows either side of "September 2026"), so it leads the
              totals row instead. */}
          {!isCurrent && (
            <Link href={hrefFor(current)} scroll={false} className={`${THIS_MONTH_LINK} mr-1 inline-flex sm:hidden`}>
              This month
            </Link>
          )}
          <div role="group" aria-label={`${monthTitle(shown)} totals`} className="flex flex-wrap items-center gap-1.5">
            <StatusPill label={countLabel("booking", calendar.totals.bookings)} hue="emerald" />
            <StatusPill label={countLabel("hold", calendar.totals.holds)} hue="amber" />
            <StatusPill label={countLabel("lead", calendar.totals.leads)} hue="sky" />
          </div>
        </div>
      </div>

      <OwnerCalendar
        // Remount per month and venue so the selected day never carries over
        // to a month it does not belong to.
        key={`${shown.year}-${shown.month}-${selected}`}
        year={shown.year}
        month={shown.month}
        days={calendar.days}
        today={today}
      />
    </div>
  );
}
