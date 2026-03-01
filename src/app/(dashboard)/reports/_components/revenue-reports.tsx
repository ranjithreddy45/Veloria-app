"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
  Label,
} from "recharts";
import { IndianRupee, TrendingUp, CalendarCheck, Loader2 } from "lucide-react";
import {
  getRevenueReport,
  getPaymentMethodReport,
  type DateRange,
  type RevenueReportData,
  type PaymentMethodReportData,
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

interface RevenueReportsProps {
  range: DateRange;
}

export function RevenueReports({ range }: RevenueReportsProps) {
  const [data, setData] = React.useState<RevenueReportData | null>(null);
  const [paymentMethodData, setPaymentMethodData] = React.useState<PaymentMethodReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getRevenueReport(range),
      getPaymentMethodReport(range),
    ]).then(([revenueRes, pmRes]) => {
      if (revenueRes.success) setData(revenueRes.data);
      if (pmRes.success) setPaymentMethodData(pmRes.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading revenue data...
      </div>
    );
  }

  if (!data) return null;

  const revenueConfig: ChartConfig = {
    revenue: { label: "Revenue", color: "hsl(239, 84%, 67%)" },
  };

  const eventTypeConfig: ChartConfig = data.revenueByEventType.reduce(
    (acc, item) => {
      acc[item.type] = { label: item.type, color: item.fill };
      return acc;
    },
    {} as ChartConfig
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">Total Revenue</p>
                <p className="text-2xl font-bold">{formatINR(data.totalRevenue)}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <IndianRupee className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">Avg. Booking Value</p>
                <p className="text-2xl font-bold">{formatINR(data.averageBookingValue)}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100">
                <TrendingUp className="size-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">Total Bookings</p>
                <p className="text-2xl font-bold">{data.totalBookings}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <CalendarCheck className="size-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Revenue Trend */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <p className="text-xs text-zinc-500">Monthly revenue over time</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={revenueConfig} className="h-[300px] w-full">
              <AreaChart data={data.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis dataKey="month" tickFormatter={(v) => v.split(" ")[0]} fontSize={12} />
                <YAxis tickFormatter={(v) => formatINR(v)} width={60} fontSize={12} />
                <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(239, 84%, 67%)" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue by Event Type */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Event Type</CardTitle>
            <p className="text-xs text-zinc-500">Distribution of revenue</p>
          </CardHeader>
          <CardContent className="pb-4">
            {data.revenueByEventType.length > 0 ? (
              <>
                <ChartContainer config={eventTypeConfig} className="mx-auto h-[220px] w-full">
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                    <Pie
                      data={data.revenueByEventType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="type"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {data.revenueByEventType.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                  {data.revenueByEventType.map((item) => (
                    <div key={item.type} className="flex items-center gap-2">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-xs text-zinc-600">{item.type}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No revenue data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Venue */}
      {data.revenueByVenue.length > 0 && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Venue</CardTitle>
            <p className="text-xs text-zinc-500">Revenue breakdown across venues</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(239, 84%, 67%)" } }} className="h-[200px] w-full">
              <BarChart data={data.revenueByVenue} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                <YAxis type="category" dataKey="venue" width={120} fontSize={12} />
                <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Bar dataKey="revenue" fill="hsl(239, 84%, 67%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Payment Collection by Method */}
      {paymentMethodData && paymentMethodData.methods.length > 0 && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Collection by Method</CardTitle>
            <p className="text-xs text-zinc-500">Breakdown of payments received by method</p>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart */}
              <ChartContainer
                config={paymentMethodData.methods.reduce(
                  (acc, item) => {
                    acc[item.method] = { label: item.method.replace(/_/g, " "), color: item.fill };
                    return acc;
                  },
                  {} as ChartConfig
                )}
                className="mx-auto h-[220px] w-full"
              >
                <PieChart>
                  <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                  <Pie
                    data={paymentMethodData.methods}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="method"
                    stroke="white"
                    strokeWidth={2}
                  >
                    {paymentMethodData.methods.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* Legend + Details */}
              <div className="flex flex-col justify-center space-y-2">
                {paymentMethodData.methods.map((item) => (
                  <div key={item.method} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm text-zinc-700">{item.method.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatINR(item.amount)}</p>
                      <p className="text-xs text-zinc-400">{item.count} payments</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
