import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReferralRuleForm } from "../_components/referral-rule-form";

export const metadata: Metadata = {
  title: "New Referral Reward Rule | Settings | Veloria Grand",
};

// ============================================================
// New Referral Reward Rule Page
// ============================================================

export default function NewReferralRulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Referral Reward Rule"
        description="Define a new rule for rewarding referrers."
      >
        <Button variant="outline" asChild>
          <Link href="/settings/referral-rules">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Rules
          </Link>
        </Button>
      </PageHeader>
      <div className="mx-auto max-w-2xl">
        <ReferralRuleForm />
      </div>
    </div>
  );
}
