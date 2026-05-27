"use client";

import {
  IndianRupee,
  CalendarCheck,
  UserPlus,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
// Currency formatting helper
// ============================================================

function formatIndianCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`;
  return amount.toLocaleString("en-IN");
}

// ============================================================
// KPI Card — minimal frame, sparkline + comparison row
// ============================================================

type Trend = "up" | "down" | "flat";

interface KpiDef {
  key: string;
  title: string;
  value: string;
  changeLabel: string;
  changeContext: string;
  trend: Trend;
  icon: LucideIcon;
  series: number[];
  color: string;
}

export function KpiCards({
  revenue,
  bookings,
  leads,
  tasks,
  revenueHistory,
}: KpiCardsProps) {
  const taskTrend: Trend =
    tasks.overdue === 0 ? "flat" : tasks.overdue > 0 ? "down" : "up";

  const cards: KpiDef[] = [
    {
      key: "revenue",
      title: "Revenue this month",
      value: `₹${formatIndianCurrency(revenue.thisMonth)}`,
      changeLabel: `${revenue.changePercent >= 0 ? "+" : ""}${revenue.changePercent}%`,
      changeContext: "vs last month",
      trend: revenue.changePercent >= 0 ? "up" : "down",
      icon: IndianRupee,
      series:
        revenueHistory && revenueHistory.length
          ? revenueHistory
          : synthesizeSeries(revenue.thisMonth, revenue.changePercent),
      color: "oklch(0.55 0.18 270)",
    },
    {
      key: "bookings",
      title: "Active bookings",
      value: bookings.active.toString(),
      changeLabel: `${bookings.changePercent >= 0 ? "+" : ""}${bookings.changePercent}%`,
      changeContext: `${bookings.thisMonth} new this month`,
      trend: bookings.changePercent >= 0 ? "up" : "down",
      icon: CalendarCheck,
      series: synthesizeSeries(bookings.active, bookings.changePercent),
      color: "oklch(0.6 0.13 220)",
    },
    {
      key: "leads",
      title: "New leads",
      value: leads.newThisMonth.toString(),
      changeLabel: `${leads.changePercent >= 0 ? "+" : ""}${leads.changePercent}%`,
      changeContext: "vs last month",
      trend: leads.changePercent >= 0 ? "up" : "down",
      icon: UserPlus,
      series: synthesizeSeries(Math.max(leads.newThisMonth, 3), leads.changePercent),
      color: "oklch(0.6 0.13 195)",
    },
    {
      key: "tasks",
      title: "Pending tasks",
      value: tasks.pending.toString(),
      changeLabel:
        tasks.overdue > 0 ? `${tasks.overdue} overdue` : "On track",
      changeContext: `of ${tasks.total} total`,
      trend: taskTrend,
      icon: CheckSquare,
      series: synthesizeSeries(tasks.pending, -Math.min(50, tasks.overdue * 5)),
      color: tasks.overdue > 0 ? "oklch(0.6 0.18 25)" : "oklch(0.55 0.13 145)",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const trendUp = card.trend === "up";
        const trendFlat = card.trend === "flat";
        const TrendIcon = trendUp ? ArrowUpRight : ArrowDownRight;

        return (
          <Card
            key={card.key}
            className={cn(
              "group card-hover-tint relative overflow-hidden border border-border bg-card shadow-none",
              `animate-stagger-${index + 1}`
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  {card.title}
                </p>
                <Icon
                  className="size-3.5 text-muted-foreground/55 transition-colors group-hover:text-foreground/70"
                  strokeWidth={1.8}
                />
              </div>
              <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">
                {card.value}
              </p>

              {/* Sparkline */}
              <div className="mt-3 -mx-1 h-9">
                <Sparkline
                  id={card.key}
                  series={card.series}
                  color={card.color}
                  height={36}
                />
              </div>

              {/* Footer change row */}
              <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11.5px]">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium tabular-nums",
                    trendFlat && "text-muted-foreground",
                    !trendFlat && trendUp && "text-emerald-600 dark:text-emerald-400",
                    !trendFlat && !trendUp && "text-destructive"
                  )}
                >
                  {!trendFlat && (
                    <TrendIcon className="size-3" strokeWidth={2.5} />
                  )}
                  {card.changeLabel}
                </span>
                <span className="text-muted-foreground">{card.changeContext}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
