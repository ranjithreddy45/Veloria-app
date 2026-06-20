"use client";

import {
  UsersIcon,
  AwardIcon,
  TrendingUpIcon,
  CoinsIcon,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";

// ============================================================
// Types
// ============================================================

interface LoyaltyStatsData {
  totalAccounts: number;
  bronzeCount: number;
  silverCount: number;
  goldCount: number;
  platinumCount: number;
  totalPointsOutstanding: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

interface LoyaltyStatsProps {
  stats: LoyaltyStatsData;
}

// ============================================================
// LoyaltyStats Component
// ============================================================

export function LoyaltyStats({ stats }: LoyaltyStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 animate-stagger-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total Members"
        value={stats.totalAccounts}
        accent="blue"
        icon={<UsersIcon />}
        sub={`${stats.platinumCount} Platinum · ${stats.goldCount} Gold`}
      />
      <StatTile
        label="Points Outstanding"
        value={stats.totalPointsOutstanding.toLocaleString("en-IN")}
        accent="amber"
        icon={<CoinsIcon />}
        sub="Active balance across all accounts"
      />
      <StatTile
        label="Total Earned"
        value={stats.totalPointsEarned.toLocaleString("en-IN")}
        accent="emerald"
        icon={<TrendingUpIcon />}
        sub="Lifetime points earned"
      />
      <StatTile
        label="Total Redeemed"
        value={stats.totalPointsRedeemed.toLocaleString("en-IN")}
        accent="violet"
        icon={<AwardIcon />}
        sub="Lifetime points redeemed"
      />
    </div>
  );
}
