"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { CALL_DISPOSITION_LABELS } from "@/lib/constants";

interface CallAnalyticsChartsProps {
  analytics: {
    callsByHour: { hour: number; count: number }[];
    callsByDisposition: { disposition: string; count: number }[];
  };
}

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
  "#10b981",
];

export function CallAnalyticsCharts({ analytics }: CallAnalyticsChartsProps) {
  const hourData = Array.from({ length: 24 }, (_, i) => {
    const found = analytics.callsByHour?.find((h) => h.hour === i);
    return {
      hour: `${i.toString().padStart(2, "0")}:00`,
      calls: found?.count || 0,
    };
  });

  const dispositionData = (analytics.callsByDisposition || []).map((d) => ({
    name: CALL_DISPOSITION_LABELS[d.disposition] || d.disposition,
    value: d.count,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Calls by Hour */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Calls by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="hour"
                  fontSize={10}
                  tickLine={false}
                  interval={2}
                />
                <YAxis fontSize={12} tickLine={false} />
                <Tooltip />
                <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Calls by Disposition */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Calls by Disposition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {dispositionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dispositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dispositionData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No call data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
