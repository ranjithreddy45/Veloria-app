"use client";

import dynamic from "next/dynamic";

// Defer the recharts-backed call analytics charts so the calls table
// (the primary content) paints first. Charts stream in behind a skeleton.
export const CallAnalyticsCharts = dynamic(
  () => import("./call-analytics-charts").then((m) => m.CallAnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />
        <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />
      </div>
    ),
  }
);
