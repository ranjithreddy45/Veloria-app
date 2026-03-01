import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  CoinsIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SlidersHorizontalIcon,
  MinusIcon,
} from "lucide-react";

import { getLoyaltyAccountById } from "@/actions/loyalty.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  LOYALTY_TIER_COLORS,
  LOYALTY_TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";
import { AdjustPointsDialog } from "../_components/adjust-points-dialog";

export const metadata: Metadata = {
  title: "Loyalty Account | Veloria Grand",
};

// ============================================================
// Tier Progress Helper
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

  return {
    progress,
    nextTierName: nextTier.tier,
    pointsToNext,
  };
}

// ============================================================
// Transaction Type Icons
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
// Loyalty Account Detail Page
// ============================================================

interface LoyaltyAccountDetailPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function LoyaltyAccountDetailPage({
  params,
}: LoyaltyAccountDetailPageProps) {
  const { accountId } = await params;
  const result = await getLoyaltyAccountById(accountId);

  if (!result.success || !result.data) {
    notFound();
  }

  const account = result.data;
  const contactName = `${account.contact.firstName} ${account.contact.lastName}`;
  const tierProgress = getTierProgress(account.tier, account.totalEarned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-xs" asChild>
              <Link href="/loyalty">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {contactName}
            </h1>
            <StatusBadge
              status={account.tier}
              colorMap={LOYALTY_TIER_COLORS}
            />
          </div>
          <p className="text-muted-foreground mt-1 ml-10 text-sm">
            Loyalty account since{" "}
            {format(new Date(account.createdAt), "dd MMM yyyy")}
          </p>
        </div>
        <AdjustPointsDialog
          accountId={account.id}
          currentPoints={account.points}
          contactName={contactName}
        />
      </div>

      {/* Points Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Balance
            </CardTitle>
            <CoinsIcon className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">
              {account.points.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">points available</p>
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
            <div className="text-3xl font-bold text-emerald-700">
              {account.totalEarned.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">lifetime earned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Redeemed
            </CardTitle>
            <TrendingDownIcon className="size-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {account.totalRedeemed.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">lifetime redeemed</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tier Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge
                status={account.tier}
                colorMap={LOYALTY_TIER_COLORS}
              />
              {tierProgress.nextTierName && (
                <span className="text-xs text-muted-foreground">
                  {tierProgress.pointsToNext.toLocaleString("en-IN")} pts to{" "}
                  {tierProgress.nextTierName}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                  style={{ width: `${tierProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{account.tier}</span>
                <span>
                  {tierProgress.nextTierName
                    ? tierProgress.nextTierName
                    : "Max Tier"}
                </span>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              {TIER_THRESHOLDS.map((t) => (
                <div
                  key={t.tier}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    t.tier === account.tier
                      ? "border-amber-200 bg-amber-50"
                      : "border-zinc-100"
                  }`}
                >
                  <StatusBadge
                    status={t.tier}
                    colorMap={LOYALTY_TIER_COLORS}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t.min === 0
                      ? "0 - 499"
                      : t.max === Infinity
                        ? `${t.min.toLocaleString("en-IN")}+`
                        : `${t.min.toLocaleString("en-IN")} - ${t.max.toLocaleString("en-IN")}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Contact Info</span>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/contacts/${account.contact.id}`}>
                  View Contact
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <UserIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="text-sm font-medium">{contactName}</p>
              </div>
            </div>
            {account.contact.email && (
              <div className="flex items-center gap-3">
                <MailIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="text-sm">{account.contact.email}</p>
                </div>
              </div>
            )}
            {account.contact.phone && (
              <div className="flex items-center gap-3">
                <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="text-sm">{account.contact.phone}</p>
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Member Since</p>
                <p className="text-sm">
                  {format(new Date(account.createdAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Last Updated</p>
                <p className="text-sm">
                  {format(new Date(account.updatedAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {account.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CoinsIcon className="size-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-500">
                No transactions yet
              </p>
              <p className="text-xs text-zinc-400">
                Points transactions will appear here.
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
                  className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4"
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
                      {tx.referenceId && (
                        <span className="ml-2">Ref: {tx.referenceId}</span>
                      )}
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
