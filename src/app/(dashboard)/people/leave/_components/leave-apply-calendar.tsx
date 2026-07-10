"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHolidays } from "@/actions/hr-leave.actions";

// ============================================================
// Click-a-date apply calendar (employee self-service).
// ------------------------------------------------------------
// Everything is computed in UTC (Date.UTC / getUTC*) so a day never shifts
// across the viewer's timezone — LeaveRequest and Holiday dates are stored at
// UTC midnight, and this must line up with them exactly.
// Click a day to set the range start, click a second day to set the end (a
// second click before the start restarts the selection). Weekends (Sat/Sun)
// and holidays are greyed and not selectable. Completing a range calls back to
// open the existing Apply-leave dialog, prefilled.
// ============================================================

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// yyyy-mm-dd key for a UTC calendar day.
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function LeaveApplyCalendar({
  onSelectRange,
}: {
  onSelectRange: (start: string, end: string) => void;
}) {
  const now = new Date();
  const [view, setView] = React.useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
  const [start, setStart] = React.useState<string | null>(null);
  const [end, setEnd] = React.useState<string | null>(null);

  // Holiday date-keys per year, lazily fetched and cached.
  const [holidaysByYear, setHolidaysByYear] = React.useState<Record<number, Set<string>>>({});
  React.useEffect(() => {
    let cancelled = false;
    if (holidaysByYear[view.year]) return;
    getHolidays(view.year).then((rows) => {
      if (cancelled) return;
      const keys = new Set(rows.map((h) => new Date(h.date).toISOString().slice(0, 10)));
      setHolidaysByYear((prev) => ({ ...prev, [view.year]: keys }));
    });
    return () => { cancelled = true; };
  }, [view.year, holidaysByYear]);

  const holidayKeys = holidaysByYear[view.year] ?? new Set<string>();
  const todayKey = ymd(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Build the month grid (leading blanks + days).
  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function move(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  function dayMeta(day: number) {
    const key = ymd(view.year, view.month, day);
    const weekday = new Date(Date.UTC(view.year, view.month, day)).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = holidayKeys.has(key);
    return { key, isWeekend, isHoliday, disabled: isWeekend || isHoliday };
  }

  function pick(key: string) {
    // Fresh selection, or extend an in-progress one.
    if (!start || (start && end)) {
      setStart(key);
      setEnd(null);
      return;
    }
    // start set, end not yet chosen
    if (key < start) {
      setStart(key); // clicked earlier → restart from there
      return;
    }
    setEnd(key);
    onSelectRange(start, key);
  }

  function inRange(key: string): boolean {
    if (start && end) return key >= start && key <= end;
    return key === start;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold">
          {MONTHS[view.month]} {view.year}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-[12px]"
            onClick={() => setView({ year: now.getUTCFullYear(), month: now.getUTCMonth() })}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => move(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-[11px] font-medium text-muted-foreground">{w}</div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`b${i}`} />;
          const { key, isWeekend, isHoliday, disabled } = dayMeta(day);
          const selected = inRange(key);
          const isStart = key === start;
          const isEnd = key === end;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => pick(key)}
              title={isHoliday ? "Holiday" : isWeekend ? "Weekend" : undefined}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                disabled && "cursor-not-allowed text-muted-foreground/40 line-through",
                !disabled && !selected && "hover:bg-muted",
                selected && "bg-primary/15 text-foreground",
                (isStart || isEnd) && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                isToday && !selected && "ring-1 ring-inset ring-primary/40",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Selected</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted-foreground/30" /> Weekend / holiday</span>
        <span>Click a day to start, click another to set the range.</span>
      </div>
    </div>
  );
}
