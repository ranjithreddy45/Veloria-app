import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { getReferralRewardRules } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReferralRuleForm } from "../../_components/referral-rule-form";

export const metadata: Metadata = {
  title: "Edit Referral Reward Rule | Settings | Veloria Grand",
};

// ============================================================
// Edit Referral Reward Rule Page
// ============================================================

interface EditReferralRulePageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function EditReferralRulePage({
  params,
}: EditReferralRulePageProps) {
  const { ruleId } = await params;

  // Fetch all rules and find the one we need
  const result = await getReferralRewardRules();
  if (!result.success || !result.data) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rule = (result.data as any[]).find((r) => r.id === ruleId);
  if (!rule) {
    notFound();
  }

  const initialData = {
    id: rule.id,
    name: rule.name,
    description: rule.description || "",
    triggerEvent: rule.triggerEvent as
      | "BOOKING_CONFIRMED"
      | "HIGH_VALUE_BOOKING"
      | "REPEAT_REFERRAL",
    rewardType: rule.rewardType as "POINTS" | "CASH" | "DISCOUNT",
    rewardValue: Number(rule.rewardValue),
    minBookingValue:
      rule.minBookingValue != null ? Number(rule.minBookingValue) : undefined,
    bonusMultiplier:
      rule.bonusMultiplier != null ? Number(rule.bonusMultiplier) : undefined,
    tierLevel: rule.tierLevel,
    isActive: rule.isActive,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Referral Reward Rule"
        description={`Editing "${rule.name}"`}
      >
        <Button variant="outline" asChild>
          <Link href="/settings/referral-rules">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Rules
          </Link>
        </Button>
      </PageHeader>
      <div className="mx-auto max-w-2xl">
        <ReferralRuleForm initialData={initialData} />
      </div>
    </div>
  );
}
