import type { Metadata } from "next";
import {
  Building2Icon,
  ClockIcon,
  BadgeCheckIcon,
  TrendingUpIcon,
} from "lucide-react";

import {
  getCorporateAccounts,
  getCorporateFarmingStats,
} from "@/actions/corporate-account.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import {
  AccountWorklist,
  type AccountRow,
} from "./_components/account-worklist";

export const metadata: Metadata = {
  title: "Corporate Accounts",
};

// ============================================================
// Corporate Account-Farming worklist + cockpit
// ============================================================
// Gated centrally via ROUTE_PERMISSIONS /accounts → accounts:read.

export default async function AccountsPage() {
  const [accountsResult, statsResult] = await Promise.all([
    getCorporateAccounts({ pageSize: 200 }),
    getCorporateFarmingStats(),
  ]);

  const rows = (accountsResult.success ? accountsResult.data.rows : []) as AccountRow[];
  const stats = statsResult.success
    ? statsResult.data
    : {
        total: 0,
        byTier: { PROSPECT: 0, ACTIVE: 0, KEY: 0, DORMANT: 0, CHURNED: 0 },
        dueThisQuarter: 0,
        committed: 0,
        churned: 0,
        lifetimeRevenue: 0,
      };

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`Sales · ${stats.total} ${stats.total === 1 ? "account" : "accounts"}`}
        title="Corporate Accounts"
        description="Farm corporate relationships: re-engage on a quarterly cadence, lock multi-event pricing, and grow lifetime value."
      />

      <div className="grid grid-cols-1 gap-4 animate-stagger-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Key accounts"
          value={stats.byTier.KEY}
          accent="violet"
          icon={<Building2Icon />}
          sub={`${stats.byTier.ACTIVE} active · ${stats.byTier.PROSPECT} prospects`}
        />
        <StatTile
          label="Due this quarter"
          value={stats.dueThisQuarter}
          accent="amber"
          icon={<ClockIcon />}
          sub="Accounts due for re-engagement"
        />
        <StatTile
          label="Committed accounts"
          value={stats.committed}
          accent="emerald"
          icon={<BadgeCheckIcon />}
          sub="With a multi-event commitment offer"
        />
        <StatTile
          label="Lifetime revenue"
          value={`₹${stats.lifetimeRevenue.toLocaleString("en-IN")}`}
          accent="blue"
          icon={<TrendingUpIcon />}
          sub={`${stats.byTier.DORMANT} dormant · ${stats.churned} churned`}
        />
      </div>

      <AccountWorklist rows={rows} />
    </div>
  );
}
