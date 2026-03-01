"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { TrendingUp, Target, IndianRupee, Loader2 } from "lucide-react";
import {
  getPipelineReport,
  type DateRange,
  type PipelineReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ============================================================
// Helpers
// ============================================================

function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

// ============================================================
// Component
// ============================================================

interface PipelineReportsProps {
  range: DateRange;
}

export function PipelineReports({ range }: PipelineReportsProps) {
  const [data, setData] = React.useState<PipelineReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    getPipelineReport(range).then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading pipeline data...
      </div>
    );
  }

  if (!data) return null;

  const sourceConfig: ChartConfig = data.leadsBySource.reduce(
    (acc, item) => {
      acc[item.source] = { label: item.source.replace(/_/g, " "), color: item.fill };
      return acc;
    },
    {} as ChartConfig
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-green-600">{data.conversionRate}%</p>
              <p className="text-xs text-zinc-400">
                {data.wonDeals} won / {data.wonDeals + data.lostDeals} decided
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-500">Avg. Deal Value</p>
              <p className="text-2xl font-bold">{formatINR(data.averageDealValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-500">Pipeline Value</p>
              <p className="text-2xl font-bold">{formatINR(data.totalPipelineValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-500">Won vs Lost</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600">{data.wonDeals}</span>
                <span className="text-zinc-400">/</span>
                <span className="text-2xl font-bold text-red-500">{data.lostDeals}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Deals by Stage (Count) + Won vs Lost Pie */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Deals by Stage – Count */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deals by Pipeline Stage</CardTitle>
            <p className="text-xs text-zinc-500">Number of deals at each stage</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {data.dealsByStage.length > 0 ? (
              <ChartContainer config={{ count: { label: "Deals", color: "hsl(262, 83%, 58%)" } }} className="h-[300px] w-full">
                <BarChart data={data.dealsByStage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                  <XAxis dataKey="stage" fontSize={11} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.dealsByStage.map((entry, i) => (
                      <Cell key={i} fill={entry.color || "hsl(262, 83%, 58%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No deal data</p>
            )}
          </CardContent>
        </Card>

        {/* Won vs Lost Pie Chart */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Won vs Lost Deals</CardTitle>
            <p className="text-xs text-zinc-500">Conversion outcome distribution</p>
          </CardHeader>
          <CardContent className="pb-4">
            {(data.wonDeals > 0 || data.lostDeals > 0) ? (
              <>
                <ChartContainer
                  config={{
                    Won: { label: "Won", color: "hsl(142, 71%, 45%)" },
                    Lost: { label: "Lost", color: "hsl(0, 84%, 60%)" },
                  }}
                  className="mx-auto h-[220px] w-full"
                >
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={[
                        { name: "Won", value: data.wonDeals, fill: "hsl(142, 71%, 45%)" },
                        { name: "Lost", value: data.lostDeals, fill: "hsl(0, 84%, 60%)" },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      stroke="white"
                      strokeWidth={2}
                    >
                      <Cell fill="hsl(142, 71%, 45%)" />
                      <Cell fill="hsl(0, 84%, 60%)" />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(142, 71%, 45%)" }} />
                    <span className="text-xs text-zinc-600">Won: {data.wonDeals}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
                    <span className="text-xs text-zinc-600">Lost: {data.lostDeals}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No won/lost data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Pipeline Value by Stage + Leads by Source */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Pipeline Value by Stage Bar Chart */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline Value by Stage</CardTitle>
            <p className="text-xs text-zinc-500">Revenue value at each pipeline stage</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {data.dealsByStage.length > 0 ? (
              <ChartContainer config={{ value: { label: "Value", color: "hsl(217, 91%, 60%)" } }} className="h-[300px] w-full">
                <BarChart data={data.dealsByStage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                  <XAxis dataKey="stage" fontSize={11} angle={-20} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(v) => formatINR(v)} width={60} fontSize={12} />
                  <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.dealsByStage.map((entry, i) => (
                      <Cell key={i} fill={entry.color || "hsl(217, 91%, 60%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No pipeline value data</p>
            )}
          </CardContent>
        </Card>

        {/* Leads by Source */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by Source</CardTitle>
            <p className="text-xs text-zinc-500">Where your leads come from</p>
          </CardHeader>
          <CardContent className="pb-4">
            {data.leadsBySource.length > 0 ? (
              <>
                <ChartContainer config={sourceConfig} className="mx-auto h-[220px] w-full">
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={data.leadsBySource}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="source"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {data.leadsBySource.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                  {data.leadsBySource.map((item) => (
                    <div key={item.source} className="flex items-center gap-2">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-xs text-zinc-600">{item.source.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-xs font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No lead data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
