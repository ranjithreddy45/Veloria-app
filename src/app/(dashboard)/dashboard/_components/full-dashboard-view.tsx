"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Globe,
  AlertCircle,
  Users,
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DashboardFullData } from "@/actions/dashboard-full.actions";
import { getHallOccupancyForDate, getEventsForDate } from "@/actions/dashboard-full.actions";
import { format, addDays, parseISO } from "date-fns";
import { PageMoreMenuTrigger, QuickActions, type HubActionSpec } from "@/components/ui/quick-actions";
import { StatTile, type StatTileTrend } from "@/components/ui/stat-tile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FullDashboardViewProps {
  data: DashboardFullData;
  /**
   * The hub's shortcut pills, already filtered on the server with
   * visibleActions() (dashboard/page.tsx). Plain data, so it crosses the
   * server/client boundary as is.
   */
  quickActions: readonly HubActionSpec[];
  /** Whether the Open leads tile may link to /leads (leads:read, override-aware). */
  canOpenLeads: boolean;
}

/**
 * A month-over-month change as a tile trend line. The arrow follows the sign,
 * and so does the text ("+12%", "−8%"): the arrow is decorative (aria-hidden),
 * so the words alone must say which way the figure moved.
 */
function changeTrend(changePercent: number): StatTileTrend {
  const tone = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "neutral";
  const sign = changePercent > 0 ? "+" : changePercent < 0 ? "−" : ""; // U+2212 minus sign
  return { text: `${sign}${Math.abs(changePercent)}% vs last month`, tone };
}

// The hub's pill row. Five pills wrap to three rows on a 390px phone, which
// pushes the KPI row far below the greeting (design spec R10: at most two
// rows). So below sm the row shows its first three pills and folds the rest
// into a phone-only More menu (always the row's last item); from sm up every
// pill shows and that menu is hidden. Literal strings: Tailwind only
// generates classes it can read in the source, so the "n+4" in the selector
// is HUB_PHONE_PILLS + 1 written out; change the two together.
const HUB_ROW = "xl:justify-end";
const HUB_ROW_WITH_OVERFLOW =
  "xl:justify-end max-sm:[&>li:nth-child(n+4):not(:last-child)]:hidden sm:[&>li:last-child]:hidden";
/** How many hub pills a phone shows before the rest move into the More menu. */
const HUB_PHONE_PILLS = 3;

/** The phone-only More menu holding the hub pills that don't fit on a phone. */
function HubOverflowMenu({ actions }: { actions: readonly HubActionSpec[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PageMoreMenuTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {actions.map((action) => (
          <DropdownMenuItem key={`${action.href}|${action.label}`} asChild>
            <Link href={action.href}>{action.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The month the cash KPI covers: the current month in IST, which is the window
// getDashboardFullData sums. Derived from the data's own timestamp so the
// server render and the client hydrate agree.
const IST_MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" });

// The KPI tiles keep the dashboard card's own 16px padding at every width
// (StatTile's default steps up to 20px from sm), so a lakh figure fits a tile
// in the five-across row at 1280px.
const KPI_TILE = "sm:p-4";

const FUNNEL_TRAPEZOIDS = [
  { stage: "NEW", path: "M 8 0 L 132 0 Q 136 0 135 4 L 126 21 Q 125 25 121 25 L 19 25 Q 15 25 14 21 L 5 4 Q 4 0 8 0 Z", defaultColor: "#6366f1" },
  { stage: "CONTACTED", path: "M 21 31 L 119 31 Q 123 31 122 35 L 115 52 Q 114 56 110 56 L 30 56 Q 26 56 25 52 L 18 35 Q 17 31 21 31 Z", defaultColor: "#38bdf8" },
  { stage: "QUALIFIED", path: "M 32 62 L 108 62 Q 112 62 111 66 L 105 83 Q 104 87 100 87 L 40 87 Q 36 87 35 83 L 29 66 Q 28 62 32 62 Z", defaultColor: "#a855f7" },
  { stage: "PROPOSAL_SENT", path: "M 42 93 L 98 93 Q 102 93 101 97 L 96 114 Q 95 118 91 118 L 49 118 Q 45 118 44 114 L 39 97 Q 38 93 42 93 Z", defaultColor: "#8b5cf6" },
  { stage: "NEGOTIATION", path: "M 51 124 L 89 124 Q 93 124 92 128 L 88 145 Q 87 149 83 149 L 57 149 Q 53 149 52 145 L 48 128 Q 47 124 51 124 Z", defaultColor: "#f97316" },
  { stage: "WON", path: "M 59 155 L 81 155 Q 85 155 84 159 L 81 176 Q 80 180 76 180 L 64 180 Q 60 180 59 176 L 56 159 Q 55 155 59 155 Z", defaultColor: "#10b981" },
];

const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function formatDateLabel(isoDate: string) {
  const today = getTodayISO();
  const d = parseISO(isoDate);
  const yestDate = format(addDays(new Date(), -1), "yyyy-MM-dd");
  const tomDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

  if (isoDate === today) return "Today";
  if (isoDate === yestDate) return "Yesterday";
  if (isoDate === tomDate) return "Tomorrow";

  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return format(d, "d MMM");
  }
  return format(d, "d MMM yyyy");
}

export function FullDashboardView({ data, quickActions, canOpenLeads }: FullDashboardViewProps) {
  const [timeRange, setTimeRange] = useState("Last 12 Months");
  const [pipelinePeriod, setPipelinePeriod] = useState<"This Month" | "This Quarter" | "This Year" | "All Time">("This Month");
  const [eventTypePeriod, setEventTypePeriod] = useState<"This Month" | "This Quarter" | "This Year" | "All Time">("This Month");

  // Dynamic Date States for Hall Occupancy & Events
  const [occupancyDate, setOccupancyDate] = useState(getTodayISO());
  const [occupancyList, setOccupancyList] = useState(data.hallOccupancy);
  const [isOccupancyLoading, setIsOccupancyLoading] = useState(false);

  const [eventsDate, setEventsDate] = useState(getTodayISO());
  const [eventsList, setEventsList] = useState(data.todaysEvents);
  const [isEventsLoading, setIsEventsLoading] = useState(false);

  const handleOccupancyDateChange = async (newDateISO: string) => {
    setOccupancyDate(newDateISO);
    setIsOccupancyLoading(true);
    try {
      const res = await getHallOccupancyForDate(newDateISO);
      if (res.success && res.data) {
        setOccupancyList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch occupancy for date:", err);
    } finally {
      setIsOccupancyLoading(false);
    }
  };

  const handlePrevOccupancyDate = () => {
    const current = parseISO(occupancyDate);
    const prev = addDays(current, -1);
    handleOccupancyDateChange(format(prev, "yyyy-MM-dd"));
  };

  const handleNextOccupancyDate = () => {
    const current = parseISO(occupancyDate);
    const next = addDays(current, 1);
    handleOccupancyDateChange(format(next, "yyyy-MM-dd"));
  };

  const handleEventsDateChange = async (newDateISO: string) => {
    setEventsDate(newDateISO);
    setIsEventsLoading(true);
    try {
      const res = await getEventsForDate(newDateISO);
      if (res.success && res.data) {
        setEventsList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch events for date:", err);
    } finally {
      setIsEventsLoading(false);
    }
  };

  const handlePrevEventsDate = () => {
    const current = parseISO(eventsDate);
    const prev = addDays(current, -1);
    handleEventsDateChange(format(prev, "yyyy-MM-dd"));
  };

  const handleNextEventsDate = () => {
    const current = parseISO(eventsDate);
    const next = addDays(current, 1);
    handleEventsDateChange(format(next, "yyyy-MM-dd"));
  };


  const activeLeadPipeline = React.useMemo(() => {
    return data.leadPipeline?.[pipelinePeriod] || data.leadPipeline?.["This Month"] || { total: 0, stages: [] };
  }, [data.leadPipeline, pipelinePeriod]);

  const activeBookingsByType = React.useMemo(() => {
    return data.bookingsByType?.[eventTypePeriod] || data.bookingsByType?.["This Month"] || { total: 0, types: [] };
  }, [data.bookingsByType, eventTypePeriod]);

  const chartData = React.useMemo(() => {
    if (timeRange === "Last 6 Months") {
      return data.revenueTrend.slice(-6);
    }
    if (timeRange === "This Year") {
      const currentYear = new Date().getFullYear().toString();
      const filtered = data.revenueTrend.filter((item) => item.monthKey.startsWith(currentYear));
      return filtered.length > 0 ? filtered : data.revenueTrend;
    }
    return data.revenueTrend;
  }, [data.revenueTrend, timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formattedKpiCurrency = (amount: number) => {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  };

  const openLeadsTile = (
    <StatTile
      label="Open leads"
      value={data.kpis.openLeads.count}
      accent="blue"
      icon={<Users className="size-4" />}
      trend={{
        text:
          data.kpis.openLeads.breachedCount === 0
            ? "None past response deadline"
            : `${data.kpis.openLeads.breachedCount} past deadline`,
        tone: "neutral",
      }}
      className="h-full sm:p-4"
    />
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {/* ============================================================ */}
      {/* 1. HEADER BAR: Greeting + the hub's shortcut pills */}
      {/* ============================================================ */}
      {/* No overflow clipping here: the pill cluster wraps onto a second row
          when it doesn't fit beside the greeting, and every pill's focus ring
          stays whole. */}
      <header className="flex flex-col gap-4 pb-1 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5 shrink-0">
          <p className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {data.todayFormatted}
          </p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl sm:whitespace-nowrap">
            Good afternoon, {data.user.name.split(" ")[0]}.
          </h1>
          <p className="text-xs text-muted-foreground sm:whitespace-nowrap">
            Here&apos;s what&apos;s happening across your venues today.
          </p>
        </div>

        {/* The shared action cluster (src/components/ui/quick-actions.tsx) in
            hub mode: the dashboard is not a module landing, so it keeps its
            five shortcuts. Order, labels and permissions come from page.tsx;
            each pill's chip is its destination's module chip. On a phone the
            pills past the third move into a More menu (HUB_ROW_WITH_OVERFLOW). */}
        {quickActions.length > HUB_PHONE_PILLS ? (
          <QuickActions
            hub
            actions={quickActions}
            more={<HubOverflowMenu actions={quickActions.slice(HUB_PHONE_PILLS)} />}
            className={HUB_ROW_WITH_OVERFLOW}
          />
        ) : (
          <QuickActions hub actions={quickActions} className={HUB_ROW} />
        )}
      </header>

      {/* ============================================================ */}
      {/* 2. TOP METRICS BAND: 5 KPI tiles in a row (the shared StatTile) */}
      {/* ============================================================ */}
      {/* Five across only from xl: below that a tile is too narrow for a lakh
          figure (₹12,45,000) and the value would wrap mid-number. */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label={`Cash collected · ${IST_MONTH.format(new Date(data.asOf))}`}
          value={formattedKpiCurrency(data.kpis.cashCollected.amount)}
          accent="emerald"
          icon={<Wallet className="size-4" />}
          trend={changeTrend(data.kpis.cashCollected.changePercent)}
          className={KPI_TILE}
        />

        <StatTile
          label="Booked value · this month"
          value={formattedKpiCurrency(data.kpis.bookedValue.amount)}
          accent="brand"
          icon={<Globe className="size-4" />}
          trend={changeTrend(data.kpis.bookedValue.changePercent)}
          className={KPI_TILE}
        />

        <StatTile
          label="Overdue"
          value={formattedKpiCurrency(data.kpis.overdue.amount)}
          accent="rose"
          icon={<AlertCircle className="size-4" />}
          trend={{
            text: `${data.kpis.overdue.count} ${data.kpis.overdue.count === 1 ? "invoice" : "invoices"} overdue`,
            tone: "neutral",
          }}
          className={KPI_TILE}
        />

        {/* The whole tile opens the leads list, for anyone who can open it. */}
        {canOpenLeads ? (
          <Link href="/leads" className="block rounded-[22px]">
            {openLeadsTile}
          </Link>
        ) : (
          openLeadsTile
        )}

        <StatTile
          label="Events this week"
          value={data.kpis.eventsThisWeek.total}
          accent="indigo"
          icon={<CalendarCheck className="size-4" />}
          trend={{
            text: `${data.kpis.eventsThisWeek.todayCount} today · ${data.kpis.eventsThisWeek.upcomingCount} upcoming`,
            tone: "neutral",
          }}
          className={KPI_TILE}
        />
      </section>

      {/* ============================================================ */}
      {/* 3. MIDDLE ANALYTICS BAND: Revenue Trend | Lead Pipeline | Bookings Type */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Card 1: Revenue Trend (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Revenue Trend</h2>

            <div className="relative shrink-0">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="no-ring appearance-none rounded-xl border border-border bg-background/80 pl-2 pr-6 py-1 text-meta font-medium text-foreground outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer shadow-sm hover:bg-muted/90 transition-colors whitespace-nowrap"
              >
                <option value="Last 12 Months" className="bg-background text-foreground">Last 12 Months</option>
                <option value="This Year" className="bg-background text-foreground">This Year</option>
                <option value="Last 6 Months" className="bg-background text-foreground">Last 6 Months</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            </div>
          </div>

          <div className="h-72 sm:h-[305px] w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="bookedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff" strokeOpacity={0.06} vertical={true} horizontal={true} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={4} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val === 0 ? "0" : `₹${Math.round(val / 100000)}L`)}
                />
                <Tooltip
                  cursor={{ stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as { month: string; monthKey: string; booked: number; collected: number };
                      const y = item.monthKey ? item.monthKey.split("-")[0] : new Date().getFullYear().toString();
                      const formattedMonthYear = `${item.month} ${y}`;
                      return (
                        <div className="rounded-xl border border-border bg-card/95 p-3.5 text-xs text-foreground shadow-2xl backdrop-blur-md min-w-[170px]">
                          <p className="font-semibold text-muted-foreground mb-2 border-b border-border pb-1.5">{formattedMonthYear}</p>
                          <div className="flex items-center justify-between gap-5 py-1">
                            <span className="flex items-center gap-2 text-muted-foreground font-medium">
                              <span className="size-2.5 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/50" />
                              Booked
                            </span>
                            <span className="font-bold text-foreground font-mono">
                              {formattedKpiCurrency(item.booked)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-5 py-1">
                            <span className="flex items-center gap-2 text-muted-foreground font-medium">
                              <span className="size-2.5 rounded-full bg-[#a855f7] shadow-sm shadow-purple-500/50" />
                              Collected
                            </span>
                            <span className="font-bold text-foreground font-mono">
                              {formattedKpiCurrency(item.collected)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="booked"
                  name="Booked Value"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#bookedGrad)"
                  dot={{ r: 3.5, fill: "#10b981", stroke: "#090d16", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Cash Collected"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#collectedGrad)"
                  dot={{ r: 3.5, fill: "#a855f7", stroke: "#090d16", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "#a855f7", stroke: "#ffffff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Legend */}
          <div className="mt-1 flex items-center justify-center gap-5 text-meta font-medium pt-1 border-t border-border/50">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/50 shrink-0" />
              Booked Value
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-[#a855f7] shadow-sm shadow-purple-500/50 shrink-0" />
              Cash Collected
            </span>
          </div>
        </div>

        {/* Card 2: Lead Pipeline (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-foreground">Lead Pipeline</h2>
            <div className="relative">
              <select
                value={pipelinePeriod}
                onChange={(e) => setPipelinePeriod(e.target.value as any)}
                className="no-ring appearance-none rounded-xl border border-border bg-background/80 pl-3 pr-7 py-1 text-xs font-medium text-foreground outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer shadow-sm hover:bg-muted/90 transition-colors"
              >
                <option value="This Month" className="bg-background text-foreground">This Month</option>
                <option value="This Quarter" className="bg-background text-foreground">This Quarter</option>
                <option value="This Year" className="bg-background text-foreground">This Year</option>
                <option value="All Time" className="bg-background text-foreground">All Time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 my-auto py-2">
            {/* Left Side: Tapered 3D Funnel Graphic */}
            <div className="relative w-32 sm:w-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 140 186" className="w-full h-auto max-h-[240px] overflow-visible">
                <defs>
                  <filter id="funnelShadow" x="-20%" y="-10%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
                  </filter>
                </defs>
                {FUNNEL_TRAPEZOIDS.map((trap, idx) => {
                  const stg = activeLeadPipeline.stages[idx];
                  const color = stg?.color || trap.defaultColor;
                  return (
                    <path
                      key={trap.stage}
                      d={trap.path}
                      fill={color}
                      filter="url(#funnelShadow)"
                      className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                    >
                      <title>{`${stg?.label || trap.stage}: ${stg?.count || 0} (${stg?.percentage || 0}%)`}</title>
                    </path>
                  );
                })}
              </svg>
            </div>

            {/* Right Side: Stage Rows */}
            <div className="flex flex-col justify-between h-[230px] w-full min-w-0 pl-2">
              {activeLeadPipeline.stages.map((stg) => (
                <div key={stg.stage} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="flex-1 min-w-0 font-medium text-muted-foreground text-xs sm:text-sm truncate">
                    {stg.label}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-bold text-foreground text-xs sm:text-sm text-right font-mono min-w-[28px]">
                      {stg.count}
                    </span>
                    <span className="font-medium text-muted-foreground text-xs text-right font-mono min-w-[36px]">
                      {stg.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Bookings by Event Type (3 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-bold text-foreground">Bookings by Event Type</h2>
            <div className="relative">
              <select
                value={eventTypePeriod}
                onChange={(e) => setEventTypePeriod(e.target.value as any)}
                className="no-ring appearance-none rounded-xl border border-border bg-background/80 pl-3 pr-7 py-1 text-xs font-medium text-muted-foreground outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer"
              >
                <option value="This Month" className="bg-background text-foreground">This Month</option>
                <option value="This Quarter" className="bg-background text-foreground">This Quarter</option>
                <option value="This Year" className="bg-background text-foreground">This Year</option>
                <option value="All Time" className="bg-background text-foreground">All Time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center my-auto w-full">
            {/* Donut Chart on Top */}
            <div className="relative size-40 shrink-0 my-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeBookingsByType.types}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={66}
                    paddingAngle={3}
                  >
                    {activeBookingsByType.types.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-bold text-foreground font-mono">{activeBookingsByType.total}</span>
                <span className="text-meta text-muted-foreground font-medium">Total Bookings</span>
              </div>
            </div>

            {/* Legend List Below Chart */}
            <div className="flex flex-col gap-1 w-full mt-2 max-h-48 overflow-y-auto pr-1">
              {activeBookingsByType.types.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium text-xs truncate min-w-0">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.fill }} />
                    {t.type}
                  </span>
                  <span className="font-semibold text-foreground text-xs whitespace-nowrap shrink-0 font-mono ml-2">
                    {t.count} <span className="text-meta text-muted-foreground font-normal">({t.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. LOWER MIDDLE BAND: Needs You Now | Today's Events | Hall Occupancy */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Needs You Now (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Needs You Now</h2>
              <span className="flex items-center gap-1 text-meta font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ring-1 ring-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <Link
              href="/my-work"
              className="text-detail font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.attentionItems.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2.5 mt-1">
            {data.attentionItems.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No urgent attention items right now 🎉</p>
            ) : (
              data.attentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-border/50 bg-muted/40 dark:bg-muted/30 p-2.5 transition-all hover:bg-muted/60 dark:hover:bg-muted/50 shrink-0 w-full"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-meta font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${item.badge === "URGENT"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                      >
                        {item.badge}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate min-w-0 flex-1">{item.title}</span>
                    </div>
                    <span className="text-meta text-muted-foreground truncate min-w-0">{item.subtitle}</span>
                  </div>

                  <Link
                    href={item.actionHref}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Events (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-foreground shrink-0">Events</h2>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/80 px-2.5 py-1 rounded-full border border-border hover:border-purple-500/40 transition-colors shadow-sm shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  onClick={handlePrevEventsDate}
                  className="no-ring outline-none hover:text-foreground p-0.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10 cursor-pointer"
                  title="Previous day"
                >
                  <ChevronLeft className="size-3.5" />
                </button>

                <div className="relative flex items-center px-1 font-semibold text-foreground whitespace-nowrap">
                  <span className="whitespace-nowrap">{formatDateLabel(eventsDate)}</span>
                  <input
                    type="date"
                    value={eventsDate}
                    onChange={(e) => e.target.value && handleEventsDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20 outline-none no-ring"
                    title="Choose date"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextEventsDate}
                  className="no-ring outline-none hover:text-foreground p-0.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10 cursor-pointer"
                  title="Next day"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              <Link
                href="/calendar"
                className="text-detail font-semibold text-purple-400 hover:text-purple-300 transition-colors shrink-0 whitespace-nowrap"
              >
                View all
              </Link>
            </div>
          </div>

          <div className={`custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2.5 mt-1 ${isEventsLoading ? "opacity-40 transition-opacity" : ""}`}>
            {eventsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No events scheduled for {formatDateLabel(eventsDate)}</p>
            ) : (
              eventsList.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-border/50 bg-muted/40 dark:bg-muted/30 p-2.5 shrink-0 w-full hover:bg-muted/60 dark:hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-emerald-400 shrink-0">{evt.formattedTime}</span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-foreground truncate min-w-0">{evt.eventName}</span>
                      <span className="text-meta text-muted-foreground truncate min-w-0">{evt.hall}</span>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-meta font-semibold px-2 py-0.5 rounded-full border ${evt.statusTone === "success"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : evt.statusTone === "info"
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                  >
                    {evt.statusBadgeText}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hall Occupancy (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-foreground shrink-0">Hall Occupancy</h2>
            <div className="relative flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/80 px-2.5 py-1 rounded-full border border-border hover:border-purple-500/40 transition-colors shadow-sm shrink-0 whitespace-nowrap">
              <button
                type="button"
                onClick={handlePrevOccupancyDate}
                className="no-ring outline-none hover:text-foreground p-0.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10 cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              <div className="relative flex items-center px-1 font-semibold text-foreground whitespace-nowrap">
                <span className="whitespace-nowrap">{formatDateLabel(occupancyDate)}</span>
                <input
                  type="date"
                  value={occupancyDate}
                  onChange={(e) => e.target.value && handleOccupancyDateChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20 outline-none no-ring"
                  title="Choose date"
                />
              </div>

              <button
                type="button"
                onClick={handleNextOccupancyDate}
                className="no-ring outline-none hover:text-foreground p-0.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10 cursor-pointer"
                title="Next day"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 w-full mt-1">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border text-meta font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Hall</th>
                  <th className="py-2 px-1">Morning</th>
                  <th className="py-2 px-1">Evening</th>
                  <th className="py-2 pl-1">Full Day</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-white/5 ${isOccupancyLoading ? "opacity-40 transition-opacity" : ""}`}>
                {occupancyList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No active venues found
                    </td>
                  </tr>
                ) : (
                  occupancyList.map((h) => (
                    <tr key={h.venueId} className="hover:bg-muted/30">
                      <td className="py-2.5 pr-2 font-medium text-foreground truncate max-w-[100px]">{h.venueName}</td>
                      <td className="py-2.5 px-1">
                        <span
                          className={`inline-block px-1.5 py-1 rounded-lg text-meta font-medium border ${h.morning.status === "FREE"
                            ? "bg-muted/50 text-muted-foreground border-border/50"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold shadow-sm"
                            }`}
                          title={h.morning.label || undefined}
                        >
                          {h.morning.status === "FREE" ? "Available" : "Booked"}
                        </span>
                      </td>
                      <td className="py-2.5 px-1">
                        <span
                          className={`inline-block px-1.5 py-1 rounded-lg text-meta font-medium border ${h.evening.status === "FREE"
                            ? "bg-muted/50 text-muted-foreground border-border/50"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold shadow-sm"
                            }`}
                          title={h.evening.label || undefined}
                        >
                          {h.evening.status === "FREE" ? "Available" : "Booked"}
                        </span>
                      </td>
                      <td className="py-2.5 pl-1">
                        <span
                          className={`inline-block px-1.5 py-1 rounded-lg text-meta font-medium border ${h.fullDay.status === "FREE"
                            ? "bg-muted/50 text-muted-foreground border-border/50"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold shadow-sm"
                            }`}
                          title={h.fullDay.label || undefined}
                        >
                          {h.fullDay.status === "FREE" ? "Available" : "Booked"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </section>

      {/* ============================================================ */}
      {/* 5. BOTTOM BAND: Team Performance (Velos) | Overdue Invoices | Pending Payment Proofs */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Card 1: Team Performance Velos (5 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[200px] lg:col-span-5">
          <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
            <h2 className="text-base font-bold text-foreground">Team Performance (Velos)</h2>
            <Link
              href="/performance/velos"
              className="text-detail font-semibold text-purple-400 hover:text-purple-300 transition-colors shrink-0"
            >
              View leaderboard
            </Link>
          </div>

          <div className="flex-1 min-h-0 flex items-center w-full overflow-hidden">
            {data.velosLeaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground mx-auto">No leaderboard activity yet</p>
            ) : (
              (() => {
                const winner = data.velosLeaderboard[0];
                const others = data.velosLeaderboard.slice(1, 5);
                return (
                  <div className="flex items-center gap-4 w-full">
                    {/* Left Side: #1 Featured Leader */}
                    {winner && (
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Avatar with gold ring */}
                        <div className="relative shrink-0">
                          <div className="size-14 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 p-[2.5px] shadow-lg shadow-amber-500/40">
                            {winner.image ? (
                              <img src={winner.image} alt={winner.name} className="size-full rounded-full object-cover" />
                            ) : (
                              <div className="size-full rounded-full bg-background flex items-center justify-center text-sm font-black text-amber-300 uppercase">
                                {winner.name.substring(0, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-meta font-extrabold text-amber-400 tracking-wider leading-none">#1</span>
                          <span className="text-sm font-bold text-foreground leading-tight whitespace-nowrap">{winner.name}</span>
                          <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1 font-mono whitespace-nowrap">
                            {winner.points.toLocaleString("en-IN")} pts
                            <TrendingUp className="size-3.5 text-emerald-400 shrink-0" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="h-14 w-px bg-border shrink-0" />

                    {/* Right Side: Ranks #2 to #5 — equal flex columns */}
                    <div className="flex flex-1 items-center justify-around gap-2 min-w-0">
                      {others.map((user) => {
                        const badgeColors =
                          user.rank === 2
                            ? "bg-blue-600 text-white"
                            : user.rank === 3
                              ? "bg-amber-700 text-amber-100"
                              : "bg-slate-700 text-white";

                        return (
                          <div key={user.userId} className="flex flex-col items-center text-center gap-1 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className="size-11 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shadow-md">
                                {user.image ? (
                                  <img src={user.image} alt={user.name} className="size-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-foreground uppercase">
                                    {user.name.substring(0, 2)}
                                  </span>
                                )}
                              </div>
                              {/* Rank badge — bottom-left of avatar */}
                              <span className={`absolute -bottom-1 -left-0.5 flex items-center justify-center text-meta leading-none font-extrabold min-w-5 h-4 px-1 rounded-full shadow ${badgeColors}`}>
                                #{user.rank}
                              </span>
                            </div>
                            {/* Name */}
                            <span className="text-meta font-semibold text-foreground whitespace-nowrap">
                              {user.name.split(" ")[0]}
                            </span>
                            {/* Points */}
                            <span className="text-meta tracking-normal font-bold text-muted-foreground font-mono whitespace-nowrap">
                              {user.points.toLocaleString("en-IN")} pts
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Card 2: Receivables & Overdue Invoices (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[200px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-foreground">Receivables & Overdue Invoices</h2>
            <Link
              href="/invoices"
              className="text-detail font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.overdueInvoices.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2 mt-1">
            {data.overdueInvoices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No overdue invoices 👍</p>
            ) : (
              data.overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/50 last:border-0 shrink-0 w-full">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-bold text-foreground shrink-0">{formatCurrency(inv.balanceDue)}</span>
                    <span className="text-muted-foreground truncate min-w-0 flex-1">{inv.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-meta text-muted-foreground whitespace-nowrap">Due {inv.dueDateFormatted}</span>
                    <span className="px-2 py-0.5 rounded-full text-meta font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                      Overdue
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Pending Payment Proofs (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 h-[200px] lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-foreground">Pending Payment Proofs</h2>
            <Link
              href="/payments"
              className="text-detail font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.pendingPaymentProofs.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2 mt-1">
            {data.pendingPaymentProofs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">All payment proofs verified 👍</p>
            ) : (
              data.pendingPaymentProofs.map((proof) => (
                <div key={proof.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/50 last:border-0 shrink-0 w-full">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-bold text-foreground truncate min-w-0">{proof.clientName}</span>
                    <span className="text-meta text-muted-foreground truncate min-w-0">{proof.uploadedAgo}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(proof.amount)}</span>
                    <Link
                      href="/payments"
                      className="rounded-xl bg-rose-600/80 hover:bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow transition-all whitespace-nowrap"
                    >
                      Verify
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
