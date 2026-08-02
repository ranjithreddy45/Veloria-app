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
import { getCoachingNotes, canCurrentUserCoach } from "@/actions/coaching.actions";
import { CoachingPanel } from "./_components/coaching-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
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
  title: "Individual Performance",
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

  const [coachingRes, canCoach] = await Promise.all([
    getCoachingNotes(userId),
    canCurrentUserCoach(),
  ]);
  const coachingNotes = (coachingRes.success ? coachingRes.data : []) as Parameters<typeof CoachingPanel>[0]["notes"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestScore: any = scores.length > 0 ? scores[0] : null;
  const overallScore = Number(latestScore?.overallScore ?? 0);
  const onTimeRate = Number(latestScore?.onTimeRate ?? 0);
  const qualityScore = Number(latestScore?.qualityScore ?? 0);
  const totalCompleted = Number(latestScore?.totalTasksCompleted ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Performance · Coaching"
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

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Overall Score"
          value={`${overallScore.toFixed(1)}%`}
          accent="indigo"
          icon={<TargetIcon className="size-4" />}
          pct={overallScore}
        />
        <StatTile
          label="On-Time Rate"
          value={`${onTimeRate.toFixed(1)}%`}
          accent="blue"
          icon={<ClockIcon className="size-4" />}
          pct={onTimeRate}
        />
        <StatTile
          label="Quality Score"
          value={`${qualityScore.toFixed(1)}%`}
          accent="gold"
          icon={<StarIcon className="size-4" />}
          pct={qualityScore}
        />
        <StatTile
          label="Tasks Completed"
          value={totalCompleted}
          accent="emerald"
          icon={<CheckCircleIcon className="size-4" />}
          sub={latestScore ? `period ${latestScore.period}` : undefined}
        />
      </div>

      {/* Score History */}
      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 px-5 py-5">
          <h2 className="text-body font-semibold tracking-[-0.01em] text-foreground">
            Score history (last 12 months)
          </h2>
          {scores.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No score history available.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaching & 1:1s — the manager↔report ritual */}
      <CoachingPanel userId={userId} notes={coachingNotes} canCoach={canCoach} />

      {/* Badges Section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <AwardIcon className="size-4" />
          </span>
          <h2 className="text-copy font-semibold tracking-[-0.01em]">Badges Earned</h2>
        </div>
        {badges.length === 0 ? (
          <Card className="gap-0 py-0">
            <CardContent className="px-5 py-8 text-center text-muted-foreground">
              No badges earned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {badges.map((badge: any) => (
              <Card key={badge.id} className="gap-0 py-0">
                <CardContent className="px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
                      <AwardIcon className="size-5 text-warning" />
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
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-success/15 text-success">
            <GiftIcon className="size-4" />
          </span>
          <h2 className="text-copy font-semibold tracking-[-0.01em]">Incentives</h2>
        </div>
        {incentives.length === 0 ? (
          <Card className="gap-0 py-0">
            <CardContent className="px-5 py-8 text-center text-muted-foreground">
              No incentives assigned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {incentives.map((incentive: any) => (
              <Card key={incentive.id} className="gap-0 py-0">
                <CardContent className="px-5 py-5">
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
                        <span className="font-medium text-success">
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
