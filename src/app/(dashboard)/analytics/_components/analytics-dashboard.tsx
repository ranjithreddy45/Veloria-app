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
import { EmptyState } from "@/components/ui/empty-state";
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
  HOLD: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  TENTATIVE: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  IN_PROGRESS: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

// Utilization bands — a calm neutral card with a colored bar + figure rather
// than a heavy color-block, so the grid reads as data instead of confetti.
const UTILIZATION_COLORS = [
  { min: 0, max: 25, dot: "bg-rose-500", bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  { min: 25, max: 50, dot: "bg-amber-500", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { min: 50, max: 75, dot: "bg-teal-500", bar: "bg-teal-500", text: "text-teal-600 dark:text-teal-400" },
  { min: 75, max: 101, dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
];

function getUtilizationColor(percent: number) {
  return UTILIZATION_COLORS.find((c) => percent >= c.min && percent < c.max) ?? UTILIZATION_COLORS[0];
}

// Shared chrome so every panel on this page reads as one system.
const CARD = "rounded-2xl border bg-card shadow-card";
const TH = "h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

// ============================================================
// Simple Bar Chart Component
// ============================================================

function BarChart({
  data,
  labelKey,
  valueKey,
  formatValue,
  barColor = "bg-violet-500",
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
    <div className={cn("space-y-3.5", className)}>
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const widthPercent = Math.max((val / maxVal) * 100, 2);
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="max-w-[60%] truncate text-[13px] text-muted-foreground">
                {String(item[labelKey])}
              </span>
              <span className="numeric text-[13px] font-medium text-foreground">
                {fmt(val)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
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
  barColor = "bg-violet-500",
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
      {/* Peak reference — gives the bars a scale to read against */}
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Peak
        </span>
        <span className="numeric text-[12px] text-muted-foreground">
          {fmt(maxVal)}
        </span>
      </div>
      <div
        className="flex items-end gap-1 border-b border-border/70"
        style={{ height: `${height}px` }}
      >
        {data.map((item, idx) => {
          const val = Number(item[valueKey]) || 0;
          const heightPercent = Math.max((val / maxVal) * 100, 2);
          return (
            <div
              key={idx}
              className="group relative flex flex-1 flex-col items-center gap-1"
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full z-10 mb-1.5 hidden group-hover:block">
                <div className="numeric whitespace-nowrap rounded-lg border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-card-hover">
                  {fmt(val)}
                </div>
              </div>
              <div
                className={cn(
                  "w-full rounded-t-[3px] transition-[height,opacity] duration-300 ease-out group-hover:opacity-75",
                  barColor
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Axis labels */}
      <div className="mt-2 flex gap-1">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="numeric flex-1 truncate text-center text-[10.5px] text-muted-foreground"
          >
            {String(item[labelKey]).replace(" 20", " '")}
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
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <div className="size-3.5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          Refreshing analytics…
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">
            <IndianRupeeIcon className="mr-1.5 size-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarCheckIcon className="mr-1.5 size-3.5" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <BarChart3Icon className="mr-1.5 size-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="clients">
            <UsersIcon className="mr-1.5 size-3.5" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="venues">
            <BuildingIcon className="mr-1.5 size-3.5" />
            Venues
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* Revenue Tab */}
        {/* ============================================================ */}
        <TabsContent value="revenue" className="space-y-4">
          <KPIGrid items={revenueKPIs} />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Monthly Revenue Trend */}
            <Card className={CARD}>
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
                    barColor="bg-emerald-500"
                  />
                ) : (
                  <EmptyState
                    icon={<IndianRupeeIcon />}
                    title="No revenue in this period"
                    description="Collected payments will chart here once invoices are paid."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>

            {/* Cashflow */}
            <Card className={CARD}>
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
                            <div className="absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 group-hover:block">
                              <div className="numeric space-y-0.5 whitespace-nowrap rounded-lg border bg-popover px-2 py-1.5 text-[11px] text-popover-foreground shadow-card-hover">
                                <div>In: {formatINR(item.income)}</div>
                                <div>Out: {formatINR(item.expenses)}</div>
                                <div
                                  className={
                                    item.net >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  Net: {formatINR(item.net)}
                                </div>
                              </div>
                            </div>
                            <div
                              className="flex-1 rounded-t-[3px] bg-emerald-500 transition-[height] duration-300"
                              style={{ height: `${incH}%` }}
                            />
                            <div
                              className="flex-1 rounded-t-[3px] bg-rose-400 transition-[height] duration-300"
                              style={{ height: `${expH}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-1 border-t border-border/70 pt-2">
                      {cashflow.map((item, idx) => (
                        <div
                          key={idx}
                          className="numeric flex-1 truncate text-center text-[10.5px] text-muted-foreground"
                        >
                          {item.month.replace(" 20", " '")}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Income
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-rose-400" />
                        Expenses
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUpIcon />}
                    title="No cashflow yet"
                    description="Income and expense movement appears once transactions are recorded."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by Venue */}
            <Card className={CARD}>
              <CardHeader>
                <CardTitle>Revenue by Venue</CardTitle>
                <CardDescription>Where the money is earned</CardDescription>
              </CardHeader>
              <CardContent>
                {revenue.revenueByVenue.length > 0 ? (
                  <BarChart
                    data={revenue.revenueByVenue}
                    labelKey="venue"
                    valueKey="revenue"
                    formatValue={(v) => formatINR(v)}
                    barColor="bg-blue-500"
                  />
                ) : (
                  <EmptyState
                    icon={<BuildingIcon />}
                    title="No venue revenue"
                    description="Once bookings are invoiced, each venue's contribution shows here."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>

            {/* Revenue by Event Type */}
            <Card className={CARD}>
              <CardHeader>
                <CardTitle>Revenue by Event Type</CardTitle>
                <CardDescription>Which occasions pay best</CardDescription>
              </CardHeader>
              <CardContent>
                {revenue.revenueByEventType.length > 0 ? (
                  <BarChart
                    data={revenue.revenueByEventType}
                    labelKey="type"
                    valueKey="revenue"
                    formatValue={(v) => formatINR(v)}
                    barColor="bg-amber-500"
                  />
                ) : (
                  <EmptyState
                    icon={<PieChartIcon />}
                    title="No event-type revenue"
                    description="Weddings, receptions and corporate events break down here."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Bookings Tab */}
        {/* ============================================================ */}
        <TabsContent value="bookings" className="space-y-4">
          <KPIGrid items={bookingKPIs} />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Bookings by Status */}
            <Card className={CARD}>
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
                            <div className="flex items-center justify-between gap-3">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[11px] font-medium",
                                  STATUS_COLORS[status] ?? ""
                                )}
                              >
                                {status.replace("_", " ")}
                              </Badge>
                              <span className="numeric text-[13px] font-medium text-foreground">
                                {count.toLocaleString("en-IN")}
                                <span className="ml-1.5 font-normal text-muted-foreground">
                                  {percent}%
                                </span>
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-[width] duration-500 ease-out"
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<CalendarCheckIcon />}
                    title="No bookings yet"
                    description="Status distribution appears once bookings are created."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>

            {/* Bookings by Month */}
            <Card className={CARD}>
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
                    barColor="bg-blue-500"
                  />
                ) : (
                  <EmptyState
                    icon={<BarChart3Icon />}
                    title="No monthly volume"
                    description="Booking counts chart by month as events are confirmed."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bookings by Venue */}
          <Card className={CARD}>
            <CardHeader>
              <CardTitle>Bookings by Venue</CardTitle>
              <CardDescription>Which halls carry the load</CardDescription>
            </CardHeader>
            <CardContent>
              {bookings.bookingsByVenue.length > 0 ? (
                <BarChart
                  data={bookings.bookingsByVenue}
                  labelKey="venue"
                  valueKey="count"
                  barColor="bg-sky-500"
                />
              ) : (
                <EmptyState
                  icon={<BuildingIcon />}
                  title="No venue bookings"
                  description="Each venue's booking count appears here once events are scheduled."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* Pipeline Tab */}
        {/* ============================================================ */}
        <TabsContent value="pipeline" className="space-y-4">
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

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Conversion Funnel */}
            <ConversionFunnel data={funnel} className={CARD} />

            {/* Month over Month */}
            <Card className={CARD}>
              <CardHeader>
                <CardTitle>Month over Month</CardTitle>
                <CardDescription>
                  Revenue, bookings, and leads trend
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mom.length > 0 ? (
                  <div className="-mx-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className={TH}>Month</TableHead>
                          <TableHead className={cn(TH, "text-right")}>
                            Revenue
                          </TableHead>
                          <TableHead className={cn(TH, "text-right")}>
                            Bookings
                          </TableHead>
                          <TableHead className={cn(TH, "text-right")}>
                            Leads
                          </TableHead>
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
                            <TableRow key={row.month} className="h-11">
                              <TableCell className="font-medium">
                                {row.month}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="numeric flex items-center justify-end gap-1 font-medium">
                                  {formatINR(row.revenue)}
                                  {idx > 0 && revChange !== 0 && (
                                    <span
                                      className={cn(
                                        revChange > 0
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-rose-600 dark:text-rose-400"
                                      )}
                                    >
                                      {revChange > 0 ? (
                                        <ArrowUpIcon className="inline size-3" />
                                      ) : (
                                        <ArrowDownIcon className="inline size-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="numeric text-right">
                                {row.bookings.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="numeric text-right">
                                {row.leads.toLocaleString("en-IN")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUpIcon />}
                    title="Not enough history"
                    description="Month-over-month movement appears after your first full month of activity."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Clients Tab */}
        {/* ============================================================ */}
        <TabsContent value="clients" className="space-y-4">
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

          <Card className={CARD}>
            <CardHeader>
              <CardTitle>Top Clients by Revenue</CardTitle>
              <CardDescription>
                Clients ranked by total amount spent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <div className="-mx-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={cn(TH, "w-10")}>#</TableHead>
                        <TableHead className={TH}>Client Name</TableHead>
                        <TableHead className={cn(TH, "text-right")}>
                          Bookings
                        </TableHead>
                        <TableHead className={cn(TH, "text-right")}>
                          Total Spent
                        </TableHead>
                        <TableHead className={cn(TH, "text-right")}>
                          Avg. per Booking
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topClients.map((client, idx) => (
                        <TableRow key={client.contactId} className="h-11">
                          <TableCell className="numeric text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {client.contactName}
                          </TableCell>
                          <TableCell className="numeric text-right">
                            {client.totalBookings.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="numeric text-right font-medium text-emerald-700 dark:text-emerald-400">
                            {formatINR(client.totalSpent)}
                          </TableCell>
                          <TableCell className="numeric text-right text-muted-foreground">
                            {client.totalBookings > 0
                              ? formatINR(
                                  client.totalSpent / client.totalBookings
                                )
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={<UsersIcon />}
                  title="No client revenue yet"
                  description="Your highest-value clients are ranked here once payments land."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>

          {/* Client Revenue Bar Chart */}
          {topClients.length > 0 && (
            <Card className={CARD}>
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
                  barColor="bg-violet-500"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* Venues Tab */}
        {/* ============================================================ */}
        <TabsContent value="venues" className="space-y-4">
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
          <Card className={CARD}>
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
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
                    {UTILIZATION_COLORS.map((c) => (
                      <div key={c.min} className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", c.dot)} />
                        <span className="numeric">
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
                          className="rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                                {venue.venueName}
                              </p>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                <span className="numeric">
                                  {venue.totalBookings.toLocaleString("en-IN")}
                                </span>{" "}
                                booking{venue.totalBookings !== 1 ? "s" : ""} ·{" "}
                                <span className="numeric">
                                  {venue.bookedDays}
                                </span>{" "}
                                day{venue.bookedDays !== 1 ? "s" : ""} booked
                              </p>
                            </div>
                            <span
                              className={cn(
                                "numeric shrink-0 text-[22px] font-semibold leading-none",
                                color.text
                              )}
                            >
                              {venue.utilizationPercent}%
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width] duration-500 ease-out",
                                color.bar
                              )}
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
                <EmptyState
                  icon={<BuildingIcon />}
                  title="No utilization data"
                  description="Once this month has bookings, each venue's occupancy shows here."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>

          {/* Bookings per Venue */}
          <Card className={CARD}>
            <CardHeader>
              <CardTitle>Bookings per Venue</CardTitle>
              <CardDescription>Ranked by total events held</CardDescription>
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
                  barColor="bg-teal-500"
                />
              ) : (
                <EmptyState
                  icon={<BuildingIcon />}
                  title="No venue bookings"
                  description="Add venues and confirm bookings to see the ranking."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
