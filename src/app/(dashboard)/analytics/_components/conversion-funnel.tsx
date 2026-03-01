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
  NEW: "bg-blue-500 dark:bg-blue-600",
  CONTACTED: "bg-sky-500 dark:bg-sky-600",
  QUALIFIED: "bg-violet-500 dark:bg-violet-600",
  PROPOSAL_SENT: "bg-amber-500 dark:bg-amber-600",
  NEGOTIATION: "bg-orange-500 dark:bg-orange-600",
  WON: "bg-emerald-500 dark:bg-emerald-600",
  LOST: "bg-red-500 dark:bg-red-600",
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
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {STAGE_LABELS[stage.stage] ?? stage.stage}
                </span>
                <div className="flex items-center gap-2">
                  {conversionRate && (
                    <span className="text-xs text-muted-foreground">
                      {conversionRate}% from prev
                    </span>
                  )}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {stage.count.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="h-8 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-md transition-all duration-500 ease-out flex items-center justify-end pr-2",
                    STAGE_COLORS[stage.stage] ?? "bg-zinc-400"
                  )}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 15 && (
                    <span className="text-xs font-medium text-white">
                      {stage.count.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Lost stage shown separately */}
        {lostStage && lostStage.count > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-red-600 dark:text-red-400">
                Lost
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {lostStage.count.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-8 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-md bg-red-500 dark:bg-red-600 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max((lostStage.count / maxCount) * 100, 4)}%`,
                }}
              >
                {(lostStage.count / maxCount) * 100 > 15 && (
                  <span className="text-xs font-medium text-white">
                    {lostStage.count.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary stats */}
        {funnelStages.length > 1 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Overall Conversion (New to Won)
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
