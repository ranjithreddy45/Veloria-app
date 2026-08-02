"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

import {
  getDefectPareto,
  getControlSeries,
} from "@/actions/quality.actions";
import type { CtqResult } from "@/actions/quality.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================
// QualityDetail — interactive drill-down for a chosen CTQ. A segmented control
// picks the metric; we then fetch its defect Pareto and SPC control series and
// render two recharts panels (Pareto = bars + cumulative % line; control chart =
// value line with mean/UCL/LCL reference lines). Read-only; colors from tokens.
// ============================================================

interface QualityDetailProps {
  ctqs: CtqResult[];
}

// Theme colors — resolved from CSS vars so light/dark + brand stay in sync.
const COLOR = {
  primary: "var(--primary)",
  success: "var(--success)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-popover px-3 py-2 text-detail shadow-card">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}:{" "}
          <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}
            {p.dataKey === "cumulativePct" ? "%" : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

function ParetoPanel({ ctqId }: { ctqId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quality", "pareto", ctqId],
    queryFn: () => getDefectPareto(ctqId),
  });

  const rows = data ?? [];

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-copy font-semibold tracking-[-0.01em]">
          Defect Pareto
        </CardTitle>
        <p className="text-detail text-muted-foreground">
          Where the defects come from — bars are counts, the line is the running
          cumulative share.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {isLoading ? (
            <div className="flex h-full flex-col justify-end gap-2 px-2 pb-6">
              {[70, 50, 38, 24, 14].map((h, i) => (
                <Skeleton key={i} className="w-full" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : isError || rows.length === 0 ? (
            <EmptyChart message={isError ? "Could not load Pareto data." : "No defects recorded for this metric."} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} vertical={false} />
                <XAxis
                  dataKey="category"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: COLOR.border }}
                  interval={0}
                  tick={{ fill: COLOR.muted }}
                />
                <YAxis
                  yAxisId="left"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: COLOR.muted }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: COLOR.muted }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  name="Defects"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLOR.primary} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativePct"
                  name="Cumulative"
                  stroke={COLOR.destructive}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLOR.destructive, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ControlPanel({ ctqId }: { ctqId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quality", "control", ctqId],
    queryFn: () => getControlSeries(ctqId),
  });

  const points = data?.points ?? [];
  const mean = data?.mean ?? 0;
  const ucl = data?.ucl ?? 0;
  const lcl = data?.lcl ?? 0;

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-copy font-semibold tracking-[-0.01em]">
          Control chart
        </CardTitle>
        <p className="text-detail text-muted-foreground">
          Process behaviour over time against its mean and ±3σ control limits.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-[85%] w-full rounded-xl" />
            </div>
          ) : isError || points.length === 0 ? (
            <EmptyChart message={isError ? "Could not load control data." : "Not enough data points to chart."} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} vertical={false} />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: COLOR.border }}
                  tick={{ fill: COLOR.muted }}
                  minTickGap={16}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: COLOR.muted }}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  y={ucl}
                  stroke={COLOR.destructive}
                  strokeDasharray="5 4"
                  strokeOpacity={0.7}
                  label={{ value: "UCL", position: "insideTopRight", fontSize: 10, fill: COLOR.destructive }}
                />
                <ReferenceLine
                  y={mean}
                  stroke={COLOR.success}
                  strokeDasharray="5 4"
                  strokeOpacity={0.8}
                  label={{ value: "Mean", position: "insideTopRight", fontSize: 10, fill: COLOR.success }}
                />
                <ReferenceLine
                  y={lcl}
                  stroke={COLOR.destructive}
                  strokeDasharray="5 4"
                  strokeOpacity={0.7}
                  label={{ value: "LCL", position: "insideBottomRight", fontSize: 10, fill: COLOR.destructive }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Value"
                  stroke={COLOR.primary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLOR.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {!isLoading && !isError && points.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/60 pt-3 text-meta">
            <LegendDot color={COLOR.primary} label="Measured value" />
            <LegendDot color={COLOR.success} label={`Mean ${mean.toFixed(2)}`} />
            <LegendDot color={COLOR.destructive} label={`Limits ${lcl.toFixed(2)} – ${ucl.toFixed(2)}`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
      <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30">
      <p className="text-body text-muted-foreground">{message}</p>
    </div>
  );
}

export function QualityDetail({ ctqs }: QualityDetailProps) {
  const [selected, setSelected] = React.useState(ctqs[0]?.id ?? "");
  const active = ctqs.find((c) => c.id === selected) ?? ctqs[0];

  if (!active) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lede font-semibold tracking-[-0.02em] text-foreground">
            Drill-down
          </h2>
          <p className="text-body text-muted-foreground">
            Pick a metric to inspect its defect breakdown and process control.
          </p>
        </div>
      </div>

      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Critical-to-quality metrics"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-border/70 bg-muted/40 p-1.5"
      >
        {ctqs.map((c) => {
          const isActive = c.id === selected;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(c.id)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-detail font-medium tracking-[-0.01em] transition-premium",
                isActive
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Active metric strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border/70 bg-card px-5 py-3.5 shadow-card">
        <div>
          <p className="text-meta uppercase tracking-[0.08em] text-muted-foreground">{active.domain}</p>
          <p className="text-copy font-semibold text-foreground">{active.label}</p>
        </div>
        <div className="h-8 w-px bg-border/70" />
        <Metric label="Sigma" value={`${active.sigma.toFixed(2)}σ`} />
        <Metric label="DPMO" value={active.dpmo.toLocaleString("en-IN")} />
        <Metric label="Defect rate" value={`${active.defectRatePct.toFixed(2)}%`} />
        <Metric label="Units" value={active.units.toLocaleString("en-IN")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ParetoPanel ctqId={active.id} />
        <ControlPanel ctqId={active.id} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className="text-copy font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
