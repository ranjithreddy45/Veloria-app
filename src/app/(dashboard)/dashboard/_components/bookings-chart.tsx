"use client";

import { Cell, Label, Pie, PieChart, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
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
    <Card className="card-hover-tint rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-2">
        <CardTitle className="text-meta font-medium uppercase tracking-wide text-muted-foreground">
          Bookings by type
        </CardTitle>
        <p className="mt-1 text-body text-muted-foreground">
          <span className="numeric font-semibold text-foreground">
            {totalBookings}
          </span>{" "}
          total · distribution
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        {totalBookings === 0 ? (
          <EmptyState
            icon={<PieChartIcon />}
            title="No bookings yet"
            description="Once events are booked, the split by event type shows here."
            className="py-14"
          />
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
                              className="numeric fill-foreground text-2xl font-semibold"
                            >
                              {totalBookings}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-meta uppercase tracking-wide"
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
                  <span className="truncate text-detail text-muted-foreground">
                    {item.type}
                  </span>
                  <span className="numeric ml-auto text-detail font-medium text-foreground">
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
