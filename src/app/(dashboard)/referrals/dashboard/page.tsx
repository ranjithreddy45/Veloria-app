import type { Metadata } from "next";
import Link from "next/link";
import {
  UsersIcon,
  PercentIcon,
  IndianRupeeIcon,
  GiftIcon,
  TrendingUpIcon,
  ArrowRightIcon,
} from "lucide-react";

import { getReferralDashboard } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { REFERRAL_STATUS_COLORS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Referral Dashboard | Veloria Grand",
};

// ============================================================
// Status label map
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  contacted: "Contacted",
  leadCreated: "Lead Created",
  bookingConfirmed: "Booking Confirmed",
  converted: "Converted",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: REFERRAL_STATUS_COLORS.PENDING || "",
  contacted: REFERRAL_STATUS_COLORS.CONTACTED || "",
  leadCreated: "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40",
  bookingConfirmed: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  converted: REFERRAL_STATUS_COLORS.CONVERTED || "",
  expired: REFERRAL_STATUS_COLORS.EXPIRED || "",
  cancelled: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

// ============================================================
// Referral Dashboard Page
// ============================================================

export default async function ReferralDashboardPage() {
  const result = await getReferralDashboard();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Referral Dashboard"
          description="Overview of your referral engine performance."
        />
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UsersIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              Unable to load referral data
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral Dashboard"
        description="Overview of your referral engine performance."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/referrals/leaderboard">
              <TrendingUpIcon className="mr-2 size-4" />
              Leaderboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/referrals/rewards">
              <GiftIcon className="mr-2 size-4" />
              Rewards
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.total}</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversion Rate
            </CardTitle>
            <PercentIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.conversionRate}%</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Booking Value
            </CardTitle>
            <IndianRupeeIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.totalBookingValue.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Rewards
            </CardTitle>
            <GiftIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.pendingRewards.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Value:{" "}
              {data.pendingRewards.value.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.byStatus).map(([key, count]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3"
              >
                <Badge
                  variant="outline"
                  className={STATUS_COLOR_MAP[key] || ""}
                >
                  {STATUS_LABELS[key] || key}
                </Badge>
                <span className="text-lg font-semibold tabular-nums">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Referrers */}
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top 5 Referrers</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/referrals/leaderboard">
              View All
              <ArrowRightIcon className="ml-1 size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.topReferrers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No referrers yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.topReferrers.map(
                (
                  referrer: {
                    contactId: string;
                    name: string;
                    email: string | null;
                    referralCount: number;
                  },
                  index: number
                ) => (
                  <div
                    key={referrer.contactId}
                    className="flex items-center gap-4 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{referrer.name}</p>
                      {referrer.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {referrer.email}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="tabular-nums">
                      {referrer.referralCount} referral
                      {referrer.referralCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
