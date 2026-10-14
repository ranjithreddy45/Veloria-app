import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarDays, Hourglass, Inbox, Info, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import type { VenueDashboard, VenuePortalScope } from "@/lib/venue-owner/portal-data";
import { PERIODS, type PeriodKey } from "@/lib/venue-owner/buckets";
import { portalHref } from "../../_lib/portal-params";
import { LinkSegments } from "../../_components/link-segments";
import { OwnerTrendChart } from "./owner-trend-chart";

// ============================================================
// Venue owner dashboard — the markup, from plain props.
// ------------------------------------------------------------
// The page fetches (scope + getVenueDashboard) and hands the result here, so
// this file never touches the database or the session. Counts only: no money,
// no customer, no record id is in VenueDashboard to begin with.
// ============================================================

/** How each period reads at the end of a tile's sub line. */
const PERIOD_PHRASE: Record<PeriodKey, string> = {
  month: "this month",
  quarter: "in the last 3 months",
  year: "in the last 12 months",
  all: "to date",
};

export function OwnerDashboardView({
  scope,
  selected,
  period,
  dash,
}: {
  scope: VenuePortalScope;
  /** A venue id from the scope, or "all". */
  selected: string;
  period: PeriodKey;
  dash: VenueDashboard;
}) {
  const selectedVenue = scope.venues.find((v) => v.id === selected);
  const title = selectedVenue?.name ?? (scope.venues.length === 1 ? scope.venues[0].name : "All your venues");
  const phrase = PERIOD_PHRASE[period];
  const trendTotal = dash.trend.reduce((n, m) => n + m.leads + m.converted + m.bookings, 0);

  const venueSegments = [
    { key: "all", label: "All venues", href: portalHref("/venue-portal", { venue: "all", period }) },
    ...scope.venues.map((v) => ({ key: v.id, label: v.name, href: portalHref("/venue-portal", { venue: v.id, period }) })),
  ];
  const periodSegments = PERIODS.map((p) => ({
    key: p.key,
    label: p.label,
    href: portalHref("/venue-portal", { venue: selected, period: p.key }),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={scope.preview ? "Owner preview" : "Venue owner"}
        title={title}
        description="How many enquiries name your venue, how many became bookings, and what is coming up."
        module={false}
        actions={
          <Button variant="outline" className="gap-2 rounded-xl pointer-coarse:min-h-11" asChild>
            <Link href={portalHref("/venue-portal/calendar", { venue: selected })}>
              <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
              Open calendar
            </Link>
          </Button>
        }
      />

      {/* Filters: one row above the figures, stacking on a phone. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {scope.venues.length > 1 && <LinkSegments label="Venue" segments={venueSegments} active={selected} />}
        <LinkSegments label="Period" segments={periodSegments} active={period} grid />
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Leads generated" value={dash.leads} accent="blue" icon={<Inbox className="size-4" />} sub={`Received ${phrase}`} />
        {/* The ring needs 48px of a ~171px phone tile, which leaves the label
            too little room for "CONVERTED"; below sm the tile shows the chip
            instead and the percentage rides in the sub line alone. */}
        <StatTile
          label="Leads converted"
          value={dash.converted}
          accent="indigo"
          icon={<Trophy className="size-4" />}
          sub={`${dash.conversionPct}% conversion`}
          className="sm:hidden"
        />
        <StatTile
          label="Leads converted"
          value={dash.converted}
          accent="indigo"
          icon={<Trophy className="size-4" />}
          pct={dash.conversionPct}
          sub={`${dash.conversionPct}% conversion`}
          className="hidden sm:block"
        />
        <StatTile
          label="Confirmed bookings"
          value={dash.bookings}
          accent="emerald"
          icon={<CalendarCheck className="size-4" />}
          sub={`Events ${phrase}`}
        />
        <StatTile
          label="Upcoming events"
          value={dash.upcomingEvents}
          accent="teal"
          icon={<CalendarClock className="size-4" />}
          sub="Confirmed, from today"
        />
        {/* Spans both columns on a phone so five tiles leave no orphan. */}
        <StatTile
          label="Tentative holds"
          value={dash.tentativeHolds}
          accent="amber"
          icon={<Hourglass className="size-4" />}
          sub="Dates held, not yet confirmed"
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-lede">Last 6 months</CardTitle>
            {/* A plain <p>, not CardDescription + className: cn() would read
                text-body as a colour and drop the muted ink. */}
            <p className="text-body text-muted-foreground">
              Enquiries received and converted by the month they came in; bookings by the month of the event.
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {trendTotal === 0 ? (
              <p className="px-3 py-12 text-center text-body text-muted-foreground sm:px-0">
                No enquiries or bookings in the last six months yet.
              </p>
            ) : (
              <OwnerTrendChart data={dash.trend} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lede">
              <Info className="size-4 text-muted-foreground" aria-hidden />
              About these numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-body leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Leads</span> count when the enquiry names this venue or has
                a quotation for it. Many enquiries (for example from ads) arrive without a venue and are not counted here.
              </li>
              <li>
                <span className="font-medium text-foreground">Converted</span> means the enquiry was won, or its
                quotation for this venue became a booking.
              </li>
              <li>
                <span className="font-medium text-foreground">Bookings</span> are confirmed events (advance paid),
                counted by event date.
              </li>
              <li>
                <span className="font-medium text-foreground">Tentative holds</span> are upcoming dates held for a
                customer but not yet confirmed. Lapsed holds are left out.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
