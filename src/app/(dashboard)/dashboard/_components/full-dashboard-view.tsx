"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardFullData } from "@/actions/dashboard-full.actions";
import { getHallOccupancyForDate, getEventsForDate } from "@/actions/dashboard-full.actions";
import { format, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { sentenceCase } from "@/lib/text-case";
import { QuickActions, type HubActionSpec } from "@/components/ui/quick-actions";

// ============================================================
// The team home (Workspace v3, approved concept 2026-10-29).
// ------------------------------------------------------------
// Read top to bottom the way a morning goes:
//   1. what needs you today (three numbers, each a way in)
//   2. the month's figures, one quiet strip
//   3. money over time and where the leads stand
//   4. the day itself: what is waiting, what is on, which halls are free
//   5. the longer view: event mix, receivables, proofs to check, the team
// Plum is the only accent; gold marks money that has landed (cash collected);
// red appears only when something is overdue. Every figure is a real one from
// getDashboardFullData; nothing here is decorative.
// ============================================================

interface FullDashboardViewProps {
  data: DashboardFullData;
  /**
   * The hub's shortcut pills, already filtered on the server with
   * visibleActions() (dashboard/page.tsx). Plain data, so it crosses the
   * server/client boundary as is.
   */
  quickActions: readonly HubActionSpec[];
  /** Whether the Open leads figure may link to /leads (leads:read, override-aware). */
  canOpenLeads: boolean;
}

type Period = "This Month" | "This Quarter" | "This Year" | "All Time";
const PERIODS: { value: Period; label: string }[] = [
  { value: "This Month", label: "Month" },
  { value: "This Quarter", label: "Quarter" },
  { value: "This Year", label: "Year" },
  { value: "All Time", label: "All" },
];

type Range = "12m" | "year" | "6m";
const RANGES: { value: Range; label: string }[] = [
  { value: "12m", label: "12 months" },
  { value: "year", label: "This year" },
  { value: "6m", label: "6 months" },
];

// The month the cash figure covers: the current month in IST, the window
// getDashboardFullData sums. Derived from the data's own timestamp so the
// server render and the client hydrate agree.
const IST_MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
const IST_HOUR = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" });

/** The greeting for the hour in IST (the old home said "Good afternoon" at any hour). */
function greetingFor(asOf: string) {
  const hour = Number(IST_HOUR.format(new Date(asOf)));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const inr = (amount: number) => "₹" + Math.round(amount).toLocaleString("en-IN");

/** ₹ in lakh for chart axes: ₹0, ₹15L, ₹1.2Cr. */
function lakh(value: number) {
  if (value === 0) return "₹0";
  if (value >= 1_00_00_000) return `₹${+(value / 1_00_00_000).toFixed(1)}Cr`;
  return `₹${Math.round(value / 1_00_000)}L`;
}

const getTodayISO = () => format(new Date(), "yyyy-MM-dd");

function formatDateLabel(isoDate: string) {
  const d = parseISO(isoDate);
  if (isoDate === getTodayISO()) return "Today";
  if (isoDate === format(addDays(new Date(), -1), "yyyy-MM-dd")) return "Yesterday";
  if (isoDate === format(addDays(new Date(), 1), "yyyy-MM-dd")) return "Tomorrow";
  return d.getFullYear() === new Date().getFullYear() ? format(d, "d MMM") : format(d, "d MMM yyyy");
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const SHEET = "min-w-0 rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]";
const LINK = "shrink-0 text-body font-medium text-primary underline-offset-4 hover:underline";

function Sheet({
  title,
  meta,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(SHEET, "flex flex-col", className)}>
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
        <h2 className="mr-auto text-copy font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {meta}
      </div>
      <div className={cn("min-h-0 flex-1 px-5 pb-5 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A small segmented switch: a sunken well with the chosen option lifted out. */
function Switcher<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[9px] border border-border bg-muted p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-6 rounded-[7px] px-2.5 text-detail font-medium transition-[background-color,color,box-shadow]",
              active
                ? "bg-card text-foreground shadow-[var(--shadow-1),inset_0_0_0_1px_var(--border)] dark:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Previous day · label (opens a date picker) · next day. */
function DayStepper({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const step = (days: number) => onChange(format(addDays(parseISO(value), days), "yyyy-MM-dd"));
  return (
    <div className="inline-flex h-7 items-center rounded-[9px] border border-border bg-card text-detail font-medium shadow-[var(--shadow-1)]">
      <button type="button" onClick={() => step(-1)} aria-label="Previous day" className="grid h-full w-7 place-items-center rounded-l-[9px] text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft className="size-3.5" />
      </button>
      <label className="relative grid h-full min-w-16 cursor-pointer place-items-center px-1.5 text-foreground">
        {formatDateLabel(value)}
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Choose a date"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <button type="button" onClick={() => step(1)} aria-label="Next day" className="grid h-full w-7 place-items-center rounded-r-[9px] text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

function Delta({ percent }: { percent: number }) {
  if (percent === 0) return <span className="text-subtle-foreground">No change</span>;
  const up = percent > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-detail font-medium tabular-nums",
        up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {/* The arrow is decorative, so the words carry the direction. */}
      {up ? "+" : "−"}
      {Math.abs(percent)}%
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-body text-subtle-foreground">{children}</p>;
}

/** A horizontal bar: the share of the largest value, in plum. */
function Bar({ value, max, strong }: { value: number; max: number; strong?: boolean }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500", strong ? "bg-primary" : "bg-primary/55")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function FullDashboardView({ data, quickActions, canOpenLeads }: FullDashboardViewProps) {
  const [range, setRange] = useState<Range>("12m");
  const [pipelinePeriod, setPipelinePeriod] = useState<Period>("This Month");
  const [eventTypePeriod, setEventTypePeriod] = useState<Period>("This Month");

  const [occupancyDate, setOccupancyDate] = useState(getTodayISO());
  const [occupancyList, setOccupancyList] = useState(data.hallOccupancy);
  const [isOccupancyLoading, setIsOccupancyLoading] = useState(false);

  const [eventsDate, setEventsDate] = useState(getTodayISO());
  const [eventsList, setEventsList] = useState(data.todaysEvents);
  const [isEventsLoading, setIsEventsLoading] = useState(false);

  const changeOccupancyDate = async (iso: string) => {
    setOccupancyDate(iso);
    setIsOccupancyLoading(true);
    try {
      const res = await getHallOccupancyForDate(iso);
      if (res.success && res.data) setOccupancyList(res.data);
    } catch (err) {
      console.error("Failed to fetch occupancy for date:", err);
    } finally {
      setIsOccupancyLoading(false);
    }
  };

  const changeEventsDate = async (iso: string) => {
    setEventsDate(iso);
    setIsEventsLoading(true);
    try {
      const res = await getEventsForDate(iso);
      if (res.success && res.data) setEventsList(res.data);
    } catch (err) {
      console.error("Failed to fetch events for date:", err);
    } finally {
      setIsEventsLoading(false);
    }
  };

  const pipeline = data.leadPipeline?.[pipelinePeriod] ?? data.leadPipeline?.["This Month"] ?? { total: 0, stages: [] };
  const eventTypes = data.bookingsByType?.[eventTypePeriod] ?? data.bookingsByType?.["This Month"] ?? { total: 0, types: [] };

  const chartData = React.useMemo(() => {
    if (range === "6m") return data.revenueTrend.slice(-6);
    if (range === "year") {
      const year = new Date(data.asOf).getFullYear().toString();
      const filtered = data.revenueTrend.filter((item) => item.monthKey.startsWith(year));
      return filtered.length > 0 ? filtered : data.revenueTrend;
    }
    return data.revenueTrend;
  }, [data.revenueTrend, data.asOf, range]);

  const { kpis } = data;
  const firstName = data.user.name.split(" ")[0];
  const nextEvent = data.todaysEvents[0];
  const firstAttention = data.attentionItems[0];
  const pipelineMax = Math.max(0, ...pipeline.stages.map((s) => s.count));
  const typeMax = Math.max(0, ...eventTypes.types.map((t) => t.count));

  const today = [
    {
      n: data.attentionItems.length,
      title: "Waiting on you",
      detail: firstAttention ? firstAttention.title : "Nothing is waiting on you",
      href: "/my-work",
      tone: "default" as const,
    },
    {
      n: kpis.overdue.count,
      title: kpis.overdue.count === 1 ? "Invoice overdue" : "Invoices overdue",
      detail: kpis.overdue.count > 0 ? `${inr(kpis.overdue.amount)} still to collect` : "Every invoice is on time",
      href: "/invoices",
      tone: kpis.overdue.count > 0 ? ("bad" as const) : ("default" as const),
    },
    {
      n: kpis.eventsThisWeek.todayCount,
      title: kpis.eventsThisWeek.todayCount === 1 ? "Event today" : "Events today",
      detail: nextEvent
        ? `${nextEvent.formattedTime} · ${nextEvent.eventName}`
        : `${kpis.eventsThisWeek.upcomingCount} more later this week`,
      href: "/calendar",
      tone: "default" as const,
    },
  ];

  const kpiCells: { label: string; value: React.ReactNode; foot: React.ReactNode; href?: string; valueClass?: string }[] = [
    {
      label: `Cash collected, ${IST_MONTH.format(new Date(data.asOf))}`,
      value: inr(kpis.cashCollected.amount),
      valueClass: "text-gold",
      foot: (
        <>
          <Delta percent={kpis.cashCollected.changePercent} />
          <span>vs last month</span>
        </>
      ),
    },
    {
      label: "Booked value, this month",
      value: inr(kpis.bookedValue.amount),
      foot: (
        <>
          <Delta percent={kpis.bookedValue.changePercent} />
          <span>vs last month</span>
        </>
      ),
    },
    {
      label: "Overdue",
      value: inr(kpis.overdue.amount),
      valueClass: kpis.overdue.amount > 0 ? "text-destructive" : undefined,
      foot: `${kpis.overdue.count} ${kpis.overdue.count === 1 ? "invoice" : "invoices"}`,
    },
    {
      label: "Open leads",
      value: kpis.openLeads.count.toLocaleString("en-IN"),
      foot: kpis.openLeads.breachedCount === 0 ? "None past deadline" : `${kpis.openLeads.breachedCount} past deadline`,
      href: canOpenLeads ? "/leads" : undefined,
    },
    {
      label: "Events this week",
      value: kpis.eventsThisWeek.total,
      foot: `${kpis.eventsThisWeek.todayCount} today · ${kpis.eventsThisWeek.upcomingCount} upcoming`,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-5">
      {/* 1. Greeting + the hub's shortcuts */}
      <header className="flex flex-col gap-4 pb-1 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-body font-medium leading-5 text-subtle-foreground">{data.todayFormatted}</p>
          <h1 className="large-title text-h2 leading-tight text-foreground sm:text-h1">
            {greetingFor(data.asOf)}, {firstName}
          </h1>
        </div>
        {/* The shared action cluster in hub mode: order, labels and permissions
            come from page.tsx. */}
        <QuickActions hub actions={quickActions} className="xl:justify-end" />
      </header>

      {/* 2. What needs you today */}
      <section aria-label="Today" className={cn(SHEET, "grid grid-cols-1 overflow-hidden md:grid-cols-3")}>
        {today.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-muted/60",
              i > 0 && "border-t border-border md:border-l md:border-t-0"
            )}
          >
            <span
              className={cn(
                "min-w-7 text-h2 font-medium leading-none tracking-[-0.03em] tabular-nums",
                item.tone === "bad" && item.n > 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {item.n}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-copy font-medium text-foreground">{item.title}</span>
              <span className="mt-0.5 block truncate text-body text-subtle-foreground">{item.detail}</span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
          </Link>
        ))}
      </section>

      {/* 3. The month's figures */}
      <section
        aria-label="This month"
        className={cn(SHEET, "grid grid-cols-2 overflow-hidden lg:grid-cols-5 [&>*]:border-border")}
      >
        {kpiCells.map((cell, i) => {
          const body = (
            <>
              <span className="line-clamp-2 block text-body leading-snug text-muted-foreground">{cell.label}</span>
              <span className={cn("mt-2 block whitespace-nowrap text-title font-semibold tracking-[-0.03em] tabular-nums sm:text-h2", cell.valueClass ?? "text-foreground")}>
                {cell.value}
              </span>
              <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-detail text-subtle-foreground">{cell.foot}</span>
            </>
          );
          const edge = cn(
            "min-w-0 px-5 py-4",
            // Two across below lg (a hairline between and under), five across from lg.
            i % 2 === 1 && "border-l lg:border-l",
            i >= 2 && "border-t lg:border-t-0",
            i > 0 && "lg:border-l",
            i === 4 && "col-span-2 lg:col-span-1"
          );
          return cell.href ? (
            <Link key={cell.label} href={cell.href} className={cn(edge, "transition-colors hover:bg-muted/60")}>
              {body}
            </Link>
          ) : (
            <div key={cell.label} className={edge}>
              {body}
            </div>
          );
        })}
      </section>

      {/* 4. Money over time · where the leads stand */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Sheet
          title="Booked and collected"
          className="lg:col-span-8"
          meta={<Switcher label="Range" value={range} options={RANGES} onChange={setRange} />}
        >
          <div className="mb-2 flex flex-wrap items-center gap-4 text-detail text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              Booked value
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-gold" aria-hidden />
              Cash collected
            </span>
          </div>
          <div className="h-60 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="home-booked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="home-collected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--subtle-foreground)", fontSize: 11 }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tick={{ fill: "var(--subtle-foreground)", fontSize: 11 }}
                  tickFormatter={lakh}
                />
                <Tooltip
                  cursor={{ stroke: "var(--input)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as { month: string; monthKey: string; booked: number; collected: number };
                    const year = item.monthKey ? item.monthKey.split("-")[0] : "";
                    return (
                      <div className="min-w-44 rounded-[10px] border border-border bg-popover px-3 py-2.5 text-body shadow-[var(--shadow-2)]">
                        <p className="mb-1.5 text-detail text-subtle-foreground">
                          {item.month} {year}
                        </p>
                        <p className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-primary" aria-hidden />
                            Booked
                          </span>
                          <span className="font-medium tabular-nums text-foreground">{inr(item.booked)}</span>
                        </p>
                        <p className="mt-1 flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-gold" aria-hidden />
                            Collected
                          </span>
                          <span className="font-medium tabular-nums text-foreground">{inr(item.collected)}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="booked"
                  name="Booked value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#home-booked)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Cash collected"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  fill="url(#home-collected)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--gold)", stroke: "var(--card)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Sheet>

        <Sheet
          title="Lead pipeline"
          className="lg:col-span-4"
          meta={<Switcher label="Period" value={pipelinePeriod} options={PERIODS} onChange={setPipelinePeriod} />}
        >
          {pipeline.stages.length === 0 ? (
            <Empty>No leads in this period</Empty>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {pipeline.stages.map((stage, i) => (
                <li key={stage.stage} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_2.25rem] items-center gap-3 text-body">
                  <span className="truncate text-muted-foreground">{sentenceCase(stage.label)}</span>
                  <Bar value={stage.count} max={pipelineMax} strong={i === pipeline.stages.length - 1} />
                  <span className="text-right font-medium tabular-nums text-foreground">{stage.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-detail text-subtle-foreground">
            {pipeline.total.toLocaleString("en-IN")} {pipeline.total === 1 ? "lead" : "leads"} in this period
          </p>
        </Sheet>
      </div>

      {/* 5. The day: what is waiting · what is on */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Sheet
          title="Needs you now"
          className="lg:col-span-7"
          bodyClassName="px-2 pb-2"
          meta={
            <Link href="/my-work" className={LINK}>
              View all{data.attentionItems.length > 0 ? ` (${data.attentionItems.length})` : ""}
            </Link>
          }
        >
          {data.attentionItems.length === 0 ? (
            <Empty>Nothing urgent right now</Empty>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto">
              {data.attentionItems.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-muted/60">
                  <span
                    className={cn(
                      "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-detail font-medium",
                      item.badge === "URGENT"
                        ? "bg-destructive/10 text-destructive"
                        : item.badge === "WARNING"
                          ? "bg-warning/10 text-warning"
                          : "bg-primary-soft text-primary"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {item.badge === "URGENT" ? "Urgent" : item.badge === "WARNING" ? "Warning" : "Today"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-detail text-subtle-foreground">{item.subtitle}</span>
                  </span>
                  <Link
                    href={item.actionHref}
                    className="inline-flex h-8 shrink-0 items-center rounded-[9px] border border-border bg-card px-3 text-body font-medium text-foreground shadow-[var(--shadow-1)] transition-colors hover:border-input"
                  >
                    {item.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Sheet>

        <Sheet
          title="Events"
          className="lg:col-span-5"
          bodyClassName="px-2 pb-2"
          meta={
            <>
              <DayStepper value={eventsDate} onChange={changeEventsDate} />
              <Link href="/calendar" className={LINK}>
                Calendar
              </Link>
            </>
          }
        >
          <div className={cn("transition-opacity", isEventsLoading && "opacity-40")}>
            {eventsList.length === 0 ? (
              <Empty>
                Nothing on{" "}
                {["Today", "Tomorrow", "Yesterday"].includes(formatDateLabel(eventsDate))
                  ? formatDateLabel(eventsDate).toLowerCase()
                  : formatDateLabel(eventsDate)}
              </Empty>
            ) : (
              <ul className="max-h-[22rem] overflow-y-auto">
                {eventsList.map((evt) => (
                  <li key={evt.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <span className="text-detail font-medium tabular-nums text-muted-foreground">{evt.formattedTime}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium text-foreground">{evt.eventName}</span>
                      <span className="block truncate text-detail text-subtle-foreground">
                        {evt.hall}
                        {evt.guestCount > 0 ? ` · ${evt.guestCount.toLocaleString("en-IN")} guests` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-detail font-medium",
                        evt.statusTone === "success"
                          ? "bg-success/10 text-success"
                          : evt.statusTone === "warning"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" aria-hidden />
                      {evt.statusBadgeText}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Sheet>
      </div>

      {/* 6. Which halls are free · what kind of events */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Sheet title="Hall occupancy" className="lg:col-span-7" meta={<DayStepper value={occupancyDate} onChange={changeOccupancyDate} />}>
          <div className={cn("-mx-1 overflow-x-auto transition-opacity", isOccupancyLoading && "opacity-40")}>
            {occupancyList.length === 0 ? (
              <Empty>No active halls</Empty>
            ) : (
              <table className="w-full min-w-[26rem] text-left text-body">
                <thead>
                  <tr className="border-b border-border text-detail text-subtle-foreground">
                    <th className="px-1 pb-2 font-medium">Hall</th>
                    <th className="px-1 pb-2 font-medium">Morning</th>
                    <th className="px-1 pb-2 font-medium">Evening</th>
                    <th className="px-1 pb-2 font-medium">Full day</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyList.map((hall) => (
                    <tr key={hall.venueId} className="border-b border-border last:border-0">
                      <td className="max-w-[10rem] truncate px-1 py-2.5 font-medium text-foreground">{hall.venueName}</td>
                      {[hall.morning, hall.evening, hall.fullDay].map((slot, i) => {
                        const free = slot.status === "FREE";
                        return (
                          <td key={i} className="px-1 py-2.5">
                            <span
                              title={slot.label ?? undefined}
                              className={cn(
                                "inline-flex h-[22px] items-center rounded-full px-2 text-detail font-medium",
                                free ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {free ? "Open" : "Booked"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Sheet>

        <Sheet
          title="Bookings by event"
          className="lg:col-span-5"
          meta={<Switcher label="Period" value={eventTypePeriod} options={PERIODS} onChange={setEventTypePeriod} />}
        >
          {eventTypes.types.length === 0 ? (
            <Empty>No bookings in this period</Empty>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {eventTypes.types.map((t, i) => (
                <li key={t.type} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.75rem] items-center gap-3 text-body">
                  <span className="truncate text-muted-foreground">{sentenceCase(t.type)}</span>
                  <Bar value={t.count} max={typeMax} strong={i === 0} />
                  <span className="text-right tabular-nums">
                    <span className="font-medium text-foreground">{t.count}</span>
                    <span className="ml-1 text-detail text-subtle-foreground">{t.percentage}%</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-detail text-subtle-foreground">
            {eventTypes.total.toLocaleString("en-IN")} {eventTypes.total === 1 ? "booking" : "bookings"} in this period
          </p>
        </Sheet>
      </div>

      {/* 7. Money to chase · proofs to check · the team */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
        <Sheet
          title="Overdue invoices"
          bodyClassName="px-2 pb-2"
          meta={
            <Link href="/invoices" className={LINK}>
              View all
            </Link>
          }
        >
          {data.overdueInvoices.length === 0 ? (
            <Empty>No overdue invoices</Empty>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {data.overdueInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-muted/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-foreground">{inv.clientName}</span>
                    <span className="block text-detail text-subtle-foreground">Due {inv.dueDateFormatted}</span>
                  </span>
                  <span className="shrink-0 text-body font-medium tabular-nums text-destructive">{inr(inv.balanceDue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>

        <Sheet
          title="Payment proofs to check"
          bodyClassName="px-2 pb-2"
          meta={
            <Link href="/payments" className={LINK}>
              View all
            </Link>
          }
        >
          {data.pendingPaymentProofs.length === 0 ? (
            <Empty>Every proof is verified</Empty>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {data.pendingPaymentProofs.map((proof) => (
                <li key={proof.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-muted/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-foreground">{proof.clientName}</span>
                    <span className="block text-detail text-subtle-foreground">
                      {inr(proof.amount)} · {proof.uploadedAgo}
                    </span>
                  </span>
                  <Link
                    href="/payments"
                    className="inline-flex h-8 shrink-0 items-center rounded-[9px] border border-border bg-card px-3 text-body font-medium text-foreground shadow-[var(--shadow-1)] transition-colors hover:border-input"
                  >
                    Verify
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Sheet>

        <Sheet
          title="Team this month"
          bodyClassName="px-2 pb-2"
          meta={
            <Link href="/performance/velos" className={LINK}>
              Leaderboard
            </Link>
          }
        >
          {data.velosLeaderboard.length === 0 ? (
            <Empty>No points earned yet</Empty>
          ) : (
            <ol className="max-h-64 overflow-y-auto">
              {data.velosLeaderboard.slice(0, 5).map((user) => (
                <li key={user.userId} className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-muted/60">
                  <span className={cn("w-4 text-detail font-medium tabular-nums", user.rank === 1 ? "text-gold" : "text-subtle-foreground")}>
                    {user.rank}
                  </span>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-meta font-semibold",
                        user.rank === 1 ? "bg-gold-soft text-gold" : "bg-muted text-muted-foreground"
                      )}
                      aria-hidden
                    >
                      {initials(user.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{user.name}</span>
                  <span className="shrink-0 text-body tabular-nums text-muted-foreground">
                    {user.points.toLocaleString("en-IN")} pts
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Sheet>
      </div>
    </div>
  );
}
