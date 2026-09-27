"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  CreditCard,
  Calendar,
  BookmarkCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Globe,
  AlertCircle,
  Users,
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Clock,
  CheckCircle2,
  UtensilsCrossed,
  Award,
  ArrowUpRight,
  ExternalLink,
  ShieldAlert,
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

interface FullDashboardViewProps {
  data: DashboardFullData;
}

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

export function FullDashboardView({ data }: FullDashboardViewProps) {
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

  return (
    <div className="flex w-full flex-col gap-6">
      {/* ============================================================ */}
      {/* 1. HEADER BAR: Greeting + Quick Action Buttons */}
      {/* ============================================================ */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between overflow-x-auto pb-1">
        <div className="flex flex-col gap-0.5 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {data.todayFormatted}
          </p>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl whitespace-nowrap">
            Good afternoon, {data.user.name.split(" ")[0]}.
          </h1>
          <p className="text-xs text-slate-400 whitespace-nowrap">
            Here&apos;s what&apos;s happening across your venues today.
          </p>
        </div>

        {/* 5 Quick Action Pill Buttons in One Single Row */}
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap py-1">
          {/* New Lead */}
          <Link
            href="/leads/new"
            className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-material-sidebar px-3 py-1.5 text-xs transition-all hover:border-emerald-500/40 hover:brightness-110 active:scale-95"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Plus className="size-4" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col text-left">
              <span className="leading-tight font-semibold text-white">New Lead</span>
              <span className="text-[10px] font-normal text-slate-400">Add a new inquiry</span>
            </div>
          </Link>

          {/* Create Quotation */}
          <Link
            href="/quotations/new"
            className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-material-sidebar px-3 py-1.5 text-xs transition-all hover:border-indigo-500/40 hover:brightness-110 active:scale-95"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20">
              <FileText className="size-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col text-left">
              <span className="leading-tight font-semibold text-white">Create Quotation</span>
              <span className="text-[10px] font-normal text-slate-400">Generate proposal</span>
            </div>
          </Link>

          {/* Record Payment */}
          <Link
            href="/payments"
            className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-material-sidebar px-3 py-1.5 text-xs transition-all hover:border-cyan-500/40 hover:brightness-110 active:scale-95"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20">
              <CreditCard className="size-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col text-left">
              <span className="leading-tight font-semibold text-white">Record Payment</span>
              <span className="text-[10px] font-normal text-slate-400">Add client payment</span>
            </div>
          </Link>

          {/* Schedule Visit */}
          <Link
            href="/site-visits"
            className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-material-sidebar px-3 py-1.5 text-xs transition-all hover:border-amber-500/40 hover:brightness-110 active:scale-95"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <Calendar className="size-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col text-left">
              <span className="leading-tight font-semibold text-white">Schedule Visit</span>
              <span className="text-[10px] font-normal text-slate-400">Site visit / tasting</span>
            </div>
          </Link>

          {/* New Booking Hold */}
          <Link
            href="/availability"
            className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-material-sidebar px-3 py-1.5 text-xs transition-all hover:border-pink-500/40 hover:brightness-110 active:scale-95"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pink-500 text-white font-bold shadow-md shadow-pink-500/20">
              <BookmarkCheck className="size-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col text-left">
              <span className="leading-tight font-semibold text-white">New Booking Hold</span>
              <span className="text-[10px] font-normal text-slate-400">Block a venue slot</span>
            </div>
          </Link>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. TOP METRICS BAND: 5 Cards in a Row */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Cash Collected */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-4 transition-all hover:border-emerald-500/30 hover:brightness-110">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              Cash Collected · September
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {formattedKpiCurrency(data.kpis.cashCollected.amount)}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp className="size-3.5" />
              <span>↑ {data.kpis.cashCollected.changePercent}% vs last month</span>
            </span>
          </div>
        </div>

        {/* Card 2: Booked Value */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-4 transition-all hover:border-purple-500/30 hover:brightness-110">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              Booked Value · This Month
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Globe className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {formattedKpiCurrency(data.kpis.bookedValue.amount)}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-purple-400">
              <TrendingUp className="size-3.5" />
              <span>↑ {data.kpis.bookedValue.changePercent}% vs last month</span>
            </span>
          </div>
        </div>

        {/* Card 3: Overdue */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-4 transition-all hover:border-rose-500/30 hover:brightness-110">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              Overdue
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {formattedKpiCurrency(data.kpis.overdue.amount)}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-400">
              <TrendingUp className="size-3.5" />
              <span>↑ {data.kpis.overdue.count} invoices overdue</span>
            </span>
          </div>
        </div>

        {/* Card 4: Open Leads */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-4 transition-all hover:border-blue-500/30 hover:brightness-110">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              Open Leads
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {data.kpis.openLeads.count}
            </span>
            <Link
              href="/leads"
              className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-blue-400 transition-colors truncate"
            >
              <span>
                {data.kpis.openLeads.breachedCount === 0
                  ? "None past response deadline"
                  : `${data.kpis.openLeads.breachedCount} past deadline`}
              </span>
              <ChevronRight className="size-3.5 shrink-0" />
            </Link>
          </div>
        </div>

        {/* Card 5: Events This Week */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-4 transition-all hover:border-indigo-500/30 hover:brightness-110">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              Events This Week
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <CalendarCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {data.kpis.eventsThisWeek.total}
            </span>
            <span className="mt-1 text-[11px] font-medium text-slate-400 truncate">
              {data.kpis.eventsThisWeek.todayCount} today · {data.kpis.eventsThisWeek.upcomingCount} upcoming
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. MIDDLE ANALYTICS BAND: Revenue Trend | Lead Pipeline | Bookings Type */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Card 1: Revenue Trend (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Revenue Trend</h2>

            <div className="relative shrink-0">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="no-ring appearance-none rounded-xl border border-white/10 bg-slate-900/80 pl-2 pr-6 py-1 text-[11px] font-medium text-slate-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer shadow-sm hover:bg-slate-800/90 transition-colors whitespace-nowrap"
              >
                <option value="Last 12 Months" className="bg-slate-900 text-white">Last 12 Months</option>
                <option value="This Year" className="bg-slate-900 text-white">This Year</option>
                <option value="Last 6 Months" className="bg-slate-900 text-white">Last 6 Months</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
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
                  fontSize={10}
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
                        <div className="rounded-xl border border-white/10 bg-[#0d131f]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md min-w-[170px]">
                          <p className="font-semibold text-slate-300 mb-2 border-b border-white/10 pb-1.5">{formattedMonthYear}</p>
                          <div className="flex items-center justify-between gap-5 py-1">
                            <span className="flex items-center gap-2 text-slate-300 font-medium">
                              <span className="size-2.5 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/50" />
                              Booked
                            </span>
                            <span className="font-bold text-white font-mono">
                              {formattedKpiCurrency(item.booked)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-5 py-1">
                            <span className="flex items-center gap-2 text-slate-300 font-medium">
                              <span className="size-2.5 rounded-full bg-[#a855f7] shadow-sm shadow-purple-500/50" />
                              Collected
                            </span>
                            <span className="font-bold text-white font-mono">
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
          <div className="mt-1 flex items-center justify-center gap-5 text-[11px] font-medium pt-1 border-t border-white/5">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="size-2 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/50 shrink-0" />
              Booked Value
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="size-2 rounded-full bg-[#a855f7] shadow-sm shadow-purple-500/50 shrink-0" />
              Cash Collected
            </span>
          </div>
        </div>

        {/* Card 2: Lead Pipeline (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-5 lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-white">Lead Pipeline</h2>
            <div className="relative">
              <select
                value={pipelinePeriod}
                onChange={(e) => setPipelinePeriod(e.target.value as any)}
                className="no-ring appearance-none rounded-xl border border-white/10 bg-slate-900/80 pl-3 pr-7 py-1 text-xs font-medium text-slate-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer shadow-sm hover:bg-slate-800/90 transition-colors"
              >
                <option value="This Month" className="bg-slate-900 text-white">This Month</option>
                <option value="This Quarter" className="bg-slate-900 text-white">This Quarter</option>
                <option value="This Year" className="bg-slate-900 text-white">This Year</option>
                <option value="All Time" className="bg-slate-900 text-white">All Time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
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
                  <span className="flex-1 min-w-0 font-medium text-slate-300 text-xs sm:text-sm truncate">
                    {stg.label}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-bold text-white text-xs sm:text-sm text-right font-mono min-w-[28px]">
                      {stg.count}
                    </span>
                    <span className="font-medium text-slate-400 text-xs text-right font-mono min-w-[36px]">
                      {stg.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Bookings by Event Type (3 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-material-sidebar p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-bold text-white">Bookings by Event Type</h2>
            <div className="relative">
              <select
                value={eventTypePeriod}
                onChange={(e) => setEventTypePeriod(e.target.value as any)}
                className="no-ring appearance-none rounded-xl border border-white/10 bg-slate-900/80 pl-3 pr-7 py-1 text-xs font-medium text-slate-300 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 cursor-pointer"
              >
                <option value="This Month" className="bg-slate-900 text-white">This Month</option>
                <option value="This Quarter" className="bg-slate-900 text-white">This Quarter</option>
                <option value="This Year" className="bg-slate-900 text-white">This Year</option>
                <option value="All Time" className="bg-slate-900 text-white">All Time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
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
                <span className="text-xl font-bold text-white font-mono">{activeBookingsByType.total}</span>
                <span className="text-[10px] text-slate-400 font-medium">Total Bookings</span>
              </div>
            </div>

            {/* Legend List Below Chart */}
            <div className="flex flex-col gap-1 w-full mt-2 max-h-48 overflow-y-auto pr-1">
              {activeBookingsByType.types.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                  <span className="flex items-center gap-2 text-slate-300 font-medium text-xs truncate min-w-0">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.fill }} />
                    {t.type}
                  </span>
                  <span className="font-semibold text-white text-xs whitespace-nowrap shrink-0 font-mono ml-2">
                    {t.count} <span className="text-[10px] text-slate-400 font-normal">({t.percentage}%)</span>
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
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Needs You Now</h2>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ring-1 ring-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <Link
              href="/my-work"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.attentionItems.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2.5 mt-1">
            {data.attentionItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No urgent attention items right now 🎉</p>
            ) : (
              data.attentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-slate-800/40 p-2.5 transition-all hover:bg-slate-800/70 shrink-0 w-full"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${item.badge === "URGENT"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                      >
                        {item.badge}
                      </span>
                      <span className="text-xs font-medium text-white truncate min-w-0 flex-1">{item.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate min-w-0">{item.subtitle}</span>
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
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-white shrink-0">Events</h2>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded-full border border-white/10 hover:border-purple-500/40 transition-colors shadow-sm shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  onClick={handlePrevEventsDate}
                  className="no-ring outline-none hover:text-white p-0.5 rounded-full hover:bg-white/10 text-slate-300 transition-colors z-10 cursor-pointer"
                  title="Previous day"
                >
                  <ChevronLeft className="size-3.5" />
                </button>

                <div className="relative flex items-center px-1 font-semibold text-slate-200 whitespace-nowrap">
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
                  className="no-ring outline-none hover:text-white p-0.5 rounded-full hover:bg-white/10 text-slate-300 transition-colors z-10 cursor-pointer"
                  title="Next day"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              <Link
                href="/calendar"
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors shrink-0 whitespace-nowrap"
              >
                View all
              </Link>
            </div>
          </div>

          <div className={`custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2.5 mt-1 ${isEventsLoading ? "opacity-40 transition-opacity" : ""}`}>
            {eventsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No events scheduled for {formatDateLabel(eventsDate)}</p>
            ) : (
              eventsList.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-slate-800/40 p-2.5 shrink-0 w-full hover:bg-slate-800/70 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-emerald-400 shrink-0">{evt.formattedTime}</span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate min-w-0">{evt.eventName}</span>
                      <span className="text-[11px] text-slate-400 truncate min-w-0">{evt.hall}</span>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${evt.statusTone === "success"
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
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[380px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-white shrink-0">Hall Occupancy</h2>
            <div className="relative flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded-full border border-white/10 hover:border-purple-500/40 transition-colors shadow-sm shrink-0 whitespace-nowrap">
              <button
                type="button"
                onClick={handlePrevOccupancyDate}
                className="no-ring outline-none hover:text-white p-0.5 rounded-full hover:bg-white/10 text-slate-300 transition-colors z-10 cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              <div className="relative flex items-center px-1 font-semibold text-slate-200 whitespace-nowrap">
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
                className="no-ring outline-none hover:text-white p-0.5 rounded-full hover:bg-white/10 text-slate-300 transition-colors z-10 cursor-pointer"
                title="Next day"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 w-full mt-1">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-2">Hall</th>
                  <th className="py-2 px-1">Morning</th>
                  <th className="py-2 px-1">Evening</th>
                  <th className="py-2 pl-1">Full Day</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-white/5 ${isOccupancyLoading ? "opacity-40 transition-opacity" : ""}`}>
                {occupancyList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No active venues found
                    </td>
                  </tr>
                ) : (
                  occupancyList.map((h) => (
                    <tr key={h.venueId} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-2 font-medium text-white truncate max-w-[100px]">{h.venueName}</td>
                      <td className="py-2.5 px-1">
                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-[10px] font-medium border ${h.morning.status === "FREE"
                            ? "bg-slate-800/50 text-slate-400 border-white/5"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold shadow-sm"
                            }`}
                          title={h.morning.label || undefined}
                        >
                          {h.morning.status === "FREE" ? "Available" : "Booked"}
                        </span>
                      </td>
                      <td className="py-2.5 px-1">
                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-[10px] font-medium border ${h.evening.status === "FREE"
                            ? "bg-slate-800/50 text-slate-400 border-white/5"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold shadow-sm"
                            }`}
                          title={h.evening.label || undefined}
                        >
                          {h.evening.status === "FREE" ? "Available" : "Booked"}
                        </span>
                      </td>
                      <td className="py-2.5 pl-1">
                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-[10px] font-medium border ${h.fullDay.status === "FREE"
                            ? "bg-slate-800/50 text-slate-400 border-white/5"
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
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[200px] lg:col-span-5">
          <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
            <h2 className="text-base font-bold text-white">Team Performance (Velos)</h2>
            <Link
              href="/performance/velos"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors shrink-0"
            >
              View leaderboard
            </Link>
          </div>

          <div className="flex-1 min-h-0 flex items-center w-full overflow-hidden">
            {data.velosLeaderboard.length === 0 ? (
              <p className="text-xs text-slate-400 mx-auto">No leaderboard activity yet</p>
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
                              <div className="size-full rounded-full bg-slate-900 flex items-center justify-center text-sm font-black text-amber-300 uppercase">
                                {winner.name.substring(0, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-extrabold text-amber-400 tracking-wider leading-none">#1</span>
                          <span className="text-sm font-bold text-white leading-tight whitespace-nowrap">{winner.name}</span>
                          <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1 font-mono whitespace-nowrap">
                            {winner.points.toLocaleString("en-IN")} pts
                            <TrendingUp className="size-3.5 text-emerald-400 shrink-0" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="h-14 w-px bg-white/10 shrink-0" />

                    {/* Right Side: Ranks #2 to #5 — equal flex columns */}
                    <div className="flex flex-1 items-center justify-around gap-2 min-w-0">
                      {others.map((user) => {
                        const badgeColors =
                          user.rank === 2
                            ? "bg-blue-600 text-white"
                            : user.rank === 3
                              ? "bg-amber-700 text-amber-100"
                              : "bg-slate-700 text-slate-300";

                        return (
                          <div key={user.userId} className="flex flex-col items-center text-center gap-1 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className="size-11 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden shadow-md">
                                {user.image ? (
                                  <img src={user.image} alt={user.name} className="size-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-slate-200 uppercase">
                                    {user.name.substring(0, 2)}
                                  </span>
                                )}
                              </div>
                              {/* Rank badge — bottom-left of avatar */}
                              <span className={`absolute -bottom-1 -left-0.5 flex items-center justify-center text-[9px] font-extrabold min-w-[20px] h-[14px] px-1 rounded-full shadow ${badgeColors}`}>
                                #{user.rank}
                              </span>
                            </div>
                            {/* Name */}
                            <span className="text-[11px] font-semibold text-slate-100 whitespace-nowrap">
                              {user.name.split(" ")[0]}
                            </span>
                            {/* Points */}
                            <span className="text-[11px] font-bold text-slate-400 font-mono whitespace-nowrap">
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
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[200px] lg:col-span-4">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-white">Receivables & Overdue Invoices</h2>
            <Link
              href="/invoices"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.overdueInvoices.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2 mt-1">
            {data.overdueInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No overdue invoices 👍</p>
            ) : (
              data.overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-white/5 last:border-0 shrink-0 w-full">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-bold text-white shrink-0">{formatCurrency(inv.balanceDue)}</span>
                    <span className="text-slate-400 truncate min-w-0 flex-1">{inv.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">Due {inv.dueDateFormatted}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                      Overdue
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Pending Payment Proofs (4 cols) */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-material-sidebar p-5 h-[200px] lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-base font-bold text-white">Pending Payment Proofs</h2>
            <Link
              href="/payments"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View all ({data.pendingPaymentProofs.length})
            </Link>
          </div>

          <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-3 flex flex-col gap-2 mt-1">
            {data.pendingPaymentProofs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">All payment proofs verified 👍</p>
            ) : (
              data.pendingPaymentProofs.map((proof) => (
                <div key={proof.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-white/5 last:border-0 shrink-0 w-full">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-bold text-white truncate min-w-0">{proof.clientName}</span>
                    <span className="text-[11px] text-slate-400 truncate min-w-0">{proof.uploadedAgo}</span>
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
