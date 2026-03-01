"use client";

import { Cell, Label, Pie, PieChart, Tooltip } from "recharts";
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
import type { BookingsByType } from "@/actions/dashboard.actions";

// ============================================================
// Types
// ============================================================

interface BookingsChartProps {
  data: BookingsByType[];
}

// ============================================================
// Bookings Chart Component
// ============================================================

export function BookingsChart({ data }: BookingsChartProps) {
  const totalBookings = data.reduce((sum, item) => sum + item.count, 0);

  // Build chart config from data
  const chartConfig: ChartConfig = data.reduce(
    (acc, item) => {
      acc[item.type] = {
        label: item.type,
        color: item.fill,
      };
      return acc;
    },
    {} as ChartConfig
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-violet-200/50 dark:from-violet-900/40 dark:to-violet-800/20">
            <svg className="size-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Bookings by Type
            </CardTitle>
            <p className="text-xs text-muted-foreground">Distribution of event types</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="mx-auto h-[260px] w-full">
          <PieChart>
            <Tooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
              dataKey="count"
              nameKey="type"
              strokeWidth={2}
              className="stroke-card"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {totalBookings}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Legend */}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
          {data.map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <div
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="truncate text-xs text-muted-foreground">
                {item.type}
              </span>
              <span className="ml-auto text-xs font-medium text-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
