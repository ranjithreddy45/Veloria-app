import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getReferrals, getReferralStats } from "@/actions/referral.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReferralStats } from "./_components/referral-stats";
import { ReferralTable } from "./_components/referral-table";

export const metadata: Metadata = {
  title: "Referrals | Veloria Grand",
};

// ============================================================
// Referrals List Page
// ============================================================

export default async function ReferralsPage() {
  const [referralsResult, statsResult] = await Promise.all([
    getReferrals(),
    getReferralStats(),
  ]);

  const referrals = referralsResult.success ? referralsResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : {
        total: 0,
        pending: 0,
        contacted: 0,
        converted: 0,
        expired: 0,
        conversionRate: 0,
      };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description="Track client referrals and reward loyal customers."
      >
        <Button asChild>
          <Link href="/referrals/new">
            <PlusIcon className="mr-2 size-4" />
            New Referral
          </Link>
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <ReferralStats stats={stats} />

      {/* Referrals Table */}
      <ReferralTable data={referrals} />
    </div>
  );
}
