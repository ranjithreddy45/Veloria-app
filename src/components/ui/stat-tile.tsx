// ============================================================
// StatTile — a colorful, gamified KPI tile. A soft color-washed card with an
// icon chip, a big value, an optional trend delta, and an optional progress
// ring/bar. Used across dashboards and module landings to make progress feel
// lively and worth coming back to. Pick an `accent` per metric.
// ============================================================

import * as React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Donut } from "@/components/ui/donut";
import { CountUp } from "@/components/ui/count-up";

export type Accent = "indigo" | "blue" | "gold" | "brand" | "emerald" | "amber" | "rose" | "red" | "pink" | "cyan" | "teal";

const ACCENT: Record<Accent, { wash: string; chip: string; ring: string; bar: string; text: string }> = {
  indigo: { wash: "from-indigo-500/8 to-indigo-500/0", chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300", ring: "text-indigo-500", bar: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-300" },
  blue: { wash: "from-blue-500/8 to-blue-500/0", chip: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300", ring: "text-blue-500", bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-300" },
  // Brand slots — token-driven so they follow the emerald+gold identity rather
  // than a frozen palette step. `violet` retired with the rebrand.
  gold: { wash: "from-gold/10 to-gold/0", chip: "bg-gold/15 text-gold dark:bg-gold/20", ring: "text-gold", bar: "bg-gold", text: "text-gold" },
  brand: { wash: "from-primary/10 to-primary/0", chip: "bg-primary/12 text-primary dark:bg-primary/20", ring: "text-primary", bar: "bg-primary", text: "text-primary" },
  emerald: { wash: "from-emerald-500/8 to-emerald-500/0", chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300", ring: "text-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-300" },
  amber: { wash: "from-amber-500/8 to-amber-500/0", chip: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300", ring: "text-amber-500", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-300" },
  rose: { wash: "from-rose-500/8 to-rose-500/0", chip: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300", ring: "text-rose-500", bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" },
  // `red` for urgent/negative states (overdue money, failures). Distinct from
  // `rose`, whose 500 stop (#f43f5e) reads pink rather than urgent.
  red: { wash: "from-red-500/8 to-red-500/0", chip: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300", ring: "text-red-500", bar: "bg-red-500", text: "text-red-600 dark:text-red-300" },
  pink: { wash: "from-pink-500/8 to-pink-500/0", chip: "bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300", ring: "text-pink-500", bar: "bg-pink-500", text: "text-pink-600 dark:text-pink-300" },
  cyan: { wash: "from-cyan-500/8 to-cyan-500/0", chip: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300", ring: "text-cyan-500", bar: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-300" },
  teal: { wash: "from-teal-500/8 to-teal-500/0", chip: "bg-teal-100 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300", ring: "text-teal-500", bar: "bg-teal-500", text: "text-teal-600 dark:text-teal-300" },
};

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  accent?: Accent;
  icon?: React.ReactNode;
  sub?: string;
  /** Trend delta vs previous period (e.g. +12 or "+12%"). Positive = green. */
  delta?: number;
  deltaLabel?: string;
  /** Show a progress ring (0–100) instead of plain value emphasis. */
  pct?: number;
  className?: string;
}

export function StatTile({ label, value, accent = "indigo", icon, sub, delta, deltaLabel, pct, className }: StatTileProps) {
  const a = ACCENT[accent];
  return (
    <div className={cn("group sheen-sweep relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br bg-card p-5 shadow-premium transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-1 hover:shadow-card-hover", a.wash, className)}>
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className={cn("flex size-8 items-center justify-center rounded-xl shadow-sm transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:scale-110 group-hover:shadow-md [&>svg]:size-4", a.chip)}>{icon}</span>}
            <span className="text-xs font-medium tracking-[-0.005em] text-muted-foreground">{label}</span>
          </div>
          <div className="mt-3 text-[28px] font-bold tabular-nums leading-none tracking-[-0.03em]">
            {typeof value === "number" ? <CountUp value={value} /> : value}
          </div>
          {sub && <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>}
          {typeof delta === "number" && delta !== 0 && (
            <p className={cn("mt-2 inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums", delta > 0 ? "text-success" : "text-destructive")}>
              {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {delta > 0 ? "+" : ""}{delta}{deltaLabel ?? ""}
            </p>
          )}
        </div>
        {typeof pct === "number" && (
          <Donut value={Math.max(0, Math.min(100, pct))} size={48} thickness={5} colorClass={a.ring} ariaLabel={`${pct}% ${label}`} />
        )}
      </div>
      {typeof pct !== "number" && typeof delta !== "number" && (
        <span aria-hidden className={cn("mt-3.5 block h-1 w-10 rounded-full", a.bar)} />
      )}
    </div>
  );
}
