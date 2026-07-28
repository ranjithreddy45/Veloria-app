"use client";

import {
  IndianRupee,
  CalendarCheck,
  UserPlus,
  CheckSquare,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Donut } from "@/components/ui/donut";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  healthBarClass,
  healthTextClass,
} from "@/lib/projects/ui";
import { cn } from "@/lib/utils";
import { Sparkline, synthesizeSeries } from "./sparkline";

// ============================================================
// Types
// ============================================================

interface KpiCardsProps {
  revenue: {
    thisMonth: number;
    lastMonth: number;
    changePercent: number;
  };
  bookings: {
    active: number;
    thisMonth: number;
    changePercent: number;
  };
  leads: {
    newThisMonth: number;
    conversionRate: number;
    changePercent: number;
  };
  tasks: {
    pending: number;
    overdue: number;
    total: number;
  };
  /** Optional real revenue history for the revenue sparkline */
  revenueHistory?: number[];
}

// ============================================================
// Currency formatting helper — compact Indian notation for the big value
// ============================================================

function formatIndianCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`;
  return amount.toLocaleString("en-IN");
}

// ============================================================
// Shared card chrome
// ============================================================

function CardShell({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "group sheen-sweep relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-1 hover:shadow-card-hover",
        `animate-stagger-${index + 1}`
      )}
    >
      <CardContent className="relative z-[1] p-4">{children}</CardContent>
    </Card>
  );
}

function CardHead({
  title,
  Icon,
  tint,
}: {
  title: string;
  Icon: LucideIcon;
  tint: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg bg-muted/60 transition-colors",
          tint
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.9} />
      </span>
    </div>
  );
}

/** Trend delta chip: arrow + percentage, green up / rose down / muted flat. */
function DeltaChip({
  changePercent,
  context,
}: {
  changePercent: number;
  context: string;
}) {
  const flat = changePercent === 0;
  const up = changePercent > 0;
  const TrendIcon = up ? ArrowUp : ArrowDown;
  return (
    <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11.5px]">
      <span
        className={cn(
          "numeric inline-flex items-center gap-0.5 font-medium",
          flat && "text-muted-foreground",
          !flat && up && "text-emerald-600 dark:text-emerald-400",
          !flat && !up && "text-rose-600 dark:text-rose-400"
        )}
      >
        {!flat && <TrendIcon className="size-3" strokeWidth={2.5} />}
        {`${changePercent >= 0 ? "+" : ""}${changePercent}%`}
      </span>
      <span className="text-muted-foreground">{context}</span>
    </div>
  );
}

// ============================================================
// KPI Cards — a motivating progress cockpit
// ============================================================

export function KpiCards({
  revenue,
  bookings,
  leads,
  tasks,
  revenueHistory,
}: KpiCardsProps) {
  // Task completion: how much of today's load is already cleared.
  const tasksDone = Math.max(0, tasks.total - tasks.pending);
  const completionPct =
    tasks.total > 0 ? Math.round((tasksDone / tasks.total) * 100) : 100;
  const conversionPct = Math.round(leads.conversionRate);

  const revenueSeries =
    revenueHistory && revenueHistory.length
      ? revenueHistory
      : synthesizeSeries(revenue.thisMonth, revenue.changePercent);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* ---- Revenue: big value + live sparkline + MoM delta ---- */}
      <CardShell index={0}>
        <CardHead
          title="Revenue this month"
          Icon={IndianRupee}
          tint="text-violet-600 group-hover:bg-violet-500/10 dark:text-violet-400"
        />
        <p className="numeric mt-2 text-[26px] font-semibold leading-none text-foreground">
          ₹{formatIndianCurrency(revenue.thisMonth)}
        </p>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Cash collected — payments received
        </p>
        <div className="mt-3 -mx-1 h-9">
          <Sparkline
            id="revenue"
            series={revenueSeries}
            color="oklch(0.55 0.18 270)"
            height={36}
          />
        </div>
        <DeltaChip changePercent={revenue.changePercent} context="vs last month" />
      </CardShell>

      {/* ---- Active bookings: value + new-this-month pill + MoM delta ---- */}
      <CardShell index={1}>
        <CardHead
          title="Active bookings"
          Icon={CalendarCheck}
          tint="text-sky-600 group-hover:bg-sky-500/10 dark:text-sky-400"
        />
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="numeric text-[26px] font-semibold leading-none text-foreground">
            {bookings.active}
          </p>
          {bookings.thisMonth > 0 && (
            <StatusPill
              hue="sky"
              size="xs"
              noDot
              label={`+${bookings.thisMonth} new`}
            />
          )}
        </div>
        <div className="mt-3 -mx-1 h-9">
          <Sparkline
            id="bookings"
            series={synthesizeSeries(bookings.active, bookings.changePercent)}
            color="oklch(0.6 0.13 220)"
            height={36}
          />
        </div>
        <DeltaChip
          changePercent={bookings.changePercent}
          context="vs last month"
        />
      </CardShell>

      {/* ---- New leads: value + conversion-rate Donut (goal-style) ---- */}
      <CardShell index={2}>
        <CardHead
          title="New leads"
          Icon={UserPlus}
          tint="text-teal-600 group-hover:bg-teal-500/10 dark:text-teal-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="numeric text-[26px] font-semibold leading-none text-foreground">
              {leads.newThisMonth}
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              conversion rate
            </p>
          </div>
          <Donut
            value={conversionPct}
            size={56}
            thickness={6}
            colorClass={healthTextClass(conversionPct)}
            ariaLabel={`${conversionPct}% lead conversion rate`}
          />
        </div>
        <DeltaChip changePercent={leads.changePercent} context="vs last month" />
      </CardShell>

      {/* ---- Tasks: pending value + completion bar + status pill ---- */}
      <CardShell index={3}>
        <CardHead
          title="Pending tasks"
          Icon={CheckSquare}
          tint={cn(
            "group-hover:bg-muted",
            tasks.overdue > 0
              ? "text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/10"
              : "text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/10"
          )}
        />
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="numeric text-[26px] font-semibold leading-none text-foreground">
            {tasks.pending}
          </p>
          <StatusPill
            hue={tasks.overdue > 0 ? ("rose" as Hue) : ("emerald" as Hue)}
            size="xs"
            label={
              tasks.overdue > 0 ? `${tasks.overdue} overdue` : "On track"
            }
          />
        </div>

        {/* Completion bar — share of today's tasks already cleared */}
        <div className="mt-3.5">
          <div className="numeric flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{completionPct}% complete</span>
            <span>
              {tasksDone}/{tasks.total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out",
                healthBarClass(completionPct)
              )}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        <div className="mt-2.5 border-t border-border/60 pt-2 text-[11.5px] text-muted-foreground">
          <span className="numeric">{tasks.total}</span> total tasks
        </div>
      </CardShell>
    </div>
  );
}
