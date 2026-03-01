import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPricingRule } from "@/actions/pricing.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PricingRuleForm } from "../../_components/pricing-rule-form";

export const metadata: Metadata = { title: "Edit Pricing Rule" };

// ============================================================
// Edit Pricing Rule Page
// ============================================================

interface EditPricingRulePageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function EditPricingRulePage({
  params,
}: EditPricingRulePageProps) {
  const { ruleId } = await params;

  const [ruleResult, venuesResult] = await Promise.all([
    getPricingRule(ruleId),
    getVenues(),
  ]);

  if (!ruleResult.success || !ruleResult.data) {
    notFound();
  }

  const rule = ruleResult.data;
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
        title="Edit Pricing Rule"
        description={`Editing "${rule.name}"`}
      />
      <div className="mx-auto max-w-3xl">
        <PricingRuleForm
          rule={{
            id: rule.id,
            name: rule.name,
            ruleType: rule.ruleType,
            multiplier: Number(rule.multiplier),
            conditions: rule.conditions,
            startDate: rule.startDate,
            endDate: rule.endDate,
            dayOfWeek: rule.dayOfWeek,
            minDaysAhead: rule.minDaysAhead,
            isActive: rule.isActive,
            priority: rule.priority,
            venueId: rule.venueId,
          }}
          venues={venues}
        />
      </div>
    </div>
  );
}
