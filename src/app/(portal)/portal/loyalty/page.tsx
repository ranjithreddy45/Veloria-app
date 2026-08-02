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
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  LOYALTY_TIER_COLORS,
  LOYALTY_TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Loyalty & Rewards",
};

// Customer-facing empty states keep the editorial serif headline.
const PORTAL_EMPTY = "[&_p:first-of-type]:font-editorial [&_p:first-of-type]:text-lede";

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
      return (
        <ArrowUpIcon className="text-success size-4" />
      );
    case "REDEEMED":
      return <ArrowDownIcon className="text-primary size-4" />;
    case "EXPIRED":
      return <MinusIcon className="text-muted-foreground/60 size-4" />;
    case "ADJUSTED":
      return (
        <SlidersHorizontalIcon className="text-muted-foreground size-4" />
      );
    default:
      return <CoinsIcon className="text-muted-foreground/60 size-4" />;
  }
}

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  EARNED: "bg-success/12 text-success border-success/25",
  REDEEMED: "bg-primary/10 text-primary border-primary/25",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  ADJUSTED: "bg-muted text-muted-foreground border-border",
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
      <div className="space-y-10">
        <PageHeader
          eyebrow="Your account"
          title="Loyalty & Rewards"
          description="Points you've collected with us, and what they unlock next."
        />
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-0">
            <EmptyState
              icon={<AwardIcon />}
              title="We couldn't reach your rewards"
              description="Nothing is lost — your points are safe. Refresh in a moment and they'll be right back."
              className={PORTAL_EMPTY}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const account = result.data;

  // No loyalty account yet
  if (!account) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Your account"
          title="Loyalty & Rewards"
          description="Points you've collected with us, and what they unlock next."
        />
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-0">
            <EmptyState
              icon={<AwardIcon />}
              title="Your first points are waiting"
              description="Book with us or introduce a friend, and your rewards account opens itself — nothing to sign up for."
              className={PORTAL_EMPTY}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierProgress = getTierProgress(account.tier, account.totalEarned);

  return (
    <div className="space-y-10">
      {/* Hero Banner */}
      <div className="shadow-card border-warning/25 bg-warning/[0.07] relative overflow-hidden rounded-2xl border px-6 py-8 sm:px-8 sm:py-10">
        <div className="bg-warning/12 pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl" />
        <div className="relative">
          <div className="text-warning flex items-center gap-2">
            <Sparkles className="size-3.5" />
            <span className="text-meta font-semibold uppercase tracking-[0.14em]">
              Your account
            </span>
          </div>
          <h1 className="large-title text-foreground mt-2.5 text-h2 leading-tight sm:text-h1">
            Loyalty &amp; Rewards
          </h1>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="numeric text-foreground text-display font-semibold leading-none sm:text-display">
              {account.points.toLocaleString("en-IN")}
            </span>
            <span className="text-muted-foreground text-base">
              points to spend
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <StatusBadge status={account.tier} colorMap={LOYALTY_TIER_COLORS} />
            {tierProgress.nextTierName && (
              <span className="text-muted-foreground text-sm">
                <span className="numeric">
                  {tierProgress.pointsToNext.toLocaleString("en-IN")}
                </span>{" "}
                more to {tierProgress.nextTierName.toLowerCase()}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {tierProgress.nextTierName && (
            <div className="mt-5 space-y-1.5">
              <div className="bg-warning/20 h-1.5 w-full max-w-xs overflow-hidden rounded-full">
                <div
                  className="bg-warning h-full rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress.progress}%` }}
                />
              </div>
              <div className="text-muted-foreground/70 flex max-w-xs justify-between text-meta font-semibold uppercase tracking-[0.12em]">
                <span>{account.tier}</span>
                <span>{tierProgress.nextTierName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  Available
                </p>
                <p className="numeric text-foreground text-h2 font-semibold leading-none">
                  {account.points.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-warning/15 flex size-11 items-center justify-center rounded-xl">
                <CoinsIcon className="text-warning size-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  Earned to date
                </p>
                <p className="numeric text-foreground text-h2 font-semibold leading-none">
                  {account.totalEarned.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-success/12 flex size-11 items-center justify-center rounded-xl">
                <TrendingUpIcon className="text-success size-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  Redeemed
                </p>
                <p className="numeric text-foreground text-h2 font-semibold leading-none">
                  {account.totalRedeemed.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
                <TrendingDownIcon className="text-primary size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <Card className="shadow-card rounded-2xl py-0">
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle className="font-editorial text-foreground text-title font-semibold">
            How the tiers work
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid gap-3 sm:grid-cols-4">
            {TIER_THRESHOLDS.map((t) => (
              <div
                key={t.tier}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                  t.tier === account.tier
                    ? "border-warning/30 bg-warning/[0.07]"
                    : "bg-muted/30"
                }`}
              >
                <StatusBadge status={t.tier} colorMap={LOYALTY_TIER_COLORS} />
                <p className="numeric text-muted-foreground text-xs">
                  {t.min === 0
                    ? "0 – 499 pts"
                    : t.max === Infinity
                      ? `${t.min.toLocaleString("en-IN")}+ pts`
                      : `${t.min.toLocaleString("en-IN")} – ${t.max.toLocaleString("en-IN")} pts`}
                </p>
                {t.tier === account.tier && (
                  <span className="text-warning text-meta font-semibold uppercase tracking-[0.12em]">
                    You&apos;re here
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="shadow-card rounded-2xl py-0">
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle className="font-editorial text-foreground text-title font-semibold">
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {account.transactions.length === 0 ? (
            <EmptyState
              icon={<CoinsIcon />}
              title="The counting begins soon"
              description="Every booking and every referral you send our way adds points right here."
              className={PORTAL_EMPTY}
            />
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
                  className="hover:bg-muted/60 flex items-center gap-4 rounded-xl border p-4 transition-colors"
                >
                  <div className="bg-muted flex size-10 flex-shrink-0 items-center justify-center rounded-xl">
                    <TransactionIcon type={tx.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground truncate text-sm font-medium">
                        {tx.description}
                      </p>
                      <Badge
                        variant="outline"
                        className={`shrink-0 border text-meta font-medium ${
                          TRANSACTION_TYPE_COLORS[tx.type] ?? ""
                        }`}
                      >
                        {LOYALTY_TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </div>
                    <p className="numeric text-muted-foreground mt-0.5 text-xs">
                      {format(new Date(tx.createdAt), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                  <div
                    className={`numeric shrink-0 text-sm font-semibold ${
                      tx.type === "EARNED" || (tx.type === "ADJUSTED" && tx.points > 0)
                        ? "text-success"
                        : tx.type === "REDEEMED" ||
                            (tx.type === "ADJUSTED" && tx.points < 0)
                          ? "text-destructive"
                          : "text-muted-foreground"
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
