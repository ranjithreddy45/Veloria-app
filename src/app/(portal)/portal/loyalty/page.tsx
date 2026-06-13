import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  CoinsIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AwardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SlidersHorizontalIcon,
  MinusIcon,
  Sparkles,
} from "lucide-react";

import { auth } from "@/../auth";
import { getPortalLoyalty } from "@/actions/loyalty.actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  LOYALTY_TIER_COLORS,
  LOYALTY_TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Loyalty & Rewards",
};

// ============================================================
// Tier Thresholds
// ============================================================

const TIER_THRESHOLDS = [
  { tier: "BRONZE", min: 0, max: 499 },
  { tier: "SILVER", min: 500, max: 1999 },
  { tier: "GOLD", min: 2000, max: 4999 },
  { tier: "PLATINUM", min: 5000, max: Infinity },
];

function getTierProgress(tier: string, totalEarned: number) {
  const currentTierIdx = TIER_THRESHOLDS.findIndex((t) => t.tier === tier);
  const currentTier = TIER_THRESHOLDS[currentTierIdx];
  const nextTier = TIER_THRESHOLDS[currentTierIdx + 1];

  if (!nextTier) {
    return { progress: 100, nextTierName: null, pointsToNext: 0 };
  }

  const range = nextTier.min - currentTier.min;
  const earned = totalEarned - currentTier.min;
  const progress = Math.min(Math.round((earned / range) * 100), 100);
  const pointsToNext = Math.max(nextTier.min - totalEarned, 0);

  return { progress, nextTierName: nextTier.tier, pointsToNext };
}

// ============================================================
// Transaction Type Helpers
// ============================================================

function TransactionIcon({ type }: { type: string }) {
  switch (type) {
    case "EARNED":
      return <ArrowUpIcon className="size-4 text-emerald-600" />;
    case "REDEEMED":
      return <ArrowDownIcon className="size-4 text-purple-600" />;
    case "EXPIRED":
      return <MinusIcon className="size-4 text-zinc-400" />;
    case "ADJUSTED":
      return <SlidersHorizontalIcon className="size-4 text-blue-600" />;
    default:
      return <CoinsIcon className="size-4 text-zinc-400" />;
  }
}

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  EARNED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REDEEMED: "bg-purple-100 text-purple-700 border-purple-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 border-zinc-200",
  ADJUSTED: "bg-blue-100 text-blue-700 border-blue-200",
};

// ============================================================
// Portal Loyalty Page
// ============================================================

export default async function PortalLoyaltyPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getPortalLoyalty(session.user.id);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Loyalty & Rewards
        </h1>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AwardIcon className="size-12 text-zinc-300" />
            <p className="mt-4 text-sm font-medium text-zinc-500">
              Unable to load loyalty data
            </p>
            <p className="text-xs text-zinc-400">
              Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const account = result.data;

  // No loyalty account yet
  if (!account) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Loyalty & Rewards
        </h1>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AwardIcon className="size-12 text-zinc-300" />
            <p className="mt-4 text-sm font-medium text-zinc-500">
              No loyalty account yet
            </p>
            <p className="text-xs text-zinc-400 max-w-sm">
              Your loyalty account will be activated when you start earning
              points through bookings and referrals.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierProgress = getTierProgress(account.tier, account.totalEarned);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-200">
            <Sparkles className="size-4" />
            <span className="text-sm font-medium">Loyalty & Rewards</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {account.points.toLocaleString("en-IN")}
            </h1>
            <span className="text-lg text-amber-200">points</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge
              status={account.tier}
              colorMap={{
                BRONZE: "bg-white/20 text-white border-white/30",
                SILVER: "bg-white/20 text-white border-white/30",
                GOLD: "bg-white/20 text-white border-white/30",
                PLATINUM: "bg-white/20 text-white border-white/30",
              }}
            />
            {tierProgress.nextTierName && (
              <span className="text-sm text-amber-200">
                {tierProgress.pointsToNext.toLocaleString("en-IN")} pts to{" "}
                {tierProgress.nextTierName}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {tierProgress.nextTierName && (
            <div className="mt-4 space-y-1">
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${tierProgress.progress}%` }}
                />
              </div>
              <div className="flex max-w-xs justify-between text-xs text-amber-200">
                <span>{account.tier}</span>
                <span>{tierProgress.nextTierName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">
                  Available Points
                </p>
                <p className="text-2xl font-bold tracking-tight text-amber-700">
                  {account.points.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <CoinsIcon className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">
                  Total Earned
                </p>
                <p className="text-2xl font-bold tracking-tight text-emerald-700">
                  {account.totalEarned.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <TrendingUpIcon className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">
                  Total Redeemed
                </p>
                <p className="text-2xl font-bold tracking-tight text-purple-700">
                  {account.totalRedeemed.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <TrendingDownIcon className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Tier Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {TIER_THRESHOLDS.map((t) => (
              <div
                key={t.tier}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                  t.tier === account.tier
                    ? "border-amber-200 bg-amber-50 ring-1 ring-amber-200"
                    : "border-zinc-100 bg-zinc-50/50"
                }`}
              >
                <StatusBadge
                  status={t.tier}
                  colorMap={LOYALTY_TIER_COLORS}
                />
                <p className="text-xs text-muted-foreground">
                  {t.min === 0
                    ? "0 - 499 pts"
                    : t.max === Infinity
                      ? `${t.min.toLocaleString("en-IN")}+ pts`
                      : `${t.min.toLocaleString("en-IN")} - ${t.max.toLocaleString("en-IN")} pts`}
                </p>
                {t.tier === account.tier && (
                  <span className="text-[10px] font-semibold uppercase text-amber-700">
                    Current
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {account.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CoinsIcon className="size-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-500">
                No activity yet
              </p>
              <p className="text-xs text-zinc-400">
                Your points activity will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {account.transactions.map((tx: {
                id: string;
                type: string;
                points: number;
                description: string;
                referenceId: string | null;
                createdAt: string;
              }) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-white dark:bg-card border border-zinc-100">
                    <TransactionIcon type={tx.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {tx.description}
                      </p>
                      <Badge
                        variant="outline"
                        className={`border text-[10px] font-medium shrink-0 ${
                          TRANSACTION_TYPE_COLORS[tx.type] ?? ""
                        }`}
                      >
                        {LOYALTY_TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(tx.createdAt), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                  <div
                    className={`text-sm font-bold shrink-0 ${
                      tx.type === "EARNED" || (tx.type === "ADJUSTED" && tx.points > 0)
                        ? "text-emerald-700"
                        : tx.type === "REDEEMED" ||
                            (tx.type === "ADJUSTED" && tx.points < 0)
                          ? "text-red-600"
                          : "text-zinc-500"
                    }`}
                  >
                    {tx.type === "EARNED" || (tx.type === "ADJUSTED" && tx.points > 0)
                      ? "+"
                      : tx.type === "REDEEMED"
                        ? "-"
                        : ""}
                    {Math.abs(tx.points).toLocaleString("en-IN")} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
