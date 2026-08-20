"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContactSentimentTrend } from "@/actions/sentiment.actions";

// ============================================================
// Types
// ============================================================

interface TrendDataPoint {
  month: string;
  avgScore: number;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentTrendChartProps {
  contactId: string;
}

// ============================================================
// Custom tooltip
// ============================================================

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: TrendDataPoint }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-white p-3 shadow-md dark:bg-zinc-900">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-sm">
        Avg Score:{" "}
        <span
          className={
            data.avgScore > 0.2
              ? "text-green-600"
              : data.avgScore < -0.2
                ? "text-red-600"
                : "text-muted-foreground"
          }
        >
          {data.avgScore > 0 ? "+" : ""}
          {data.avgScore.toFixed(2)}
        </span>
      </p>
      <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
        <span className="text-green-600">{data.positive} positive</span>
        <span className="text-muted-foreground">{data.neutral} neutral</span>
        <span className="text-red-600">{data.negative} negative</span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {data.count} communication{data.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ============================================================
// Component
// ============================================================

export function SentimentTrendChart({ contactId }: SentimentTrendChartProps) {
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getContactSentimentTrend(contactId);
      if (result.success && result.data) {
        setData(result.data as TrendDataPoint[]);
      }
    } catch (err) {
      console.error("[SentimentTrendChart] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-blue-500" />
          Sentiment Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full rounded-md" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No sentiment data available yet
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="sentimentGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#eab308" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[-1, 1]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="avgScore"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#sentimentGradient)"
                dot={{ r: 4, fill: "#3b82f6" }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
