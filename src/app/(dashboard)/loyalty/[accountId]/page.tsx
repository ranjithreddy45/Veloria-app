import type { Metadata } from "next";
import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronRightIcon,
  CoinsIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SparklesIcon,
} from "lucide-react";

import { getLoyaltyAccountById } from "@/actions/loyalty.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  LOYALTY_TIER_COLORS,
  LOYALTY_TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";
import { AdjustPointsDialog } from "../_components/adjust-points-dialog";

export const metadata: Metadata = {
  title: "Loyalty Account",
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

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  EARNED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REDEEMED: "bg-purple-100 text-purple-700 border-purple-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 border-zinc-200",
  ADJUSTED: "bg-blue-100 text-blue-700 border-blue-200",
};

/** Signed points display — positive earns read success, spends read destructive. */
function signedPoints(type: string, points: number) {
  const isCredit = type === "EARNED" || (type === "ADJUSTED" && points > 0);
  const isDebit =
    type === "REDEEMED" || (type === "ADJUSTED" && points < 0);
  return {
    prefix: isCredit ? "+" : isDebit ? "−" : "",
    tone: isCredit
      ? "text-success"
      : isDebit
        ? "text-destructive"
        : "text-muted-foreground",
  };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

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
      <PageHeader
        icon={SparklesIcon}
        accent="amber"
        title={contactName}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/loyalty" className="transition-colors hover:text-foreground">
              Loyalty
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Member</span>
          </span>
        }
        description={`Member since ${format(new Date(account.createdAt), "dd MMM yyyy")}`}
      >
        <StatusBadge status={account.tier} colorMap={LOYALTY_TIER_COLORS} />
        <AdjustPointsDialog
          accountId={account.id}
          currentPoints={account.points}
          contactName={contactName}
        />
      </PageHeader>

      {/* ============================================================
          Points cockpit
          ============================================================ */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Current balance"
          value={account.points}
          accent="amber"
          icon={<CoinsIcon />}
          sub="Points available to redeem"
        />
        <StatTile
          label="Total earned"
          value={account.totalEarned}
          accent="emerald"
          icon={<TrendingUpIcon />}
          sub="Lifetime points earned"
        />
        <StatTile
          label="Total redeemed"
          value={account.totalRedeemed}
          accent="gold"
          icon={<TrendingDownIcon />}
          sub="Lifetime points spent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ============================================================
            Tier progress
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Tier progress
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {tierProgress.nextTierName
              ? `${tierProgress.pointsToNext.toLocaleString("en-IN")} more points to reach ${tierProgress.nextTierName}.`
              : "This member has reached the top tier."}
          </p>

          <div className="mt-5 space-y-2">
            <Progress value={tierProgress.progress} className="h-2.5" />
            <div className="flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{account.tier}</span>
              <span>{tierProgress.nextTierName ?? "Max tier"}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-5">
            {TIER_THRESHOLDS.map((t) => (
              <div
                key={t.tier}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-3",
                  t.tier === account.tier && "border-primary/30 bg-primary/[0.04]"
                )}
              >
                <StatusBadge status={t.tier} colorMap={LOYALTY_TIER_COLORS} />
                <span className="numeric text-[11.5px] text-muted-foreground">
                  {t.max === Infinity
                    ? `${t.min.toLocaleString("en-IN")}+`
                    : `${t.min.toLocaleString("en-IN")} – ${t.max.toLocaleString("en-IN")}`}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            Contact
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                Contact
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Who this loyalty account belongs to.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={`/contacts/${account.contact.id}`}>View contact</Link>
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Field
              label="Name"
              value={<span className="font-medium">{contactName}</span>}
            />
            <Field
              label="Phone"
              value={
                account.contact.phone ? (
                  <span className="numeric">{account.contact.phone}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <Field
              label="Email"
              value={
                account.contact.email ? (
                  <span className="break-all">{account.contact.email}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <Field
              label="Tier"
              value={
                <StatusBadge
                  status={account.tier}
                  colorMap={LOYALTY_TIER_COLORS}
                />
              }
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4">
            <Field
              label="Member since"
              value={
                <span className="numeric">
                  {format(new Date(account.createdAt), "dd MMM yyyy")}
                </span>
              }
            />
            <Field
              label="Last updated"
              value={
                <span className="numeric">
                  {format(new Date(account.updatedAt), "dd MMM yyyy, hh:mm a")}
                </span>
              }
            />
          </div>
        </section>
      </div>

      {/* ============================================================
          Transaction history
          ============================================================ */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Transaction history
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Every point earned, redeemed, expired, or adjusted.
            </p>
          </div>
          {account.transactions.length > 0 && (
            <Badge variant="outline" className="numeric shrink-0">
              {account.transactions.length}
            </Badge>
          )}
        </div>

        {account.transactions.length === 0 ? (
          <EmptyState
            icon={<CoinsIcon />}
            title="No transactions yet"
            description="Points earned or redeemed by this member will show up here."
          />
        ) : (
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Activity
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide">
                    Points
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {account.transactions.map(
                  (tx: {
                    id: string;
                    type: string;
                    points: number;
                    description: string;
                    referenceId: string | null;
                    createdAt: string;
                  }) => {
                    const { prefix, tone } = signedPoints(tx.type, tx.points);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="max-w-[24rem]">
                          <p className="truncate font-medium">{tx.description}</p>
                          {tx.referenceId && (
                            <p className="numeric mt-0.5 text-[11.5px] text-muted-foreground">
                              Ref {tx.referenceId}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border text-[10.5px] font-medium",
                              TRANSACTION_TYPE_COLORS[tx.type] ?? ""
                            )}
                          >
                            {LOYALTY_TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap text-muted-foreground">
                          {format(new Date(tx.createdAt), "dd MMM yyyy, hh:mm a")}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "numeric text-right font-semibold",
                            tone
                          )}
                        >
                          {prefix}
                          {Math.abs(tx.points).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
