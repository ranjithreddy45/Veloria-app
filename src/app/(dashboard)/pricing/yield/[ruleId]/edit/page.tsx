import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPricingRule } from "@/actions/pricing.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { YieldRuleForm } from "../../_components/yield-rule-form";

export const metadata: Metadata = { title: "Edit Yield Rule" };

// ============================================================
// Edit Yield Rule Page
// ============================================================

interface EditYieldRulePageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function EditYieldRulePage({
  params,
}: EditYieldRulePageProps) {
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
    ? venuesResult.data
        .filter((v) => v.isActive)
        .map((v) => ({ id: v.id, name: v.name }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Yield Rule"
        description={`Editing "${rule.name}"`}
      />
      <div className="mx-auto max-w-3xl">
        <YieldRuleForm
          rule={{
            id: rule.id,
            name: rule.name,
            ruleType: rule.ruleType,
            multiplier: Number(rule.multiplier),
            conditions: rule.conditions,
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
