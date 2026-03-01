import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRatePlan } from "@/actions/pricing.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RatePlanForm } from "../../../_components/rate-plan-form";

export const metadata: Metadata = { title: "Edit Rate Plan" };

// ============================================================
// Edit Rate Plan Page
// ============================================================

interface EditRatePlanPageProps {
  params: Promise<{ planId: string }>;
}

export default async function EditRatePlanPage({
  params,
}: EditRatePlanPageProps) {
  const { planId } = await params;

  const [planResult, venuesResult] = await Promise.all([
    getRatePlan(planId),
    getVenues(),
  ]);

  if (!planResult.success || !planResult.data) {
    notFound();
  }

  const plan = planResult.data;
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
        title="Edit Rate Plan"
        description={`Editing "${plan.name}"`}
      />
      <div className="mx-auto max-w-3xl">
        <RatePlanForm
          plan={{
            id: plan.id,
            name: plan.name,
            description: plan.description,
            baseRate: Number(plan.baseRate),
            perGuestRate: Number(plan.perGuestRate),
            isDefault: plan.isDefault,
            isActive: plan.isActive,
            venueId: plan.venueId,
          }}
          venues={venues}
        />
      </div>
    </div>
  );
}
