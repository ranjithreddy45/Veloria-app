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
    color: "var(--primary)",
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
  // Compute total + change for the subtitle row
  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const last = data[data.length - 1]?.revenue ?? 0;
  const prev = data[data.length - 2]?.revenue ?? 0;
  const change = prev === 0 ? 0 : ((last - prev) / prev) * 100;

  return (
    <Card className="card-hover-tint rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover">
      <CardHeader className="flex flex-row items-end justify-between pb-2">
        <div>
          <CardTitle className="text-meta font-medium uppercase tracking-wide text-muted-foreground">
            Revenue
          </CardTitle>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="numeric text-h2 font-semibold leading-none text-foreground">
              ₹{formatYAxis(total).replace("₹", "")}
            </span>
            {change !== 0 && (
              <span
                className={
                  change >= 0
                    ? "numeric text-detail font-medium text-emerald-600 dark:text-emerald-400"
                    : "numeric text-detail font-medium text-destructive"
                }
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}% m/m
              </span>
            )}
          </div>
        </div>
        <p className="text-body text-muted-foreground">Last 12 months</p>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                <stop offset="60%" stopColor="var(--primary)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              vertical={false}
              stroke="var(--border)"
              strokeOpacity={0.7}
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => value.split(" ")[0]}
              tickMargin={10}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={formatYAxis}
              width={52}
            />
            <Tooltip
              cursor={{
                stroke: "var(--primary)",
                strokeWidth: 1,
                strokeDasharray: "2 4",
              }}
              content={
                <ChartTooltipContent
                  formatter={(value) => formatTooltipValue(Number(value))}
                  indicator="line"
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--primary)"
              strokeWidth={1.75}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--background)",
                stroke: "var(--primary)",
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
