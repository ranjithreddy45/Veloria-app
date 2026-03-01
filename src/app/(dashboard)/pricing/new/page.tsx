import type { Metadata } from "next";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PricingRuleForm } from "../_components/pricing-rule-form";

export const metadata: Metadata = { title: "New Pricing Rule" };

// ============================================================
// Create Pricing Rule Page
// ============================================================

export default async function NewPricingRulePage() {
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
        title="New Pricing Rule"
        description="Create a dynamic pricing rule for a venue."
      />
      <div className="mx-auto max-w-3xl">
        <PricingRuleForm venues={venues} />
      </div>
    </div>
  );
}
