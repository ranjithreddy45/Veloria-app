"use client";

import { StatTile } from "@/components/ui/stat-tile";
import { healthTextClass } from "@/lib/projects/ui";
import { cn } from "@/lib/utils";
import { Building2, Activity, Radio, PauseCircle } from "lucide-react";

// Summary strip above the projects list. Pure presentation — the parent derives
// the numbers from the same rows that feed the table.
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
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-stagger-1">
      <StatTile
        label="Total projects"
        value={total}
        accent="indigo"
        icon={<Building2 className="size-4" />}
        sub="in the portfolio"
      />
      <StatTile
        label="Avg. readiness"
        value={
          <span className={cn("tabular-nums", total && healthTextClass(avgReadiness))}>
            {avgReadiness}%
          </span>
        }
        accent="gold"
        icon={<Activity className="size-4" />}
        pct={total ? avgReadiness : 0}
      />
      <StatTile
        label="Live venues"
        value={live}
        accent="emerald"
        icon={<Radio className="size-4" />}
        sub={live ? "operational" : "none live yet"}
      />
      <StatTile
        label="Blocked / on-hold"
        value={stalled}
        accent={stalled ? "amber" : "teal"}
        icon={<PauseCircle className="size-4" />}
        sub={stalled ? "needs attention" : "all moving"}
      />
    </div>
  );
}
