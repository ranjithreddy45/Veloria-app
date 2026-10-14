"use client";

import * as React from "react";
import type { CalendarDay, CalendarItem } from "@/lib/venue-owner/portal-data";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_SHORT,
  countLabel,
  countWord,
  eventTypeLabel,
  guestsLabel,
  longDate,
  monthGrid,
  monthTitle,
  type CountKind,
} from "../../../_lib/portal-params";

// ============================================================
// OwnerCalendar — the venue owner's month grid (counts per date).
// ------------------------------------------------------------
// Props are plain data from the server page: per-date counts, and per-date
// items carrying only kind / slot / event type / guest count / venue name.
// Nothing here can fetch, so nothing here can ask for another venue.
//
// Grid markup follows the staff booking calendar: Sunday first, padding days
// from the neighbouring months, a 68px cell with coloured dots on phones (a
// 7-column grid leaves ~49px per cell at 375px) and a 112px cell with count
// chips. The switch is at lg, not sm as on the staff calendar: measured, a
// 640px grid cut "2 booked" to "2 book…" and a 768px one "12 enquiries" to
// "12 enquiri…"; dots carry the same numbers. One selected-day state drives
// the detail panel, which sits under the grid and beside it from xl (beside
// it any earlier and the cells are too narrow for the chips).
//
// Keyboard: the days are one tab stop (roving tabindex); arrows move a day or
// a week and select as they go, Home/End jump to the 1st/last.
// ============================================================

interface OwnerCalendarProps {
  year: number;
  month: number;
  days: Record<string, CalendarDay>;
  /** Today's India date, yyyy-mm-dd. */
  today: string;
}

const KIND_LABEL: Record<CalendarItem["kind"], string> = {
  booking: "Booked",
  hold: "On hold",
  lead: "Enquiry",
};

const KIND_HUE: Record<CalendarItem["kind"], Hue> = {
  booking: "emerald",
  hold: "amber",
  lead: "sky",
};

// Full literals so Tailwind generates them, and never merged through cn():
// tailwind-merge reads text-meta / text-detail as a text colour and drops the
// size when a colour follows. Enquiries are dashed: they are interest, not a
// held date.
const CHIP: Record<CountKind, string> = {
  booking:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  hold: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300",
  lead: "border-dashed border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-300",
};

const DOT: Record<CountKind, string> = {
  booking: "bg-emerald-500",
  hold: "bg-amber-500",
  lead: "bg-sky-400",
};

/** Cell below lg: a dot and the number. */
const DOT_COUNT = "inline-flex items-center gap-0.5 text-meta font-semibold leading-none tabular-nums";
const DOT_COUNT_KIND: Record<CountKind, string> = {
  booking: `${DOT_COUNT} text-emerald-700 dark:text-emerald-300`,
  hold: `${DOT_COUNT} text-amber-700 dark:text-amber-300`,
  lead: `${DOT_COUNT} text-sky-700 dark:text-sky-300`,
};

/** Cell from lg: a chip with the number and the word. */
const CHIP_COUNT = "flex min-w-0 items-baseline gap-1 rounded-md border px-1.5 py-[3px] text-meta font-medium leading-tight";
const CHIP_COUNT_KIND: Record<CountKind, string> = {
  booking: `${CHIP_COUNT} ${CHIP.booking}`,
  hold: `${CHIP_COUNT} ${CHIP.hold}`,
  lead: `${CHIP_COUNT} ${CHIP.lead}`,
};

const DAY_NUMBER =
  "inline-flex size-6 items-center justify-center rounded-full text-detail tabular-nums sm:size-7 sm:text-body";
const DAY_NUMBER_PLAIN = `${DAY_NUMBER} font-medium text-foreground`;
const DAY_NUMBER_TODAY = `${DAY_NUMBER} bg-primary font-semibold text-primary-foreground`;

function countsOf(d: CalendarDay | undefined): { kind: CountKind; n: number }[] {
  if (!d) return [];
  return (
    [
      { kind: "booking", n: d.bookings },
      { kind: "hold", n: d.holds },
      { kind: "lead", n: d.leads },
    ] as const
  ).filter((c) => c.n > 0);
}

function dayAriaLabel(key: string, d: CalendarDay | undefined): string {
  const counts = countsOf(d);
  if (counts.length === 0) return `${longDate(key)}: nothing on this date`;
  return `${longDate(key)}: ${counts.map((c) => countLabel(c.kind, c.n)).join(", ")}`;
}

export function OwnerCalendar({ year, month, days, today }: OwnerCalendarProps) {
  const cells = React.useMemo(() => monthGrid(year, month), [year, month]);
  const monthKeys = React.useMemo(() => cells.filter((c) => c.inMonth).map((c) => c.key), [cells]);
  const todayInMonth = monthKeys.includes(today);

  const [selected, setSelected] = React.useState<string | null>(todayInMonth ? today : null);
  const cellRefs = React.useRef(new Map<string, HTMLDivElement>());
  const panelRef = React.useRef<HTMLElement>(null);

  // The one day in the tab order.
  const tabStop = selected ?? (todayInMonth ? today : monthKeys[0]);

  function choose(key: string) {
    setSelected(key);
    // Below xl the panel is under the grid, often below the fold on a phone.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, key: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(key);
      return;
    }
    const i = monthKeys.indexOf(key);
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let to: number | null = null;
    if (e.key in step) to = i + step[e.key];
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = monthKeys.length - 1;
    if (to === null) return;
    e.preventDefault();
    const target = monthKeys[Math.max(0, Math.min(monthKeys.length - 1, to))];
    setSelected(target);
    cellRefs.current.get(target)?.focus();
  }

  const selectedDay = selected ? days[selected] : undefined;

  return (
    <div className="space-y-3">
      {/* Legend: dots below lg (as in the cells), chips from lg. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-detail text-muted-foreground">
        {(["booking", "hold", "lead"] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full lg:hidden", DOT[kind])} />
            <span aria-hidden className={cn("hidden size-3 rounded border lg:inline-block", CHIP[kind])} />
            {kind === "booking" ? "Booked (advance paid)" : kind === "hold" ? "On hold (not yet confirmed)" : "Enquiry (asked about)"}
          </span>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="min-w-0 overflow-hidden surface-glass rounded-[22px]">
          <div className="grid grid-cols-7 border-b bg-muted/30" aria-hidden>
            {WEEKDAY_SHORT.map((d) => (
              <div
                key={d}
                className="px-0.5 py-2 text-center text-meta font-medium uppercase tracking-normal text-muted-foreground sm:px-2 sm:py-2.5 sm:tracking-[0.08em]"
              >
                {d}
              </div>
            ))}
          </div>

          <div role="group" aria-label={monthTitle({ year, month })} className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const lastInRow = (i + 1) % 7 === 0;
              if (!cell.inMonth) {
                return (
                  <div
                    key={cell.key}
                    aria-hidden
                    className={cn(
                      "min-h-[68px] border-b border-r bg-muted/30 p-1 sm:p-2 lg:min-h-[112px]",
                      lastInRow && "border-r-0"
                    )}
                  >
                    <span className="inline-flex size-6 items-center justify-center text-detail tabular-nums text-muted-foreground/40 sm:size-7 sm:text-body">
                      {cell.day}
                    </span>
                  </div>
                );
              }

              const d = days[cell.key];
              const counts = countsOf(d);
              const isSelected = cell.key === selected;
              const isToday = cell.key === today;

              return (
                <div
                  key={cell.key}
                  ref={(el) => {
                    if (el) cellRefs.current.set(cell.key, el);
                    else cellRefs.current.delete(cell.key);
                  }}
                  role="button"
                  tabIndex={cell.key === tabStop ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={dayAriaLabel(cell.key, d)}
                  onClick={() => choose(cell.key)}
                  onKeyDown={(e) => onKeyDown(e, cell.key)}
                  className={cn(
                    // min-h stays a utility so it beats the 44px coarse-pointer
                    // floor in globals.css (that one is a base-layer minimum).
                    "relative min-h-[68px] cursor-pointer border-b border-r p-1 outline-none transition-colors sm:p-2 lg:min-h-[112px]",
                    "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isSelected && "bg-primary/[0.06] ring-1 ring-inset ring-primary/30",
                    lastInRow && "border-r-0"
                  )}
                >
                  <span className={isToday ? DAY_NUMBER_TODAY : DAY_NUMBER_PLAIN}>
                    {cell.day}
                  </span>

                  {counts.length > 0 && (
                    <>
                      {/* Below lg: a coloured dot and the number per kind. */}
                      <div aria-hidden className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5 lg:hidden">
                        {counts.map((c) => (
                          <span key={c.kind} className={DOT_COUNT_KIND[c.kind]}>
                            <span className={cn("size-1.5 shrink-0 rounded-full", DOT[c.kind])} />
                            {c.n}
                          </span>
                        ))}
                      </div>
                      {/* lg and up: a chip per kind. The number never truncates;
                          only the word could, on the narrowest grid. */}
                      <div aria-hidden className="mt-1.5 hidden space-y-1 lg:block">
                        {counts.map((c) => (
                          <div key={c.kind} className={CHIP_COUNT_KIND[c.kind]}>
                            <span className="shrink-0 font-semibold tabular-nums">{c.n}</span>
                            <span className="min-w-0 truncate">{countWord(c.kind, c.n)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail. aria-live so a screen reader hears the day it picked. */}
        <section
          ref={panelRef}
          aria-live="polite"
          aria-label="Selected date"
          className="scroll-mt-24 surface-glass rounded-[22px] p-4 sm:p-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto"
        >
          {selected ? (
            <>
              <h3 className="text-lede font-semibold tracking-[-0.01em]">{longDate(selected)}</h3>
              {!selectedDay || selectedDay.items.length === 0 ? (
                <p className="mt-2 text-body text-muted-foreground">Nothing on this date.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/70">
                  {selectedDay.items.map((item, idx) => {
                    const details = [item.slot, guestsLabel(item.guests), item.venue].filter(Boolean).join(" · ");
                    return (
                      // Items carry no id (by design), so position is the key;
                      // the list is static for the selected day.
                      <li key={idx} className="flex items-start gap-3 py-3">
                        <span className="w-[76px] shrink-0 pt-0.5">
                          <StatusPill label={KIND_LABEL[item.kind]} hue={KIND_HUE[item.kind]} size="xs" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-copy font-medium text-foreground">
                            {eventTypeLabel(item.eventType) ?? "Event type not given"}
                          </p>
                          <p className="break-words text-detail text-muted-foreground">{details || "Slot and guest count not given"}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="text-body text-muted-foreground">Choose a date to see what is on it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
