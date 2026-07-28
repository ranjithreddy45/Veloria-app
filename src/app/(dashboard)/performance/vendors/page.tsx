import type { Metadata } from "next";
import Link from "next/link";
import {
  BuildingIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  AwardIcon,
} from "lucide-react";

import { getPerformanceScores } from "@/actions/performance-score.actions";
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

export const metadata: Metadata = {
  title: "Vendor Performance",
};

// ============================================================
// Vendor Performance List Page
// ============================================================

export default async function VendorPerformancePage() {
  const result = await getPerformanceScores();
  const allScores = result.success ? result.data ?? [] : [];

  // Filter to vendor-only scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendorScores = allScores.filter((s: any) => s.vendorId != null);

  // Group by vendor, keeping the latest score per vendor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendorMap = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const score of vendorScores as any[]) {
    const vid = score.vendorId;
    if (!vendorMap.has(vid)) {
      vendorMap.set(vid, score);
    }
  }
  const uniqueVendors = Array.from(vendorMap.values());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Performance"
        description="Performance overview for all vendor partners."
      >
        <Button variant="outline" asChild>
          <Link href="/performance/scores">
            <ArrowLeftIcon className="mr-2 size-4" />
            All Scores
          </Link>
        </Button>
      </PageHeader>

      {uniqueVendors.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BuildingIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No vendor performance data
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Vendor scores will appear once performance calculations run.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {uniqueVendors.map((score: any) => {
            const vendor = score.vendor;
            const overallScore = Number(score.overallScore ?? 0);
            const onTimeRate = Number(score.onTimeRate ?? 0);
            const qualityScore = Number(score.qualityScore ?? 0);

            return (
              <Link
                key={score.id}
                href={`/performance/vendors/${score.vendorId}`}
                className="block"
              >
                <Card className="border-border shadow-sm transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                          <BuildingIcon className="size-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {vendor?.name || "Unknown Vendor"}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Period: {score.period}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          overallScore >= 80
                            ? "default"
                            : overallScore >= 50
                            ? "secondary"
                            : "destructive"
                        }
                        className="tabular-nums"
                      >
                        {overallScore.toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Overall</span>
                          <span className="tabular-nums">
                            {overallScore.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={overallScore} className="h-2" />
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="text-center">
                          <p className="font-medium tabular-nums">
                            {onTimeRate.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            On-Time
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium tabular-nums">
                            {qualityScore.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Quality
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium tabular-nums">
                            {score.totalTasksCompleted ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tasks
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium tabular-nums">
                            {score.escalationCount ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Escalations
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
