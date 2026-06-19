import type { Metadata } from "next";

import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { YieldRuleForm } from "../_components/yield-rule-form";

export const metadata: Metadata = { title: "New Yield Rule" };

// ============================================================
// Create Yield Rule Page
// ============================================================

export default async function NewYieldRulePage() {
  const venuesResult = await getVenues();

  const venues = venuesResult.success
    ? venuesResult.data
        .filter((v) => v.isActive)
        .map((v) => ({ id: v.id, name: v.name }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Yield Rule"
        description="Create an occupancy-, demand-, or lead-time-based pricing rule."
      />
      <div className="mx-auto max-w-3xl">
        <YieldRuleForm venues={venues} />
      </div>
    </div>
  );
}
