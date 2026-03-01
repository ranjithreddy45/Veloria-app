import type { Metadata } from "next";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RatePlanForm } from "../../_components/rate-plan-form";

export const metadata: Metadata = { title: "New Rate Plan" };

// ============================================================
// Create Rate Plan Page
// ============================================================

export default async function NewRatePlanPage() {
  const venuesResult = await getVenues();

  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({
        id: v.id,
        name: v.name,
        isActive: v.isActive,
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Rate Plan"
        description="Create a rate plan with base and per-guest pricing."
      />
      <div className="mx-auto max-w-3xl">
        <RatePlanForm venues={venues} />
      </div>
    </div>
  );
}
