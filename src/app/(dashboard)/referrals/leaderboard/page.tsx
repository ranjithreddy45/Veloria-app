import type { Metadata } from "next";
import Link from "next/link";
import {
  TrophyIcon,
  MedalIcon,
  AwardIcon,
  ArrowLeftIcon,
  IndianRupeeIcon,
  UsersIcon,
} from "lucide-react";

import { getReferrerLeaderboard } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Referrer Leaderboard",
};

// ============================================================
// Rank Styles
// ============================================================

const RANK_STYLES: Record<
  number,
  { bg: string; icon: React.ReactNode }
> = {
  1: {
    bg: "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700",
    icon: <TrophyIcon className="size-5 text-amber-500" />,
  },
  2: {
    bg: "bg-zinc-50 border-zinc-300 dark:bg-zinc-800/30 dark:border-zinc-600",
    icon: <MedalIcon className="size-5 text-muted-foreground" />,
  },
  3: {
    bg: "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700",
    icon: <AwardIcon className="size-5 text-orange-600" />,
  },
};

// ============================================================
// Referrer Leaderboard Page
// ============================================================

export default async function ReferrerLeaderboardPage() {
  const result = await getReferrerLeaderboard();
  const leaderboard = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrer Leaderboard"
        description="Top referrers ranked by converted referrals and booking value."
      >
        <Button variant="outline" asChild>
          <Link href="/referrals/dashboard">
            <ArrowLeftIcon className="mr-2 size-4" />
            Dashboard
          </Link>
        </Button>
      </PageHeader>

      {leaderboard.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrophyIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No referrer data yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              The leaderboard will populate once referrals are tracked.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {leaderboard.map((referrer: any, index: number) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;
            const rankStyle = RANK_STYLES[rank];
            const fullName = [referrer.firstName, referrer.lastName]
              .filter(Boolean)
              .join(" ") || "Unknown";

            return (
              <div
                key={referrer.contactId}
                className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                  isTopThree && rankStyle
                    ? rankStyle.bg
                    : "border-zinc-200/80 dark:border-zinc-700/80 hover:bg-muted/50"
                }`}
              >
                {/* Rank */}
                <div className="flex size-10 shrink-0 items-center justify-center">
                  {isTopThree && rankStyle ? (
                    rankStyle.icon
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">
                      #{rank}
                    </span>
                  )}
                </div>

                {/* Name & email */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{fullName}</p>
                  {referrer.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {referrer.email}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <UsersIcon className="size-3 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums">
                        {referrer.totalReferrals}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>

                  <div className="text-center">
                    <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {referrer.convertedReferrals}
                    </span>
                    <p className="text-xs text-muted-foreground">Converted</p>
                  </div>

                  <div className="text-center hidden sm:block">
                    <div className="flex items-center gap-0.5">
                      <IndianRupeeIcon className="size-3 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums">
                        {Number(referrer.totalBookingValue).toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 0,
                          }
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Value</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
