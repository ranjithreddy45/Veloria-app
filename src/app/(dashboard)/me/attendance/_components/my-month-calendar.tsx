"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMyAttendance } from "@/actions/hr-attendance.actions";

// ============================================================
// My Month Calendar — employee self-service attendance grid.
// ------------------------------------------------------------
// A real month calendar (Mon..Sun) colour-coded by AttendanceStatus.
// Colours MIRROR the admin muster grid so the two views agree.
// Everything is computed in UTC because AttendanceRecord.date is
// stored at UTC midnight — using local getDate()/getDay() would
// shift a day across timezones.
// ============================================================

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "WFH"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "WEEKEND";

/** Serialisable day record passed server → client (Dates as ISO strings). */
export interface MyAttendanceDay {
  date: string; // ISO instant (UTC midnight of the day)
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number;
}

// Colour map mirrors people/attendance/muster STATUS_META.
const STATUS_META: Record<AttendanceStatus, { label: string; cell: string }> = {
  PRESENT:  { label: "Present",   cell: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  WFH:      { label: "WFH",       cell: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" },
  HALF_DAY: { label: "Half day",  cell: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  ON_LEAVE: { label: "On leave",  cell: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  ABSENT:   { label: "Absent",    cell: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  HOLIDAY:  { label: "Holiday",   cell: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  WEEKEND:  { label: "Weekend",   cell: "bg-muted text-muted-foreground" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format an ISO instant as IST clock time, e.g. "3:42 PM". */
function istTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function workedLabel(min: number): string {
  if (min <= 0) return "—";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** Convert action records (Date-or-string fields) to serialisable days. */
function normalize(records: ReadonlyArray<{
  date: Date | string;
  status: string;
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
  workedMinutes: number;
}>): MyAttendanceDay[] {
  return records.map((r) => ({
    date: new Date(r.date).toISOString(),
    status: r.status as AttendanceStatus,
    checkInAt: r.checkInAt ? new Date(r.checkInAt).toISOString() : null,
    checkOutAt: r.checkOutAt ? new Date(r.checkOutAt).toISOString() : null,
    workedMinutes: r.workedMinutes,
  }));
}

export function MyMonthCalendar({
  initialYear,
  initialMonth,
  initialRecords,
}: {
  initialYear: number;
  /** 0-indexed month, matching getMyAttendance / getUTCMonth. */
  initialMonth: number;
  initialRecords: MyAttendanceDay[];
}) {
  const [year, setYear] = React.useState(initialYear);
  const [month, setMonth] = React.useState(initialMonth); // 0-indexed
  const [records, setRecords] = React.useState<MyAttendanceDay[]>(initialRecords);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Current UTC day, used for the "today" ring and future guards.
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth();
  const curD = now.getUTCDate();

  const isCurrentMonth = year === curY && month === curM;
  const isFutureMonth = year > curY || (year === curY && month > curM);

  // Map day-of-month → record, keyed by the record's UTC date.
  const byDay = React.useMemo(() => {
    const map = new Map<number, MyAttendanceDay>();
    for (const r of records) {
      const d = new Date(r.date);
      map.set(d.getUTCDate(), r);
    }
    return map;
  }, [records]);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Weekday of the 1st, converted to Monday-first (0 = Mon … 6 = Sun).
  const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  function go(nextYear: number, nextMonth: number) {
    // Never navigate beyond the current month.
    if (nextYear > curY || (nextYear === curY && nextMonth > curM)) return;
    setSelected(null);
    startTransition(async () => {
      const data = await getMyAttendance(nextYear, nextMonth);
      setYear(nextYear);
      setMonth(nextMonth);
      if (data && "linked" in data && data.linked && Array.isArray(data.records)) {
        setRecords(normalize(data.records));
      } else {
        setRecords([]);
      }
    });
  }

  function prev() {
    const m = month - 1;
    if (m < 0) go(year - 1, 11);
    else go(year, m);
  }
  function next() {
    if (isCurrentMonth) return; // guard: no future
    const m = month + 1;
    if (m > 11) go(year + 1, 0);
    else go(year, m);
  }
  function today() {
    if (isCurrentMonth) return;
    go(curY, curM);
  }

  const nextDisabled = isCurrentMonth || isFutureMonth || pending;

  // Build the grid cells: leading blanks + one per day.
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  const selectedRec = selected != null ? byDay.get(selected) ?? null : null;

  return (
    <Card className="p-4 sm:p-5">
      {/* Header + navigation */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
            <CalendarDays className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              {MONTH_NAMES[month]} {year}
            </h2>
            <p className="text-[11.5px] text-muted-foreground">My attendance calendar</p>
          </div>
          {pending && <Loader2 className="ml-1 size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={today} disabled={isCurrentMonth || pending}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={prev} disabled={pending} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={next} disabled={nextDisabled} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (c.day == null) return <div key={`b${i}`} aria-hidden />;
          const day = c.day;
          const rec = byDay.get(day) ?? null;
          const meta = rec ? STATUS_META[rec.status] : null;
          const isToday = year === curY && month === curM && day === curD;
          const isFuture = year > curY || (year === curY && month > curM) || (isCurrentMonth && day > curD);
          const isSelected = selected === day;

          const title = rec
            ? `${meta?.label ?? rec.status}${rec.checkInAt ? ` · In ${istTime(rec.checkInAt)}` : ""}${rec.checkOutAt ? ` · Out ${istTime(rec.checkOutAt)}` : ""}${rec.workedMinutes > 0 ? ` · ${workedLabel(rec.workedMinutes)}` : ""}`
            : isFuture
              ? undefined
              : "No record";

          return (
            <button
              key={day}
              type="button"
              title={title}
              onClick={() => setSelected(isSelected ? null : day)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition",
                meta ? meta.cell : "bg-transparent text-muted-foreground",
                meta ? "border-transparent" : "border-dashed border-border",
                isFuture && !meta && "opacity-40",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                isToday && !isSelected && "ring-2 ring-violet-400 ring-offset-1 ring-offset-background dark:ring-violet-500",
                "hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <span className={cn("font-semibold tabular-nums", isToday && "underline underline-offset-2")}>
                {day}
              </span>
              {rec && rec.workedMinutes > 0 && (
                <span className="mt-0.5 hidden text-[9.5px] leading-none opacity-80 sm:block">
                  {workedLabel(rec.workedMinutes)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected-day detail line */}
      {selectedRec ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-[12.5px]">
          <span className="font-medium">
            {new Date(selectedRec.date).toLocaleDateString("en-IN", {
              weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
            })}
          </span>
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", STATUS_META[selectedRec.status].cell)}>
            {STATUS_META[selectedRec.status].label}
          </span>
          <span className="text-muted-foreground">
            In: <span className="tabular-nums text-foreground">{selectedRec.checkInAt ? istTime(selectedRec.checkInAt) : "—"}</span>
          </span>
          <span className="text-muted-foreground">
            Out: <span className="tabular-nums text-foreground">{selectedRec.checkOutAt ? istTime(selectedRec.checkOutAt) : "—"}</span>
          </span>
          <span className="text-muted-foreground">
            Worked: <span className="tabular-nums text-foreground">{workedLabel(selectedRec.workedMinutes)}</span>
          </span>
        </div>
      ) : selected != null ? (
        <div className="mt-3 rounded-lg border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
          No attendance recorded for day {selected}.
        </div>
      ) : null}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11.5px] text-muted-foreground">
        {(Object.keys(STATUS_META) as AttendanceStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block size-3 rounded", STATUS_META[k].cell)} />
            {STATUS_META[k].label}
          </span>
        ))}
      </div>
    </Card>
  );
}
