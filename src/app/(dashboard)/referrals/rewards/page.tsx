import type { Metadata } from "next";
import Link from "next/link";
import {
  GiftIcon,
  ArrowLeftIcon,
} from "lucide-react";

import { getReferralDashboard } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { REFERRAL_REWARD_STATUS_COLORS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";

import { ApproveRewardButton, MarkPaidButton } from "./_components/reward-actions";

export const metadata: Metadata = {
  title: "Referral Rewards | Veloria Grand",
};

// ============================================================
// Reward Status Labels
// ============================================================

const REWARD_STATUS_LABELS: Record<string, string> = {
  REWARD_PENDING: "Pending",
  ELIGIBLE: "Eligible",
  REWARD_APPROVED: "Approved",
  REWARD_PAID: "Paid",
  REWARD_CANCELLED: "Cancelled",
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  POINTS: "Points",
  CASH: "Cash",
  DISCOUNT: "Discount",
};

// ============================================================
// Referral Rewards Page
// ============================================================

async function getRewards() {
  try {
    const rewards = await prisma.referralReward.findMany({
      include: {
        referral: {
          select: {
            id: true,
            referredName: true,
            referrerContact: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        rule: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return serialize(rewards);
  } catch {
    return [];
  }
}

export default async function ReferralRewardsPage() {
  const [dashboardResult, rewards] = await Promise.all([
    getReferralDashboard(),
    getRewards(),
  ]);

  const pendingCount = dashboardResult.success
    ? dashboardResult.data?.pendingRewards.count ?? 0
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral Rewards"
        description="Manage and process referral reward payouts."
      >
        <Button variant="outline" asChild>
          <Link href="/referrals/dashboard">
            <ArrowLeftIcon className="mr-2 size-4" />
            Dashboard
          </Link>
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rewards.length}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending/Eligible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {rewards.filter((r: any) => r.status === "REWARD_PAID").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reward Cards */}
      {rewards.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GiftIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No rewards found
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Rewards are created automatically when referrals convert.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {rewards.map((reward: any) => {
            const referral = reward.referral;
            const referrerName = referral?.referrerContact
              ? `${referral.referrerContact.firstName} ${referral.referrerContact.lastName}`
              : "Unknown";
            const referredName = referral?.referredName || "Unknown";
            const statusColor =
              REFERRAL_REWARD_STATUS_COLORS[reward.status] || "";

            return (
              <Card
                key={reward.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {REWARD_TYPE_LABELS[reward.rewardType] ||
                          reward.rewardType}
                      </Badge>
                      <p className="mt-2 text-xl font-bold tabular-nums">
                        {reward.rewardType === "CASH"
                          ? Number(reward.rewardValue).toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })
                          : reward.rewardType === "DISCOUNT"
                          ? `${Number(reward.rewardValue)}% off`
                          : `${Number(reward.rewardValue)} pts`}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColor}>
                      {REWARD_STATUS_LABELS[reward.status] || reward.status}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Referrer:
                      </span>{" "}
                      {referrerName}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Referred:
                      </span>{" "}
                      {referredName}
                    </p>
                    {reward.rule && (
                      <p>
                        <span className="font-medium text-foreground">
                          Rule:
                        </span>{" "}
                        {reward.rule.name}
                      </p>
                    )}
                  </div>

                  {reward.paidAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Paid on{" "}
                      {new Date(reward.paidAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {reward.paymentRef && ` (Ref: ${reward.paymentRef})`}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-4 flex items-center gap-2">
                    {(reward.status === "ELIGIBLE" ||
                      reward.status === "REWARD_PENDING") && (
                      <ApproveRewardButton rewardId={reward.id} />
                    )}
                    {reward.status === "REWARD_APPROVED" && (
                      <MarkPaidButton rewardId={reward.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
