import type { Metadata } from "next";
import { getVenues } from "@/actions/booking.actions";
import { getVenueHierarchy } from "@/actions/multi-venue.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { VenuesList } from "./_components/venues-list";
import { VenueHierarchy } from "./_components/venue-hierarchy";

export const metadata: Metadata = { title: "Venue Management" };

// ============================================================
// Venues Management Page
// ============================================================

export default async function VenuesPage() {
  const [venuesResult, hierarchyResult] = await Promise.all([
    getVenues(),
    getVenueHierarchy(),
  ]);

  const venues = venuesResult.success ? venuesResult.data : [];
  const hierarchyVenues = hierarchyResult.success ? hierarchyResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        help={<PageHelp id="venues" />}
        description="Manage your event venues and their availability."
      />
      <VenuesList venues={venues} />
      <VenueHierarchy venues={hierarchyVenues} />
    </div>
  );
}
