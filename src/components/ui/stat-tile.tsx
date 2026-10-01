// ============================================================
// StatTile: the one KPI tile, styled like the approved dashboard KPI card.
// ------------------------------------------------------------
//   [LABEL, UPPERCASE, UP TO 2 LINES]            [chip]
//   ₹12,45,000
//   ↗ 12% vs last month          (optional trend)
//   sub line                      (optional)
//   ↑ +3 deltaLabel               (optional delta)
//
// When `pct` is set the progress ring takes the top-right slot and the chip
// moves to the left of the label.
//
// The surface is the shared glass material plus an explicit 1px border on the
// element. The border is never added inside the surface-glass @utility: that
// utility compiles after Tailwind's border utilities, and a border there once
// silently removed every Card's own border.
//
// Chip colours come from SOFT_CHIP in src/lib/ui/hues.ts through IconChip.
// Nothing here assembles a class name from a variable.
// ============================================================

import * as React from "react";
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOVER_EDGE, RING_TEXT, isHue, type Hue } from "@/lib/ui/hues";
import { IconChip } from "@/components/ui/icon-chip";
import { Donut } from "@/components/ui/donut";
import { CountUp } from "@/components/ui/count-up";

/**
 * The 11 accents StatTile has always taken. It is a subset of Hue (everything
 * except slate), so other files that key their own Record<Accent, …> maps on
 * it keep type-checking. The `accent` prop itself takes any Hue.
 */
export type Accent = Exclude<Hue, "slate">;

export type StatTileTrendTone = "up" | "down" | "neutral";

/**
 * A short, already-worded trend line, e.g. "12% vs last month" or
 * "3 invoices overdue". The tone sets its colour and glyph:
 * up = success with ↗, down = destructive with ↘, neutral = muted, no glyph.
 * Pick the tone for what the change means, not only its direction.
 */
export interface StatTileTrend {
  text: string;
  tone: StatTileTrendTone;
}

const TREND_TONE: Readonly<Record<StatTileTrendTone, string>> = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
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

export function StatTile({ label, value, accent = "indigo", icon, sub, delta, deltaLabel, trend, pct, className }: StatTileProps) {
  // Same contract as `SOFT_CHIP[accent] ?? SOFT_CHIP.brand`: a hue that isn't
  // in the token set (a stale string, a null from untyped data) renders as
  // brand instead of throwing. Every map below is then read with a known key.
  const hue: Hue = isHue(accent) ? accent : "brand";
  const ring = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : null;
  const hasRing = ring !== null;

  // IconChip takes an element. Every caller passes one (an icon like
  // <Wallet className="size-4" />); anything else is wrapped in a fragment so
  // it still renders inside the chip.
  const chip = icon ? (
    <IconChip icon={React.isValidElement(icon) ? icon : <>{icon}</>} hue={hue} size="md" tone="soft" />
  ) : null;

  // The label band. Uppercase plus tracking makes labels about 20% wider than
  // before, and the band also holds the 36px chip (and, beside it, the ring),
  // so it is built to degrade instead of squeezing:
  // - The band is exactly chip height (h-9), and the label is clamped to two
  //   lines (line-clamp-2, never `truncate`), so values line up across a grid
  //   row whatever the label length.
  // - The label's flex size is the larger of a floor (5rem; 4rem beside a
  //   ring) and its longest word (w-min + min-w). When that plus the chip
  //   doesn't fit on one line (a 6-column grid, a 4-column grid on a tablet),
  //   the chip wraps to a second line that the band clips. The tile then shows
  //   no chip rather than a label broken mid-word.
  // - break-words only acts if a single word is wider than the whole band.
  const labelEl = (
    <span
      className={
        hasRing
          ? "flex min-h-9 w-min min-w-[min(4rem,100%)] grow items-center"
          : "flex min-h-9 w-min min-w-[min(5rem,100%)] grow items-center"
      }
    >
      <span className="line-clamp-2 min-w-0 break-words text-meta font-semibold uppercase leading-snug tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
    </span>
  );

  return (
    // KPI grids are routinely `grid-cols-2 md:grid-cols-4`, so at 375px a tile
    // is only ~171px wide. p-5 (40px of gutter) plus a 28px money figure like
    // "₹12,45,000" overflowed its own card; the mobile-first values below shrink
    // the padding and type just enough to fit, and `sm:` restores the desktop
    // size.
    <div
      className={cn(
        "group relative overflow-hidden surface-glass rounded-[22px] border border-border p-4 transition-[box-shadow,border-color] duration-200 hover:shadow-card-hover sm:p-5",
        HOVER_EDGE[hue],
        className
      )}
    >
      <div className="relative z-[1] flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          {hasRing ? (
            // Ring tile: the ring holds the top-right slot, so the chip sits
            // left of the label. The label comes first in the DOM so that,
            // when space runs out, the chip is the item that wraps away;
            // row-reverse + justify-end still draws it on the left.
            <div className="flex h-9 flex-row-reverse flex-wrap content-start items-center justify-end gap-x-2 overflow-hidden">
              {labelEl}
              {chip}
            </div>
          ) : (
            // Label top-left, chip top-right.
            <div className="flex h-9 flex-wrap content-start items-center justify-between gap-x-2 overflow-hidden">
              {labelEl}
              {chip}
            </div>
          )}
          {/* break-words, never truncate: a clipped money figure is a wrong
              number, so a long value wraps to a second line instead. */}
          <div className="mt-2.5 break-words text-title font-bold tabular-nums leading-tight tracking-[-0.03em] sm:mt-3 sm:text-h2 sm:leading-none">
            {typeof value === "number" ? <CountUp value={value} /> : value}
          </div>
          {trend?.text ? (
            <p className="mt-2 text-meta font-medium leading-snug">
              <span className={cn("flex items-start gap-1", TREND_TONE[trend.tone] ?? TREND_TONE.neutral)}>
                {trend.tone === "up" && <ArrowUpRight aria-hidden className="mt-px size-3.5 shrink-0" />}
                {trend.tone === "down" && <ArrowDownRight aria-hidden className="mt-px size-3.5 shrink-0" />}
                <span className="min-w-0">{trend.text}</span>
              </span>
            </p>
          ) : null}
          {sub && <p className="mt-2 text-meta leading-snug text-muted-foreground">{sub}</p>}
          {typeof delta === "number" && delta !== 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-meta">
              <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", delta > 0 ? "text-success" : "text-destructive")}>
                {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {delta > 0 ? "+" : ""}{delta}
              </span>
              {deltaLabel && <span className="min-w-0 truncate text-muted-foreground">{deltaLabel}</span>}
            </p>
          )}
        </div>
        {ring !== null && (
          // shrink-0: without it flexbox squeezes the 48px ring into an ellipse
          // when the label column is long. It keeps its full size on mobile —
          // scaling it down would only add whitespace, since the layout still
          // reserves 48px — and the text column absorbs the difference by
          // wrapping instead.
          <span className="block shrink-0">
            <Donut value={ring} size={48} thickness={5} colorClass={RING_TEXT[hue]} ariaLabel={`${pct}% ${label}`} />
          </span>
        )}
      </div>
    </div>
  );
}
