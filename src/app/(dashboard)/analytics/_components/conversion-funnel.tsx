"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface FunnelStage {
  stage: string;
  count: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  className?: string;
}

// ============================================================
// Stage Color Mapping
// ============================================================

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-sky-500",
  QUALIFIED: "bg-violet-500",
  PROPOSAL_SENT: "bg-amber-500",
  NEGOTIATION: "bg-orange-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-500",
};

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

// ============================================================
// Conversion Funnel Component
// ============================================================

export function ConversionFunnel({ data, className }: ConversionFunnelProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Calculate conversion rates between sequential stages (excluding LOST)
  const funnelStages = data.filter((d) => d.stage !== "LOST");
  const lostStage = data.find((d) => d.stage === "LOST");

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Lead Conversion Funnel</CardTitle>
        <CardDescription>
          Lead progression through pipeline stages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {funnelStages.map((stage, idx) => {
          const widthPercent = maxCount > 0
            ? Math.max((stage.count / maxCount) * 100, 4)
            : 4;
          const prevCount = idx > 0 ? funnelStages[idx - 1].count : 0;
          const conversionRate =
            idx > 0 && prevCount > 0
              ? ((stage.count / prevCount) * 100).toFixed(1)
              : null;

          return (
            <div key={stage.stage} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-medium text-foreground">
                  {STAGE_LABELS[stage.stage] ?? stage.stage}
                </span>
                <div className="flex items-baseline gap-2">
                  {conversionRate && (
                    <span className="numeric text-meta text-muted-foreground">
                      {conversionRate}% from prev
                    </span>
                  )}
                  <span className="numeric text-body font-semibold text-foreground">
                    {stage.count.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    STAGE_COLORS[stage.stage] ?? "bg-muted-foreground/40"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Lost stage shown separately */}
        {lostStage && lostStage.count > 0 && (
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body font-medium text-rose-600 dark:text-rose-400">
                Lost
              </span>
              <span className="numeric text-body font-semibold text-foreground">
                {lostStage.count.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-rose-500 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max((lostStage.count / maxCount) * 100, 4)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary stats */}
        {funnelStages.length > 1 && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-muted-foreground">
                Overall conversion — New to Won
              </span>
              <span className="numeric text-lede font-semibold text-emerald-600 dark:text-emerald-400">
                {funnelStages[0].count > 0
                  ? (
                      ((funnelStages[funnelStages.length - 1]?.count ?? 0) /
                        funnelStages[0].count) *
                      100
                    ).toFixed(1)
                  : "0.0"}
                %
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
