"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlyRevenue } from "@/actions/dashboard.actions";

// ============================================================
// Types
// ============================================================

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

// ============================================================
// Chart config
// ============================================================

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "oklch(0.55 0.24 277)",
  },
} satisfies ChartConfig;

// ============================================================
// Format helper for Y axis
// ============================================================

function formatYAxis(value: number): string {
  if (value >= 10000000) return `\u20B9${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `\u20B9${(value / 100000).toFixed(0)}L`;
  if (value >= 1000) return `\u20B9${(value / 1000).toFixed(0)}K`;
  return `\u20B9${value}`;
}

function formatTooltipValue(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN")}`;
}

// ============================================================
// Revenue Chart Component
// ============================================================

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20">
            <svg className="size-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Revenue Overview
            </CardTitle>
            <p className="text-xs text-muted-foreground">Monthly revenue for the last 12 months</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(239, 84%, 67%)"
                  stopOpacity={0.5}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(239, 84%, 67%)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-border"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "hsl(240, 4%, 46%)" }}
              tickFormatter={(value) => value.split(" ")[0]}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "hsl(240, 4%, 46%)" }}
              tickFormatter={formatYAxis}
              width={60}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatTooltipValue(Number(value))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(239, 84%, 67%)"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
