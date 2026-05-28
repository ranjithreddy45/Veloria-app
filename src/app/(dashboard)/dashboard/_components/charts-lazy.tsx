"use client";

import dynamic from "next/dynamic";

// ============================================================
// Lazy chart wrappers
// ============================================================
// The charting library (recharts) is ~250KB. Loading it eagerly bloats
// the dashboard's first paint. These wrappers defer it: the page renders
// instantly (KPIs, lists), and the charts stream in behind a skeleton.
// Wrapper is a Client Component so it may use ssr:false.

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-muted/40"
      style={{ height }}
      aria-hidden
    />
  );
}

export const RevenueChart = dynamic(
  () => import("./revenue-chart").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> }
);

export const BookingsChart = dynamic(
  () => import("./bookings-chart").then((m) => m.BookingsChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> }
);
