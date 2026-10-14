import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVenueCalendar, selectVenues } from "@/lib/venue-owner/portal-data";
import { dbDateKey, istToday, lastMonths } from "@/lib/venue-owner/buckets";
import { getPortalScope } from "../../_lib/scope";
import { firstParam, parseCalendarMonth, type YearMonth } from "../../_lib/portal-params";
import { NoVenues } from "../../_components/no-venues";
import { OwnerCalendarView } from "./_components/owner-calendar-view";

export const metadata: Metadata = { title: "Calendar | Venue Portal" };

// ============================================================
// Venue owner calendar — per-date counts for one India month.
// ------------------------------------------------------------
// ?year=&month= are clamped (parseCalendarMonth) and default to the current
// India month; ?venue= is honoured only when it is one of the owner's venues.
// The grid gets counts and, per day, items carrying slot / event type / guest
// count only — getVenueCalendar never selects a name, contact, id or amount.
// ============================================================

export default async function VenuePortalCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[]; month?: string | string[]; venue?: string | string[] }>;
}) {
  const scope = await getPortalScope();
  if (!scope) redirect("/not-authorized");
  if (scope.venues.length === 0) return <NoVenues eyebrow="Calendar" />;

  const params = await searchParams;
  const now = new Date();
  const { year, month } = lastMonths(now, 1)[0];
  const current: YearMonth = { year, month };
  const shown = parseCalendarMonth(firstParam(params.year), firstParam(params.month), current);
  const { ids, selected } = selectVenues(scope, firstParam(params.venue));
  const calendar = await getVenueCalendar(ids, scope.venues, shown.year, shown.month, now);

  return (
    <OwnerCalendarView
      scope={scope}
      selected={selected}
      shown={shown}
      current={current}
      calendar={calendar}
      today={dbDateKey(istToday(now))}
    />
  );
}
