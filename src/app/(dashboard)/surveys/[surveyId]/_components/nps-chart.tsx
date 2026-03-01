"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ============================================================
// NPS Chart Component
// ============================================================

interface NpsChartProps {
  npsScore: number | null;
  breakdown: {
    promoters: number;
    passives: number;
    detractors: number;
  };
  totalResponses: number;
}

function getNpsColor(score: number): string {
  if (score >= 50) return "text-emerald-600";
  if (score >= 0) return "text-amber-600";
  return "text-red-600";
}

function getNpsBgColor(score: number): string {
  if (score >= 50) return "bg-emerald-500";
  if (score >= 0) return "bg-amber-500";
  return "bg-red-500";
}

function getNpsLabel(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Great";
  if (score >= 30) return "Good";
  if (score >= 0) return "Needs Improvement";
  return "Critical";
}

export function NpsChart({ npsScore, breakdown, totalResponses }: NpsChartProps) {
  if (npsScore === null || totalResponses === 0) {
    return (
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Net Promoter Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-zinc-500">No NPS data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = breakdown.promoters + breakdown.passives + breakdown.detractors;
  const promoterPct = total > 0 ? Math.round((breakdown.promoters / total) * 100) : 0;
  const passivePct = total > 0 ? Math.round((breakdown.passives / total) * 100) : 0;
  const detractorPct = total > 0 ? Math.round((breakdown.detractors / total) * 100) : 0;

  return (
    <Card className="border-zinc-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-zinc-900">
          Net Promoter Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Big NPS Score */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`text-5xl font-bold tabular-nums ${getNpsColor(npsScore)}`}
          >
            {npsScore > 0 ? `+${npsScore}` : npsScore}
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            {getNpsLabel(npsScore)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Based on {total} response{total !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {promoterPct > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${promoterPct}%` }}
            />
          )}
          {passivePct > 0 && (
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${passivePct}%` }}
            />
          )}
          {detractorPct > 0 && (
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${detractorPct}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-zinc-600">
                Promoters
              </span>
            </div>
            <p className="text-lg font-semibold text-emerald-600">
              {breakdown.promoters}
            </p>
            <p className="text-xs text-zinc-400">{promoterPct}% (9-10)</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-zinc-600">
                Passives
              </span>
            </div>
            <p className="text-lg font-semibold text-amber-600">
              {breakdown.passives}
            </p>
            <p className="text-xs text-zinc-400">{passivePct}% (7-8)</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-zinc-600">
                Detractors
              </span>
            </div>
            <p className="text-lg font-semibold text-red-600">
              {breakdown.detractors}
            </p>
            <p className="text-xs text-zinc-400">{detractorPct}% (0-6)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
