"use client";

import { Card } from "@/components/ui/card";
import { healthTextClass } from "@/lib/projects/ui";
import { cn } from "@/lib/utils";
import { Building2, Activity, Radio, PauseCircle } from "lucide-react";

interface Stat {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  valueClass?: string;
}

// Compact summary strip above the projects list. Pure presentation — the parent
// derives the numbers from the same rows that feed the table.
export function ProjectsStatStrip({
  total,
  avgReadiness,
  live,
  stalled,
}: {
  total: number;
  avgReadiness: number;
  live: number;
  stalled: number;
}) {
  const stats: Stat[] = [
    { label: "Total projects", value: String(total), icon: <Building2 className="size-4" /> },
    {
      label: "Avg. readiness",
      value: `${avgReadiness}%`,
      icon: <Activity className="size-4" />,
      valueClass: total ? healthTextClass(avgReadiness) : undefined,
    },
    { label: "Live venues", value: String(live), icon: <Radio className="size-4" />, valueClass: live ? "text-emerald-600 dark:text-emerald-400" : undefined },
    {
      label: "Blocked / on-hold",
      value: String(stalled),
      icon: <PauseCircle className="size-4" />,
      valueClass: stalled ? "text-amber-600 dark:text-amber-400" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="gap-0 py-4">
          <div className="flex items-center justify-between px-4">
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            <span className="text-muted-foreground/70">{s.icon}</span>
          </div>
          <div className="px-4 pt-1.5">
            <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", s.valueClass)}>
              {s.value}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
