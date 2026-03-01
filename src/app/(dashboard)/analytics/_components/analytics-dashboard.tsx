"use client";

import { useState, useCallback, useTransition } from "react";
import {
  IndianRupeeIcon,
  CalendarCheckIcon,
  UsersIcon,
  BuildingIcon,
  TrendingUpIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  PieChartIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, cn } from "@/lib/utils";

import { KPIGrid, type KPI } from "./kpi-grid";
import { ConversionFunnel } from "./conversion-funnel";
import { DateRangePicker, type DateRange } from "./date-range-picker";

import {
  getRevenueAnalytics,
  getBookingAnalytics,
  getLeadConversionFunnel,
  getVenueUtilization,
  getMonthOverMonth,
  getTopClients,
  getCashflow,
} from "@/actions/analytics.actions";

import type {
  RevenueAnalyticsData,
  BookingAnalyticsData,
  LeadFunnelData,
  VenueUtilizationData,
  MonthOverMonthData,
  TopClientData,
  CashflowData,
} from "@/actions/analytics.actions";

// ============================================================
// Types
// ============================================================

interface AnalyticsDashboardProps {
  initialRevenue: RevenueAnalyticsData;
  initialBookings: BookingAnalyticsData;
  initialFunnel: LeadFunnelData;
  initialUtilization: VenueUtilizationData;
  initialMoM: MonthOverMonthData;
  initialTopClients: TopClientData;
  initialCashflow: CashflowData;
}

// ============================================================
// Helpers
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  TENTATIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  IN_PROGRESS: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  COMPLETED: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const UTILIZATION_COLORS = [
  { min: 0, max: 25, bg: "bg-red-200 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  { min: 25, max: 50, bg: "bg-amber-200 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  { min: 50, max: 75, bg: "bg-emerald-200 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  { min: 75, max: 101, bg: "bg-emerald-400 dark:bg-emerald-800/60", text: "text-emerald-900 dark:text-emerald-100" },
];

function getUtilizationColor(percent: number) {
  return UTILIZATION_COLORS.find((c) => percent >= c.min && percent < c.max) ?? UTILIZATION_COLORS[0];
}

// ============================================================
// Simple Bar Chart Component
// ============================================================

function BarChart({
  data,
  labelKey,
  valueKey,
  formatValue,
  barColor = "bg-violet-500 dark:bg-violet-600",
  className,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
  barColor?: string;
  className?: string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));

  return (
    <div className={cn("space-y-2", className)}>
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const widthPercent = Math.max((val / maxVal) * 100, 2);
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[60%]">
                {String(item[labelKey])}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                {fmt(val)}
              </span>
            </div>
            <div className="h-6 w-full rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded transition-all duration-500 ease-out",
                  barColor
                )}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Simple Trend Chart Component (Monthly Data)
// ============================================================

function TrendChart({
  data,
  labelKey,
  valueKey,
  formatValue,
  barColor = "bg-violet-500 dark:bg-violet-600",
  height = 200,
  className,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
  barColor?: string;
  height?: number;
  className?: string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-end gap-1"
        style={{ height: `${height}px` }}
      >
        {data.map((item, idx) => {
          const val = Number(item[valueKey]) || 0;
          const heightPercent = Math.max((val / maxVal) * 100, 2);
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {fmt(val)}
                </div>
              </div>
              <div
                className={cn(
                  "w-full rounded-t transition-all duration-300 ease-out hover:opacity-80",
                  barColor
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-1 mt-2">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="flex-1 text-center text-[10px] text-muted-foreground truncate"
          >
            {String(item[labelKey]).replace(" 20", "\n'")}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Analytics Dashboard
// ============================================================

export function AnalyticsDashboard({
  initialRevenue,
  initialBookings,
  initialFunnel,
  initialUtilization,
  initialMoM,
  initialTopClients,
  initialCashflow,
}: AnalyticsDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: undefined,
    endDate: undefined,
  });

  // State for each data section
  const [revenue, setRevenue] = useState(initialRevenue);
  const [bookings, setBookings] = useState(initialBookings);
  const [funnel, setFunnel] = useState(initialFunnel);
  const [utilization, setUtilization] = useState(initialUtilization);
  const [mom, setMoM] = useState(initialMoM);
  const [topClients, setTopClients] = useState(initialTopClients);
  const [cashflow, setCashflow] = useState(initialCashflow);

  const handleDateChange = useCallback(
    (range: DateRange) => {
      setDateRange(range);
      startTransition(async () => {
        const params = {
          startDate: range.startDate,
          endDate: range.endDate,
        };

        const [revRes, bookRes, funnelRes, momRes, clientRes, cashRes] =
          await Promise.all([
            getRevenueAnalytics(params),
            getBookingAnalytics(params),
            getLeadConversionFunnel(params),
            getMonthOverMonth(),
            getTopClients(10),
            getCashflow(),
          ]);

        if (revRes.success) setRevenue(revRes.data);
        if (bookRes.success) setBookings(bookRes.data);
        if (funnelRes.success) setFunnel(funnelRes.data);
        if (momRes.success) setMoM(momRes.data);
        if (clientRes.success) setTopClients(clientRes.data);
        if (cashRes.success) setCashflow(cashRes.data);
      });
    },
    []
  );

  // ============================================================
  // Revenue Tab KPIs
  // ============================================================

  const revenueKPIs: KPI[] = [
    {
      label: "Total Revenue",
      value: formatINR(revenue.totalRevenue),
      icon: <IndianRupeeIcon className="size-4" />,
    },
    {
      label: "Avg. Booking Value",
      value: formatINR(revenue.averageBookingValue),
      icon: <TrendingUpIcon className="size-4" />,
    },
    {
      label: "Revenue Sources",
      value: revenue.revenueByVenue.length,
      icon: <BuildingIcon className="size-4" />,
    },
    {
      label: "Event Types",
      value: revenue.revenueByEventType.length,
      icon: <PieChartIcon className="size-4" />,
    },
  ];

  // ============================================================
  // Booking Tab KPIs
  // ============================================================

  const bookingKPIs: KPI[] = [
    {
      label: "Total Bookings",
      value: bookings.totalBookings,
      icon: <CalendarCheckIcon className="size-4" />,
    },
    {
      label: "Confirmed",
      value: bookings.bookingsByStatus["CONFIRMED"] ?? 0,
      icon: <CalendarCheckIcon className="size-4" />,
    },
    {
      label: "Completed",
      value: bookings.bookingsByStatus["COMPLETED"] ?? 0,
      icon: <CalendarCheckIcon className="size-4" />,
    },
    {
      label: "Avg. Guest Count",
      value: bookings.averageGuestCount,
      icon: <UsersIcon className="size-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <DateRangePicker value={dateRange} onChange={handleDateChange} />

      {/* Loading indicator */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Refreshing analytics...
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">
            <IndianRupeeIcon className="size-4 mr-1.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarCheckIcon className="size-4 mr-1.5" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <BarChart3Icon className="size-4 mr-1.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="clients">
            <UsersIcon className="size-4 mr-1.5" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="venues">
            <BuildingIcon className="size-4 mr-1.5" />
            Venues
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* Revenue Tab */}
        {/* ============================================================ */}
        <TabsContent value="revenue" className="space-y-6">
          <KPIGrid items={revenueKPIs} />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
                <CardDescription>Revenue trend over time</CardDescription>
              </CardHeader>
              <CardContent>
                {revenue.monthlyRevenue.length > 0 ? (
                  <TrendChart
                    data={revenue.monthlyRevenue}
                    labelKey="month"
                    valueKey="revenue"
                    formatValue={(v) => formatINR(v)}
                    barColor="bg-emerald-500 dark:bg-emerald-600"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No revenue data for this period
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cashflow */}
            <Card>
              <CardHeader>
                <CardTitle>Cashflow</CardTitle>
                <CardDescription>Income vs Expenses</CardDescription>
              </CardHeader>
              <CardContent>
                {cashflow.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-end gap-1" style={{ height: "200px" }}>
                      {cashflow.map((item, idx) => {
                        const maxVal = Math.max(
                          ...cashflow.map((c) => Math.max(c.income, c.expenses)),
                          1
                        );
                        const incH = Math.max((item.income / maxVal) * 100, 2);
                        const expH = Math.max((item.expenses / maxVal) * 100, 2);
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex items-end gap-[2px] group relative"
                          >
                            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 left-1/2 -translate-x-1/2">
                              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                <div>In: {formatINR(item.income)}</div>
                                <div>Out: {formatINR(item.expenses)}</div>
                                <div className={item.net >= 0 ? "text-emerald-400" : "text-red-400"}>
                                  Net: {formatINR(item.net)}
                                </div>
                              </div>
                            </div>
                            <div
                              className="flex-1 bg-emerald-500 dark:bg-emerald-600 rounded-t transition-all"
                              style={{ height: `${incH}%` }}
                            />
                            <div
                              className="flex-1 bg-red-400 dark:bg-red-600 rounded-t transition-all"
                              style={{ height: `${expH}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-1">
                      {cashflow.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex-1 text-center text-[10px] text-muted-foreground truncate"
                        >
                          {item.month.replace(" 20", " '")}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-emerald-500" />
                        Income
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-red-400" />
                        Expenses
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No cashflow data available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue by Venue */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Venue</CardTitle>
              </CardHeader>
              <CardContent>
                {revenue.revenueByVenue.length > 0 ? (
                  <BarChart
                    data={revenue.revenueByVenue}
                    labelKey="venue"
                    valueKey="revenue"
                    formatValue={(v) => formatINR(v)}
                    barColor="bg-blue-500 dark:bg-blue-600"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No venue data
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Event Type */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Event Type</CardTitle>
              </CardHeader>
              <CardContent>
                {revenue.revenueByEventType.length > 0 ? (
                  <BarChart
                    data={revenue.revenueByEventType}
                    labelKey="type"
                    valueKey="revenue"
                    formatValue={(v) => formatINR(v)}
                    barColor="bg-amber-500 dark:bg-amber-600"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No event type data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Bookings Tab */}
        {/* ============================================================ */}
        <TabsContent value="bookings" className="space-y-6">
          <KPIGrid items={bookingKPIs} />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bookings by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Bookings by Status</CardTitle>
                <CardDescription>
                  Distribution across booking statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(bookings.bookingsByStatus).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(bookings.bookingsByStatus)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => {
                        const total = bookings.totalBookings || 1;
                        const percent = ((count / total) * 100).toFixed(1);
                        return (
                          <div key={status} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  STATUS_COLORS[status] ?? ""
                                )}
                              >
                                {status.replace("_", " ")}
                              </Badge>
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                                {count.toLocaleString("en-IN")} ({percent}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 dark:bg-violet-600 transition-all"
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No bookings data
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Bookings by Month */}
            <Card>
              <CardHeader>
                <CardTitle>Bookings by Month</CardTitle>
                <CardDescription>Monthly booking volume</CardDescription>
              </CardHeader>
              <CardContent>
                {bookings.bookingsByMonth.length > 0 ? (
                  <TrendChart
                    data={bookings.bookingsByMonth}
                    labelKey="month"
                    valueKey="count"
                    barColor="bg-blue-500 dark:bg-blue-600"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No monthly booking data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bookings by Venue */}
          <Card>
            <CardHeader>
              <CardTitle>Bookings by Venue</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.bookingsByVenue.length > 0 ? (
                <BarChart
                  data={bookings.bookingsByVenue}
                  labelKey="venue"
                  valueKey="count"
                  barColor="bg-sky-500 dark:bg-sky-600"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No venue data
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* Pipeline Tab */}
        {/* ============================================================ */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Pipeline KPIs */}
          <KPIGrid
            items={[
              {
                label: "Total Leads",
                value: funnel.reduce((sum, s) => sum + s.count, 0),
                icon: <UsersIcon className="size-4" />,
              },
              {
                label: "Won Leads",
                value: funnel.find((s) => s.stage === "WON")?.count ?? 0,
                icon: <TrendingUpIcon className="size-4" />,
              },
              {
                label: "Lost Leads",
                value: funnel.find((s) => s.stage === "LOST")?.count ?? 0,
                icon: <ArrowDownIcon className="size-4" />,
              },
              {
                label: "Win Rate",
                value: (() => {
                  const won = funnel.find((s) => s.stage === "WON")?.count ?? 0;
                  const lost = funnel.find((s) => s.stage === "LOST")?.count ?? 0;
                  const total = won + lost;
                  return total > 0 ? `${((won / total) * 100).toFixed(1)}%` : "N/A";
                })(),
                icon: <PieChartIcon className="size-4" />,
              },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Conversion Funnel */}
            <ConversionFunnel data={funnel} />

            {/* Month over Month */}
            <Card>
              <CardHeader>
                <CardTitle>Month over Month</CardTitle>
                <CardDescription>
                  Revenue, bookings, and leads trend
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mom.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mom.map((row, idx) => {
                          const prevRevenue = idx > 0 ? mom[idx - 1].revenue : 0;
                          const revChange =
                            prevRevenue > 0
                              ? ((row.revenue - prevRevenue) / prevRevenue) * 100
                              : 0;
                          return (
                            <TableRow key={row.month}>
                              <TableCell className="font-medium">
                                {row.month}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {formatINR(row.revenue)}
                                  {idx > 0 && revChange !== 0 && (
                                    <span
                                      className={cn(
                                        "text-[10px]",
                                        revChange > 0
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      {revChange > 0 ? (
                                        <ArrowUpIcon className="size-3 inline" />
                                      ) : (
                                        <ArrowDownIcon className="size-3 inline" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.bookings.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.leads.toLocaleString("en-IN")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No month-over-month data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Clients Tab */}
        {/* ============================================================ */}
        <TabsContent value="clients" className="space-y-6">
          <KPIGrid
            items={[
              {
                label: "Top Clients",
                value: topClients.length,
                icon: <UsersIcon className="size-4" />,
              },
              {
                label: "Highest Spender",
                value: topClients.length > 0 ? formatINR(topClients[0].totalSpent) : "--",
                icon: <IndianRupeeIcon className="size-4" />,
              },
              {
                label: "Avg. Client Value",
                value:
                  topClients.length > 0
                    ? formatINR(
                        topClients.reduce((s, c) => s + c.totalSpent, 0) /
                          topClients.length
                      )
                    : "--",
                icon: <TrendingUpIcon className="size-4" />,
              },
              {
                label: "Total Bookings (Top 10)",
                value: topClients.reduce((s, c) => s + c.totalBookings, 0),
                icon: <CalendarCheckIcon className="size-4" />,
              },
            ]}
            columns={4}
          />

          <Card>
            <CardHeader>
              <CardTitle>Top Clients by Revenue</CardTitle>
              <CardDescription>
                Clients ranked by total amount spent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                      <TableHead className="text-right">Avg. per Booking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClients.map((client, idx) => (
                      <TableRow key={client.contactId}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {client.contactName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {client.totalBookings.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatINR(client.totalSpent)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {client.totalBookings > 0
                            ? formatINR(client.totalSpent / client.totalBookings)
                            : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No client data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Client Revenue Bar Chart */}
          {topClients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Client Lifetime Value</CardTitle>
                <CardDescription>
                  Visual comparison of top client spending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={topClients.map((c) => ({
                    name: c.contactName,
                    value: c.totalSpent,
                  }))}
                  labelKey="name"
                  valueKey="value"
                  formatValue={(v) => formatINR(v)}
                  barColor="bg-violet-500 dark:bg-violet-600"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* Venues Tab */}
        {/* ============================================================ */}
        <TabsContent value="venues" className="space-y-6">
          <KPIGrid
            items={[
              {
                label: "Active Venues",
                value: utilization.length,
                icon: <BuildingIcon className="size-4" />,
              },
              {
                label: "Avg. Utilization",
                value:
                  utilization.length > 0
                    ? `${Math.round(
                        utilization.reduce((s, v) => s + v.utilizationPercent, 0) /
                          utilization.length
                      )}%`
                    : "N/A",
                icon: <BarChart3Icon className="size-4" />,
              },
              {
                label: "Most Booked",
                value:
                  utilization.length > 0
                    ? utilization.reduce((best, v) =>
                        v.totalBookings > best.totalBookings ? v : best
                      ).venueName
                    : "N/A",
                icon: <TrendingUpIcon className="size-4" />,
              },
              {
                label: "Total Venue Bookings",
                value: utilization.reduce((s, v) => s + v.totalBookings, 0),
                icon: <CalendarCheckIcon className="size-4" />,
              },
            ]}
            columns={4}
          />

          {/* Utilization Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>Venue Utilization</CardTitle>
              <CardDescription>
                Booking utilization for the current month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {utilization.length > 0 ? (
                <div className="space-y-4">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {UTILIZATION_COLORS.map((c) => (
                      <div key={c.min} className="flex items-center gap-1.5">
                        <div className={cn("size-3 rounded", c.bg)} />
                        <span>
                          {c.min}–{c.max === 101 ? "100" : c.max}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {utilization.map((venue) => {
                      const color = getUtilizationColor(venue.utilizationPercent);
                      return (
                        <div
                          key={venue.venueId}
                          className={cn(
                            "rounded-lg p-4 border transition-colors",
                            color.bg
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p
                                className={cn(
                                  "font-semibold text-sm",
                                  color.text
                                )}
                              >
                                {venue.venueName}
                              </p>
                              <p className="text-xs mt-1 opacity-75">
                                {venue.totalBookings.toLocaleString("en-IN")}{" "}
                                booking{venue.totalBookings !== 1 ? "s" : ""} |{" "}
                                {venue.bookedDays} day
                                {venue.bookedDays !== 1 ? "s" : ""} booked
                              </p>
                            </div>
                            <span
                              className={cn(
                                "text-lg font-bold tabular-nums",
                                color.text
                              )}
                            >
                              {venue.utilizationPercent}%
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="mt-2 h-1.5 w-full rounded-full bg-white/30 dark:bg-black/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/60 dark:bg-white/30 transition-all"
                              style={{
                                width: `${venue.utilizationPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No venue utilization data
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bookings per Venue */}
          <Card>
            <CardHeader>
              <CardTitle>Bookings per Venue</CardTitle>
            </CardHeader>
            <CardContent>
              {utilization.length > 0 ? (
                <BarChart
                  data={utilization
                    .map((v) => ({
                      venue: v.venueName,
                      bookings: v.totalBookings,
                    }))
                    .sort(
                      (a, b) => b.bookings - a.bookings
                    )}
                  labelKey="venue"
                  valueKey="bookings"
                  barColor="bg-teal-500 dark:bg-teal-600"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No venue data
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
