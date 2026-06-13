import type { Metadata } from "next";
import Link from "next/link";
import {
  TrophyIcon,
  MedalIcon,
  AwardIcon,
  ArrowLeftIcon,
  UserIcon,
  BuildingIcon,
} from "lucide-react";

import { getPerformanceLeaderboard } from "@/actions/performance-score.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BADGE_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Performance Leaderboard",
};

// ============================================================
// Rank Styles
// ============================================================

const RANK_STYLES: Record<number, { bg: string; icon: React.ReactNode; label: string }> = {
  1: {
    bg: "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700",
    icon: <TrophyIcon className="size-5 text-amber-500" />,
    label: "Gold",
  },
  2: {
    bg: "bg-zinc-50 border-zinc-300 dark:bg-zinc-800/30 dark:border-zinc-600",
    icon: <MedalIcon className="size-5 text-zinc-400" />,
    label: "Silver",
  },
  3: {
    bg: "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700",
    icon: <AwardIcon className="size-5 text-orange-600" />,
    label: "Bronze",
  },
};

// ============================================================
// Leaderboard Entry Component
// ============================================================

function LeaderboardEntry({
  rank,
  name,
  score,
  badges,
  href,
  isVendor,
}: {
  rank: number;
  name: string;
  score: number;
  badges: Array<{ type: string; title: string }>;
  href: string;
  isVendor: boolean;
}) {
  const rankStyle = RANK_STYLES[rank];
  const isTopThree = rank <= 3;

  return (
    <Link href={href} className="block">
      <div
        className={`flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
          isTopThree && rankStyle
            ? rankStyle.bg
            : "border-zinc-200/80 dark:border-zinc-700/80"
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

        {/* Name & badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isVendor ? (
              <BuildingIcon className="size-4 text-muted-foreground" />
            ) : (
              <UserIcon className="size-4 text-muted-foreground" />
            )}
            <p className="font-medium truncate">{name}</p>
          </div>
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((b, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {BADGE_TYPE_LABELS[b.type] || b.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 shrink-0">
          <Progress value={score} className="h-2 w-16" />
          <span className="text-sm font-semibold tabular-nums w-14 text-right">
            {score.toFixed(1)}%
          </span>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// Page Component
// ============================================================

export default async function PerformanceLeaderboardPage() {
  const [staffResult, vendorResult] = await Promise.all([
    getPerformanceLeaderboard({ type: "user" }),
    getPerformanceLeaderboard({ type: "vendor" }),
  ]);

  const staffData = staffResult.success ? staffResult.data : { scores: [], badges: [] };
  const vendorData = vendorResult.success ? vendorResult.data : { scores: [], badges: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffScores: any[] = staffData?.scores ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffBadges: any[] = staffData?.badges ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendorScores: any[] = vendorData?.scores ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendorBadges: any[] = vendorData?.badges ?? [];

  function getBadgesForUser(userId: string, badgeList: typeof staffBadges) {
    return badgeList
      .filter((b) => b.userId === userId)
      .map((b) => ({ type: b.type, title: b.title }));
  }

  function getBadgesForVendor(vendorId: string, badgeList: typeof vendorBadges) {
    return badgeList
      .filter((b) => b.vendorId === vendorId)
      .map((b) => ({ type: b.type, title: b.title }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Leaderboard"
        description="Top performers ranked by overall score for the current period."
      >
        <Button variant="outline" asChild>
          <Link href="/performance/scores">
            <ArrowLeftIcon className="mr-2 size-4" />
            All Scores
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">
            <UserIcon className="mr-2 size-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="vendors">
            <BuildingIcon className="mr-2 size-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff" className="mt-4">
          {staffScores.length === 0 ? (
            <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <TrophyIcon className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">
                  No staff scores yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {staffScores.map((score, index) => (
                <LeaderboardEntry
                  key={score.id}
                  rank={index + 1}
                  name={score.user?.name || "Unknown"}
                  score={Number(score.overallScore ?? 0)}
                  badges={getBadgesForUser(score.userId, staffBadges)}
                  href={`/performance/${score.userId}`}
                  isVendor={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="mt-4">
          {vendorScores.length === 0 ? (
            <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <TrophyIcon className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">
                  No vendor scores yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {vendorScores.map((score, index) => (
                <LeaderboardEntry
                  key={score.id}
                  rank={index + 1}
                  name={score.vendor?.name || "Unknown"}
                  score={Number(score.overallScore ?? 0)}
                  badges={getBadgesForVendor(score.vendorId, vendorBadges)}
                  href={`/performance/vendors/${score.vendorId}`}
                  isVendor={true}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
