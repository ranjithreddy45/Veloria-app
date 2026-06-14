"use client";

// ============================================================
// LeadsStatStrip — colorful KPI strip for the Leads list. Derives every metric
// from the leads already loaded for the table (no new data fetch): total count,
// hot/qualified leads, won leads, and open pipeline value. Visual-only.
// ============================================================

import * as React from "react";
import { LayersIcon, FlameIcon, TrophyIcon, BanknoteIcon } from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { formatINR } from "@/lib/utils";

interface StatLead {
  status: string;
  score: number;
  estimatedValue: number | null;
}

const HOT_SCORE = 70;

export function LeadsStatStrip({ data }: { data: StatLead[] }) {
  const stats = React.useMemo(() => {
    const total = data.length;
    let hot = 0;
    let won = 0;
    let pipeline = 0;
    for (const l of data) {
      if (l.status === "QUALIFIED" || l.score >= HOT_SCORE) hot += 1;
      if (l.status === "WON") won += 1;
      if (l.status !== "LOST" && l.status !== "WON") {
        pipeline += Number(l.estimatedValue ?? 0);
      }
    }
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
    return { total, hot, won, pipeline, winRate };
  }, [data]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Total leads"
        value={stats.total.toLocaleString("en-IN")}
        accent="indigo"
        icon={<LayersIcon className="size-4" />}
        sub="In the pipeline"
      />
      <StatTile
        label="Hot & qualified"
        value={stats.hot.toLocaleString("en-IN")}
        accent="amber"
        icon={<FlameIcon className="size-4" />}
        sub={`Score ≥ ${HOT_SCORE} or qualified`}
      />
      <StatTile
        label="Won"
        value={stats.won.toLocaleString("en-IN")}
        accent="emerald"
        icon={<TrophyIcon className="size-4" />}
        pct={stats.winRate}
        sub={`${stats.winRate}% win rate`}
      />
      <StatTile
        label="Pipeline value"
        value={formatINR(stats.pipeline)}
        accent="violet"
        icon={<BanknoteIcon className="size-4" />}
        sub="Open (excl. won/lost)"
      />
    </div>
  );
}
