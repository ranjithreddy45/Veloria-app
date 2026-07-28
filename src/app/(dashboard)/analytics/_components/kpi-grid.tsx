"use client";

import type React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export interface KPI {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

interface KPIGridProps {
  items: KPI[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

// ============================================================
// KPI Grid Component
// ============================================================

export function KPIGrid({ items, columns = 4, className }: KPIGridProps) {
  const gridCols: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-3", gridCols[columns], className)}>
      {items.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            {kpi.icon && (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                {kpi.icon}
              </span>
            )}
          </div>
          <div className="numeric mt-3 truncate text-[26px] font-semibold leading-none text-foreground">
            {typeof kpi.value === "number"
              ? kpi.value.toLocaleString("en-IN")
              : kpi.value}
          </div>
          {kpi.change !== undefined && (
            <p
              className={cn(
                "numeric mt-2.5 text-[12px] font-medium",
                kpi.change > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : kpi.change < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
              )}
            >
              {kpi.change > 0 ? "+" : ""}
              {kpi.change.toFixed(1)}%{" "}
              <span className="font-normal text-muted-foreground">
                from last period
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
