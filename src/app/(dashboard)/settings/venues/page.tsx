import type { Metadata } from "next";
import { getVenues } from "@/actions/booking.actions";
import { getVenueHierarchy } from "@/actions/multi-venue.actions";
import { getPublicPhotoCountsByVenue } from "@/actions/gallery.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { VenuesList } from "./_components/venues-list";
import { VenueHierarchy } from "./_components/venue-hierarchy";
import { VenuePublicInfoEditor } from "./_components/venue-public-info-editor";

export const metadata: Metadata = { title: "Venue Management" };

// ============================================================
// Venues Management Page
// ============================================================

export default async function VenuesPage() {
  const [venuesResult, hierarchyResult, photoCounts] = await Promise.all([
    getVenues({ activeOnly: false }), // management screen — show inactive venues too
    getVenueHierarchy(),
    getPublicPhotoCountsByVenue(),
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
      <VenuePublicInfoEditor venues={venues} photoCounts={photoCounts} />
      <VenueHierarchy venues={hierarchyVenues} />
    </div>
  );
}
