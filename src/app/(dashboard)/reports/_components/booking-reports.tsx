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
} from "recharts";
import { CalendarCheck, CheckCircle, Loader2 } from "lucide-react";
import {
  getBookingReport,
  getBookingsBySourceReport,
  type DateRange,
  type BookingReportData,
  type BookingsBySourceReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ============================================================
// Component
// ============================================================

interface BookingReportsProps {
  range: DateRange;
}

export function BookingReports({ range }: BookingReportsProps) {
  const [data, setData] = React.useState<BookingReportData | null>(null);
  const [sourceData, setSourceData] = React.useState<BookingsBySourceReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getBookingReport(range),
      getBookingsBySourceReport(range),
    ]).then(([bookingRes, sourceRes]) => {
      if (bookingRes.success) setData(bookingRes.data);
      if (sourceRes.success) setSourceData(sourceRes.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading booking data...
      </div>
    );
  }

  if (!data) return null;

  const statusConfig: ChartConfig = data.bookingsByStatus.reduce(
    (acc, item) => {
      acc[item.status] = { label: item.status.replace(/_/g, " "), color: item.fill };
      return acc;
    },
    {} as ChartConfig
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{data.totalBookings}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <CalendarCheck className="size-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{data.completionRate}%</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="size-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Bookings by Month */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings Over Time</CardTitle>
            <p className="text-xs text-muted-foreground">Monthly booking count</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={{ count: { label: "Bookings", color: "hsl(217, 91%, 60%)" } }} className="h-[300px] w-full">
              <AreaChart data={data.bookingsByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bookingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis dataKey="month" tickFormatter={(v) => v.split(" ")[0]} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="count" stroke="hsl(217, 91%, 60%)" fill="url(#bookingsGrad)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bookings by Status */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings by Status</CardTitle>
            <p className="text-xs text-muted-foreground">Current distribution</p>
          </CardHeader>
          <CardContent className="pb-4">
            {data.bookingsByStatus.length > 0 ? (
              <>
                <ChartContainer config={statusConfig} className="mx-auto h-[220px] w-full">
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={data.bookingsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {data.bookingsByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                  {data.bookingsByStatus.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-xs text-muted-foreground">{item.status.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-xs font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No booking data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bookings by Venue */}
      {data.bookingsByVenue.length > 0 && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings by Venue</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution across venues</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={{ count: { label: "Bookings", color: "hsl(142, 71%, 45%)" } }} className="h-[200px] w-full">
              <BarChart data={data.bookingsByVenue} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="venue" width={120} fontSize={12} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Bookings by Lead Source */}
      {sourceData && sourceData.sources.length > 0 && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings by Lead Source</CardTitle>
            <p className="text-xs text-muted-foreground">Where bookings originate from</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer
              config={sourceData.sources.reduce((acc, item) => {
                acc[item.source] = { label: item.source.replace(/_/g, " "), color: item.fill };
                return acc;
              }, {} as ChartConfig)}
              className="h-[250px] w-full"
            >
              <BarChart data={sourceData.sources} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis
                  dataKey="source"
                  tickFormatter={(v) => v.replace(/_/g, " ")}
                  fontSize={11}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {sourceData.sources.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Cancellation Stats */}
      {(() => {
        const cancelledEntry = data.bookingsByStatus.find((s) => s.status === "CANCELLED");
        if (!cancelledEntry || cancelledEntry.count === 0) return null;
        const cancelledCount = cancelledEntry.count;
        const cancelledPct =
          data.totalBookings > 0
            ? Math.round((cancelledCount / data.totalBookings) * 100)
            : 0;
        return (
          <Card className="border-red-200/80 bg-red-50/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-100">
                  <CalendarCheck className="size-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Cancelled Bookings: {cancelledCount} ({cancelledPct}%)
                  </p>
                  <p className="text-xs text-red-500">
                    Out of {data.totalBookings} total bookings in the selected period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
