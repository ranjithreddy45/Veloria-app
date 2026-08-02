import type React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// KanbanBoard — ClickUp-style board: horizontal columns, each with a colored
// status header + count, holding cards. Presentational + generic: you pass the
// grouped columns and a card renderer. Cards use the shared card look with a
// hover lift. Horizontal scroll on overflow so the page body never scrolls.
// ============================================================

export type ColumnHue =
  | "violet"
  | "blue"
  | "amber"
  | "emerald"
  | "teal"
  | "pink"
  | "cyan"
  | "rose"
  | "slate";

const HUE_PILL: Record<ColumnHue, string> = {
  violet: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  blue: "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  teal: "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  pink: "bg-pink-500/12 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
  cyan: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
  rose: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  slate: "bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
};

const HUE_DOT: Record<ColumnHue, string> = {
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export interface KanbanColumn<T> {
  id: string;
  label: string;
  hue?: ColumnHue;
  items: T[];
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, columnId: string) => React.ReactNode;
  /** Stable key for a card. */
  getKey: (item: T) => string;
  /** Shown inside an empty column. */
  emptyLabel?: string;
  className?: string;
}

export function KanbanBoard<T>({
  columns,
  renderCard,
  getKey,
  emptyLabel = "Nothing here",
  className,
}: KanbanBoardProps<T>) {
  return (
    <div className={cn("min-w-0", className)}>
      {/* Affordance: on a phone only the first column and a sliver of the next
          are on screen, and a board with no visible edge reads as "the rest of
          my pipeline is missing". One muted line is cheaper and more honest
          than a gradient mask, which would fade the last column even when the
          board is fully scrolled. */}
      {columns.length > 1 && (
        <p className="mb-2 flex items-center gap-1.5 text-meta text-muted-foreground md:hidden">
          <span aria-hidden>←</span>
          Swipe to see all {columns.length} stages
          <span aria-hidden>→</span>
        </p>
      )}
      {/* Scroll-snap so a swipe lands a column square in the viewport instead
          of parking it half off-screen; `overscroll-x-contain` stops the swipe
          from chaining into the browser's back gesture at the ends. */}
      <div className="snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-1 pb-2 md:snap-none">
        <div className="flex min-w-max gap-4">
        {columns.map((col) => {
          const hue = col.hue ?? "slate";
          return (
            // 82vw on a phone (~307px at 375) deliberately leaves the next
            // column peeking, which is the real "there is more here" cue;
            // capped at the desktop 288px so wide screens are unchanged.
            <div key={col.id} className="flex w-[min(82vw,288px)] shrink-0 snap-start flex-col gap-2.5 sm:w-[288px]">
              <div className="flex items-center gap-2 px-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-semibold",
                    HUE_PILL[hue]
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", HUE_DOT[hue])} />
                  {col.label}
                </span>
                <span className="ml-auto text-meta font-semibold text-muted-foreground">
                  {col.items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-detail text-muted-foreground/70">
                    {emptyLabel}
                  </div>
                ) : (
                  col.items.map((item) => (
                    <div
                      key={getKey(item)}
                      className="rounded-xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_8px_24px_oklch(0_0_0/0.09)]"
                    >
                      {renderCard(item, col.id)}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
