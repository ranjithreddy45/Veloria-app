"use client";

import type React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {items.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.label}
            </CardTitle>
            {kpi.icon && (
              <div className="text-muted-foreground">{kpi.icon}</div>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {typeof kpi.value === "number"
                ? kpi.value.toLocaleString("en-IN")
                : kpi.value}
            </div>
            {kpi.change !== undefined && (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  kpi.change > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpi.change < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {kpi.change > 0 ? "+" : ""}
                {kpi.change.toFixed(1)}% from last period
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
