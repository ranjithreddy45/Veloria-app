import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3Icon, UserIcon, BuildingIcon } from "lucide-react";

import { getPerformanceScores } from "@/actions/performance-score.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Performance Scores" };

// ============================================================
// Performance Scores Page
// ============================================================

export default async function PerformanceScoresPage() {
  const result = await getPerformanceScores();
  const scores = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Scores"
        description="Track and evaluate individual and vendor performance metrics."
      >
        <Link
          href="/performance/leaderboard"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <BarChart3Icon className="size-4" />
          Leaderboard
        </Link>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{scores.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Staff Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {scores.filter((s: Record<string, unknown>) => s.userId).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendor Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {scores.filter((s: Record<string, unknown>) => s.vendorId).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {scores.length > 0
                ? (
                    scores.reduce(
                      (sum: number, s: Record<string, unknown>) =>
                        sum + Number(s.overallScore ?? 0),
                      0
                    ) / scores.length
                  ).toFixed(1)
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scores Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {scores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3Icon className="mb-4 size-12 text-muted-foreground/40" />
              <p className="text-lg font-medium text-muted-foreground">
                No performance scores found
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Scores will appear here once the performance calculation runs.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Overall Score</TableHead>
                  <TableHead className="text-right">On-Time Rate</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Escalations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((score: Record<string, unknown>) => {
                  const user = score.user as Record<string, string> | null;
                  const vendor = score.vendor as Record<string, string> | null;
                  const name = user?.name || vendor?.name || "Unknown";
                  const isVendor = !!vendor;
                  const linkHref = isVendor
                    ? `/performance/vendors/${vendor?.id}`
                    : `/performance/${user?.id}`;
                  const overallScore = Number(score.overallScore ?? 0);
                  const onTimeRate = Number(score.onTimeRate ?? 0);
                  const qualityScore = Number(score.qualityScore ?? 0);
                  const completed = Number(score.totalTasksCompleted ?? 0);
                  const assigned = Number(score.totalTasksAssigned ?? 0);
                  const escalations = Number(score.escalationCount ?? 0);

                  return (
                    <TableRow key={score.id as string}>
                      <TableCell>
                        <Link
                          href={linkHref}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="gap-1"
                        >
                          {isVendor ? (
                            <BuildingIcon className="size-3" />
                          ) : (
                            <UserIcon className="size-3" />
                          )}
                          {isVendor ? "Vendor" : "Staff"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {score.period as string}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={overallScore}
                            className="h-2 w-20"
                          />
                          <span className="text-sm font-medium tabular-nums">
                            {overallScore.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {onTimeRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {qualityScore.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {completed}/{assigned}
                      </TableCell>
                      <TableCell className="text-right">
                        {escalations > 0 ? (
                          <Badge variant="destructive" className="tabular-nums">
                            {escalations}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground tabular-nums">
                            0
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
