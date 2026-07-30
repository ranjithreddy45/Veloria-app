"use client";

import {
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  TrendingUpIcon,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";

// ============================================================
// Types
// ============================================================

interface ReferralStatsData {
  total: number;
  pending: number;
  converted: number;
  conversionRate: number;
}

interface ReferralStatsProps {
  stats: ReferralStatsData;
}

// ============================================================
// ReferralStats Component
// ============================================================

export function ReferralStats({ stats }: ReferralStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 animate-stagger-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total Referrals"
        value={stats.total}
        accent="blue"
        icon={<UsersIcon />}
      />
      <StatTile
        label="Pending"
        value={stats.pending}
        accent="amber"
        icon={<ClockIcon />}
      />
      <StatTile
        label="Converted"
        value={stats.converted}
        accent="emerald"
        icon={<CheckCircleIcon />}
      />
      <StatTile
        label="Conversion Rate"
        value={`${stats.conversionRate}%`}
        accent="gold"
        icon={<TrendingUpIcon />}
        pct={Math.max(0, Math.min(100, stats.conversionRate))}
      />
    </div>
  );
}
