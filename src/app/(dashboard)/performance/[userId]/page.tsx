import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  TargetIcon,
  ClockIcon,
  StarIcon,
  CheckCircleIcon,
  AwardIcon,
  GiftIcon,
} from "lucide-react";

import { getIndividualPerformanceDetail } from "@/actions/performance-score.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BADGE_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Individual Performance | Veloria Grand",
};

// ============================================================
// Individual Performance Detail Page
// ============================================================

interface IndividualPerformancePageProps {
  params: Promise<{ userId: string }>;
}

export default async function IndividualPerformancePage({
  params,
}: IndividualPerformancePageProps) {
  const { userId } = await params;
  const result = await getIndividualPerformanceDetail(userId);

  if (!result.success || !result.data) {
    notFound();
  }

  const { scores, badges, incentives } = result.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestScore: any = scores.length > 0 ? scores[0] : null;
  const overallScore = Number(latestScore?.overallScore ?? 0);
  const onTimeRate = Number(latestScore?.onTimeRate ?? 0);
  const qualityScore = Number(latestScore?.qualityScore ?? 0);
  const totalCompleted = Number(latestScore?.totalTasksCompleted ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Individual Performance"
        description={
          latestScore
            ? `Performance detail for period ${latestScore.period}`
            : "Performance detail"
        }
      >
        <Button variant="outline" asChild>
          <Link href="/performance/scores">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Scores
          </Link>
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Score
            </CardTitle>
            <TargetIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallScore.toFixed(1)}%</p>
            <Progress value={overallScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On-Time Rate
            </CardTitle>
            <ClockIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{onTimeRate.toFixed(1)}%</p>
            <Progress value={onTimeRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quality Score
            </CardTitle>
            <StarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{qualityScore.toFixed(1)}%</p>
            <Progress value={qualityScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks Completed
            </CardTitle>
            <CheckCircleIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCompleted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Score History */}
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <CardHeader>
          <CardTitle>Score History (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scores.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No score history available.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead className="text-right">On-Time</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Escalations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {scores.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.period}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Number(s.overallScore ?? 0)}
                          className="h-2 w-16"
                        />
                        <span className="text-sm tabular-nums">
                          {Number(s.overallScore ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(s.onTimeRate ?? 0).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(s.qualityScore ?? 0).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.totalTasksCompleted ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.totalTasksAssigned ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.escalationCount ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Badges Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AwardIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Badges Earned</h2>
        </div>
        {badges.length === 0 ? (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardContent className="py-8 text-center text-muted-foreground">
              No badges earned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {badges.map((badge: any) => (
              <Card
                key={badge.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <AwardIcon className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{badge.title}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {BADGE_TYPE_LABELS[badge.type] || badge.type}
                      </Badge>
                      {badge.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {badge.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Earned{" "}
                        {new Date(badge.earnedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Incentives Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <GiftIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Incentives</h2>
        </div>
        {incentives.length === 0 ? (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardContent className="py-8 text-center text-muted-foreground">
              No incentives assigned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {incentives.map((incentive: any) => (
              <Card
                key={incentive.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{incentive.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Period: {incentive.period}
                      </p>
                    </div>
                    <Badge
                      variant={incentive.isAwarded ? "default" : "outline"}
                    >
                      {incentive.isAwarded ? "Awarded" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    {incentive.points > 0 && (
                      <span className="text-muted-foreground">
                        {incentive.points} pts
                      </span>
                    )}
                    {incentive.bonusAmount != null &&
                      Number(incentive.bonusAmount) > 0 && (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          +{Number(incentive.bonusAmount).toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      )}
                  </div>
                  {incentive.isAwarded && incentive.awardedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Awarded on{" "}
                      {new Date(incentive.awardedAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
