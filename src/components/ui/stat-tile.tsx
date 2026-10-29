// ============================================================
// StatTile: the one KPI tile (Workspace v3, approved concept 2026-10-29).
// ------------------------------------------------------------
//   [icon] Label in sentence case, up to 2 lines        [ring]
//   ₹12,45,000
//   ↗ +12% vs last month         (optional trend)
//   sub line                      (optional)
//   ↑ +3 deltaLabel               (optional delta)
//
// Colour carries meaning only: the icon is muted ink unless the accent is
// gold on a rupee figure (money, which also golds the figure) or red/rose (a
// problem). Gold on a plain count ("Paused", "My leads": ~half of the 94 gold
// tiles) stays neutral, so gold keeps meaning money. The
// per-hue maps live in src/lib/ui/hues.ts (CALM_*); nothing here assembles a
// class name from a variable.
//
// The surface is the shared sheet material (surface-glass) plus an explicit
// 1px border on the element. The border is never added inside the @utility:
// it compiles after Tailwind's border utilities, and a border there once
// silently removed every Card's own border.
// ============================================================

import * as React from "react";
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CALM_RING_TEXT, isHue, type Hue } from "@/lib/ui/hues";
import { Donut } from "@/components/ui/donut";
import { CountUp } from "@/components/ui/count-up";

/**
 * The 11 accents StatTile has always taken. It is a subset of Hue (everything
 * except slate), so other files that key their own Record<Accent, …> maps on
 * it keep type-checking. The `accent` prop itself takes any Hue.
 */
export type Accent = Exclude<Hue, "slate">;

/** Which way the figure moved: up = an increase, down = a decrease, neutral = neither. */
export type StatTileTrendTone = "up" | "down" | "neutral";

/** What the movement means for the business; it only picks the trend line's colour. */
export type StatTileTrendIntent = "good" | "bad" | "neutral";

/**
 * A short, already-worded trend line, e.g. "+12% vs last month" or
 * "3 invoices overdue".
 *
 * - `tone` is the direction only, and the glyph always follows it:
 *   up = an increase (↗), down = a decrease (↘), neutral = no glyph (no
 *   change, or a line that is not a change at all). Never pick "down" for a
 *   rise because the rise is bad news; that draws a falling arrow for a
 *   number that went up.
 * - `intent` is optional and only picks the colour: good = success,
 *   bad = destructive, neutral = muted. Omitted, it follows the direction
 *   (up = good, down = bad, neutral = neutral). A rising cost is
 *   `{ tone: "up", intent: "bad" }`.
 *
 * The glyph is decorative (aria-hidden), so the text must carry the
 * direction itself: a sign ("+12%", "−8%") or a word ("up 12%").
 */
export interface StatTileTrend {
  text: string;
  tone: StatTileTrendTone;
  intent?: StatTileTrendIntent;
}

const TREND_INTENT: Readonly<Record<StatTileTrendIntent, string>> = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

/** The colour a trend gets when it names no intent: rises read as good, falls as bad. */
const DEFAULT_INTENT: Readonly<Record<StatTileTrendTone, StatTileTrendIntent>> = {
  up: "good",
  down: "bad",
  neutral: "neutral",
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Hue of the tinted chip, the ring and the hover edge. Unknown values fall back to brand. */
  accent?: Hue;
  icon?: React.ReactNode;
  sub?: string;
  /** Trend delta vs previous period (e.g. +12). Positive = green. */
  delta?: number;
  deltaLabel?: string;
  /** Optional worded trend line under the value. */
  trend?: StatTileTrend;
  /** Show a progress ring (0–100) instead of plain value emphasis. */
  pct?: number;
  className?: string;
}

/** The visible text of a value (a string, a number, or the fragments breakAtGroups builds). */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function StatTile({ label, value, accent = "indigo", icon, sub, delta, deltaLabel, trend, pct, className }: StatTileProps) {
  // A hue outside the token set (a stale string, a null from untyped data)
  // renders as brand instead of throwing.
  const hue: Hue = isHue(accent) ? accent : "brand";
  const ring = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : null;
  const isMoney = hue === "gold" && textOf(value).includes("₹");
  const isProblem = hue === "red" || hue === "rose";

  return (
    // KPI grids are routinely `grid-cols-2 md:grid-cols-4`, so at 375px a tile
    // is only ~171px wide: the mobile-first padding and type below fit a money
    // figure like "₹12,45,000" there, and `sm:` restores the desktop size.
    <div
      className={cn(
        "group relative min-w-0 overflow-hidden surface-glass rounded-[14px] border border-border p-4 sm:p-[18px]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* min-h fits two label lines, so figures line up across a grid row
              whatever the label length. */}
          <div className="flex min-h-[2.5rem] items-start gap-1.5 text-body leading-snug text-muted-foreground">
            {icon ? (
              <span
                aria-hidden
                className={cn(
                  "mt-px flex shrink-0 [&>svg]:size-4",
                  isMoney ? "text-gold" : isProblem ? "text-destructive" : "text-subtle-foreground"
                )}
              >
                {icon}
              </span>
            ) : null}
            <span className="line-clamp-2 min-w-0 break-words">{label}</span>
          </div>
          {/* break-words, never truncate: a clipped money figure is a wrong
              number, so a long value wraps to a second line instead. */}
          <div
            className={cn(
              "mt-1 break-words text-title font-semibold tabular-nums leading-tight tracking-[-0.03em] sm:text-h2 sm:leading-none",
              isMoney && "text-gold"
            )}
          >
            {typeof value === "number" ? <CountUp value={value} /> : value}
          </div>
          {trend?.text ? (
            <p className="mt-2.5 text-meta font-medium leading-snug">
              <span
                className={cn(
                  "flex items-start gap-1",
                  TREND_INTENT[trend.intent ?? DEFAULT_INTENT[trend.tone] ?? "neutral"] ?? TREND_INTENT.neutral
                )}
              >
                {trend.tone === "up" && <ArrowUpRight aria-hidden className="mt-px size-3.5 shrink-0" />}
                {trend.tone === "down" && <ArrowDownRight aria-hidden className="mt-px size-3.5 shrink-0" />}
                <span className="min-w-0">{trend.text}</span>
              </span>
            </p>
          ) : null}
          {sub && <p className="mt-2 text-meta leading-snug text-subtle-foreground">{sub}</p>}
          {typeof delta === "number" && delta !== 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-meta">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold tabular-nums",
                  delta > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}
              >
                {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {delta > 0 ? "+" : ""}{delta}
              </span>
              {deltaLabel && <span className="min-w-0 truncate text-subtle-foreground">{deltaLabel}</span>}
            </p>
          )}
        </div>
        {ring !== null && (
          // shrink-0: without it flexbox squeezes the ring into an ellipse when
          // the label column is long.
          <span className="block shrink-0">
            <Donut value={ring} size={44} thickness={4} colorClass={CALM_RING_TEXT[hue]} ariaLabel={`${pct}% ${label}`} />
          </span>
        )}
      </div>
    </div>
  );
}
