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
    <Card className="card-hover-tint border border-border bg-card shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Bookings by type
        </CardTitle>
        <p className="mt-1 text-[12px] text-muted-foreground/80">
          <span className="font-semibold text-foreground tabular-nums">{totalBookings}</span> total · distribution
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        {totalBookings === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/60">
            <svg className="mb-2 size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            <p className="text-sm font-medium">No bookings yet</p>
            <p className="text-xs">Booking data will appear here</p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
