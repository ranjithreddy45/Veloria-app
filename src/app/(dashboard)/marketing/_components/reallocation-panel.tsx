"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  SparklesIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  Loader2Icon,
  WandSparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import {
  computeReallocationRun,
  getReallocationPreview,
} from "@/actions/channel-reallocation.actions";
import type {
  ReallocationRunView,
  ReallocationRangeParams,
} from "@/schemas/channel-reallocation.schema";

// ============================================================
// Reallocate Spend panel — prescriptive ad-spend recommendations.
// ------------------------------------------------------------
// Renders the last persisted ChannelReallocationRun instantly (initialRun
// from the server page; no fetch on first paint). A date range + "segment by
// event type" toggle drives a live, un-persisted preview (getReallocationPreview).
// canManage users can persist a fresh snapshot via "Recompute"
// (computeReallocationRun). Recommendations are ADVISORY — no spend moves.
// ============================================================

interface ReallocationPanelProps {
  initialRun: ReallocationRunView | null;
  canManage: boolean;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReallocationPanel({
  initialRun,
  canManage,
}: ReallocationPanelProps) {
  const [run, setRun] = React.useState<ReallocationRunView | null>(initialRun);
  const [isPreview, setIsPreview] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [segmentByEventType, setSegmentByEventType] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function params(): ReallocationRangeParams {
    return {
      from: from || undefined,
      to: to || undefined,
      segmentByEventType: segmentByEventType || undefined,
    };
  }

  function runPreview() {
    startTransition(async () => {
      const res = await getReallocationPreview(params());
      if (res.success) {
        setRun(res.data);
        setIsPreview(true);
      } else {
        toast.error(res.error ?? "Failed to preview reallocation plan");
      }
    });
  }

  function recompute() {
    startTransition(async () => {
      const res = await computeReallocationRun(params());
      if (res.success) {
        setRun(res.data);
        setIsPreview(false);
        toast.success("Reallocation plan saved.");
      } else {
        toast.error(res.error ?? "Failed to recompute reallocation plan");
      }
    });
  }

  const recs = run?.recommendations ?? [];
  const hasRecs = recs.length > 0;

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/8 to-transparent" />
      <CardHeader className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <WandSparklesIcon className="size-4" />
            </span>
            Reallocate spend
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Prescriptive shifts from low-ROAS to high-ROAS channels.{" "}
            {run
              ? isPreview
                ? "Live preview — not saved."
                : `As of last nightly rollup · ${fmtDateTime(run.createdAt)}`
              : "No plan computed yet."}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 self-start">
          Advisory · no spend is moved automatically
        </Badge>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {/* Headline projections */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Projected booking lift
            </p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
              <SparklesIcon className="size-4" />+{run?.projectedBookingLift ?? 0}
            </p>
          </div>
          <div className="rounded-xl border bg-card/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Projected ROAS lift
            </p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums text-violet-600 dark:text-violet-300">
              <TrendingUpIcon className="size-4" />+
              {(run?.projectedRoasLift ?? 0).toFixed(2)}×
            </p>
          </div>
          <div className="col-span-2 rounded-xl border bg-card/60 p-4 sm:col-span-1">
            <p className="text-xs font-medium text-muted-foreground">
              Spend in scope
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatINR(run?.totalSpend ?? 0)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="segment-by-event"
              checked={segmentByEventType}
              onCheckedChange={setSegmentByEventType}
            />
            <label
              htmlFor="segment-by-event"
              className="text-xs font-medium text-muted-foreground"
            >
              Segment by event type
            </label>
          </div>
          <Button
            variant="outline"
            onClick={runPreview}
            disabled={isPending}
            size="sm"
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Preview
          </Button>
          {canManage && (
            <Button onClick={recompute} disabled={isPending} size="sm">
              {isPending ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-2 size-4" />
              )}
              Recompute
            </Button>
          )}
        </div>

        {/* Recommendation cards */}
        {!hasRecs ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No reallocation recommended right now. Either every funded channel is
            already efficient, or there isn&apos;t enough won-lead signal to act on.
          </p>
        ) : (
          <ul className="space-y-3">
            {recs.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border bg-card/60 p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                  <span>Shift</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatINR(r.shiftAmount)}
                  </span>
                  <span className="text-muted-foreground">from</span>
                  <Badge variant="secondary">{r.fromChannel}</Badge>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {r.toChannel}
                  </Badge>
                  {r.segment && (
                    <Badge variant="outline" className="font-normal">
                      {r.segment}
                    </Badge>
                  )}
                  <span className="ml-auto font-semibold text-emerald-600 dark:text-emerald-300">
                    +{r.expectedBookingDelta} booking
                    {r.expectedBookingDelta === 1 ? "" : "s"}
                  </span>
                </div>
                {r.rationale && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {run?.notes && (
          <p className="text-xs text-muted-foreground">{run.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
