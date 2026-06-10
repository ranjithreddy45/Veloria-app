import type { Metadata } from "next";

import { getLoyaltyAccounts, getLoyaltyStats } from "@/actions/loyalty.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { LoyaltyStats } from "./_components/loyalty-stats";
import { LoyaltyTable } from "./_components/loyalty-table";

export const metadata: Metadata = {
  title: "Loyalty & Rewards | Veloria Grand",
};

// ============================================================
// Loyalty Accounts List Page
// ============================================================

export default async function LoyaltyPage() {
  const [accountsResult, statsResult] = await Promise.all([
    getLoyaltyAccounts(),
    getLoyaltyStats(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : {
        totalAccounts: 0,
        bronzeCount: 0,
        silverCount: 0,
        goldCount: 0,
        platinumCount: 0,
        totalPointsOutstanding: 0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0,
      };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty & Rewards"
        help={<PageHelp id="loyalty" />}
        description="Manage loyalty accounts, track points, and reward your clients."
      />

      {/* Stats Cards */}
      <LoyaltyStats stats={stats} />

      {/* Loyalty Accounts Table */}
      <LoyaltyTable data={accounts} />
    </div>
  );
}
