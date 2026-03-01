"use client";

import {
  UsersIcon,
  AwardIcon,
  TrendingUpIcon,
  CoinsIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Members
          </CardTitle>
          <UsersIcon className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAccounts}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.platinumCount} Platinum, {stats.goldCount} Gold
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Points Outstanding
          </CardTitle>
          <CoinsIcon className="size-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700">
            {stats.totalPointsOutstanding.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active balance across all accounts
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Earned
          </CardTitle>
          <TrendingUpIcon className="size-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-700">
            {stats.totalPointsEarned.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lifetime points earned
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Redeemed
          </CardTitle>
          <AwardIcon className="size-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">
            {stats.totalPointsRedeemed.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lifetime points redeemed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
