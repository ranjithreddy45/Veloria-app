"use client";

import {
  IndianRupee,
  CalendarCheck,
  UserPlus,
  CheckSquare,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
}

// ============================================================
// Currency formatting helper
// ============================================================

function formatIndianCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} L`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)} K`;
  }
  return amount.toLocaleString("en-IN");
}

// ============================================================
// KPI Cards Component
// ============================================================

export function KpiCards({ revenue, bookings, leads, tasks }: KpiCardsProps) {
  const cards = [
    {
      title: "Revenue This Month",
      value: `\u20B9${formatIndianCurrency(revenue.thisMonth)}`,
      change: revenue.changePercent,
      icon: IndianRupee,
      color: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-200/50 dark:from-emerald-900/40 dark:to-emerald-800/20",
      iconGlow: "dark:glow-emerald",
    },
    {
      title: "Active Bookings",
      value: bookings.active.toString(),
      change: bookings.changePercent,
      subtitle: `${bookings.thisMonth} new this month`,
      icon: CalendarCheck,
      color: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-gradient-to-br from-blue-100 to-blue-200/50 dark:from-blue-900/40 dark:to-blue-800/20",
      iconGlow: "dark:glow-blue",
    },
    {
      title: "New Leads",
      value: leads.newThisMonth.toString(),
      change: leads.changePercent,
      icon: UserPlus,
      color: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-gradient-to-br from-violet-100 to-violet-200/50 dark:from-violet-900/40 dark:to-violet-800/20",
      iconGlow: "dark:glow-violet",
    },
    {
      title: "Pending Tasks",
      value: tasks.pending.toString(),
      change: tasks.overdue,
      icon: CheckSquare,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-gradient-to-br from-amber-100 to-amber-200/50 dark:from-amber-900/40 dark:to-amber-800/20",
      iconGlow: "dark:glow-amber",
      isTaskCard: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const isPositive = card.isTaskCard
          ? card.change === 0
          : card.change >= 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;

        return (
          <Card
            key={card.title}
            className={cn("group relative overflow-hidden", `animate-stagger-${index + 1}`)}
          >
            {/* Luminous accent line */}
            <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-30", card.color)} />
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {card.value}
                  </p>
                  <div className="flex items-center gap-1">
                    {card.isTaskCard ? (
                      <>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            card.change > 0
                              ? "text-red-500"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {card.change > 0
                            ? `${card.change} overdue`
                            : "No overdue"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          of {tasks.total} total
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendIcon
                          className={cn(
                            "size-3.5",
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {card.change}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs last month
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
                    card.iconBg,
                    card.iconGlow
                  )}
                >
                  <Icon className={cn("size-5", card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
