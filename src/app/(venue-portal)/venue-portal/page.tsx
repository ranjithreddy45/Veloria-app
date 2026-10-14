import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVenueDashboard, selectVenues } from "@/lib/venue-owner/portal-data";
import { parsePeriod, periodRange } from "@/lib/venue-owner/buckets";
import { getPortalScope } from "../_lib/scope";
import { firstParam } from "../_lib/portal-params";
import { NoVenues } from "../_components/no-venues";
import { OwnerDashboardView } from "./_components/owner-dashboard-view";

export const metadata: Metadata = { title: "Dashboard | Venue Portal" };

// ============================================================
// Venue owner dashboard — counts only.
// ------------------------------------------------------------
// Every figure comes from getVenueDashboard(), scoped to the owner's venues on
// the server. ?venue= is honoured only when it is one of those venues
// (selectVenues ignores anything else); ?period= is clamped by parsePeriod.
// ============================================================

export default async function VenuePortalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string | string[]; period?: string | string[] }>;
}) {
  const scope = await getPortalScope();
  if (!scope) redirect("/not-authorized");
  if (scope.venues.length === 0) return <NoVenues eyebrow="Venue owner" />;

  const params = await searchParams;
  const { ids, selected } = selectVenues(scope, firstParam(params.venue));
  const period = parsePeriod(firstParam(params.period));
  const now = new Date();
  const dash = await getVenueDashboard(ids, periodRange(period, now), now);

  return <OwnerDashboardView scope={scope} selected={selected} period={period} dash={dash} />;
}
