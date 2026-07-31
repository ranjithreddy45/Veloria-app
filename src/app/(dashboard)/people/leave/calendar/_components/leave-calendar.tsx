"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Leave {
  id: string; startDate: string; endDate: string;
  leaveType: { code: string; color: string };
  employee: { id: string; firstName: string; lastName: string };
}
interface Holiday { id: string; date: string; name: string }

const HUE_DOT: Record<string, string> = {
  blue: "bg-blue-500", rose: "bg-rose-500", emerald: "bg-emerald-500", violet: "bg-violet-500",
  pink: "bg-pink-500", slate: "bg-slate-500", amber: "bg-amber-500",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export function LeaveCalendar({
  year, month, holidays, leaves,
}: {
  year: number; month: number; holidays: Holiday[]; leaves: Leave[];
}) {
  const router = useRouter();

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const holidayByDay = new Map<string, string>();
  holidays.forEach((h) => holidayByDay.set(h.date.slice(0, 10), h.name));

  function leavesOn(dayIso: string) {
    const day = new Date(dayIso + "T00:00:00.000Z");
    return leaves.filter((l) => {
      const s = new Date(l.startDate); const e = new Date(l.endDate);
      return s <= day && day <= e;
    });
  }

  function go(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    router.replace(`/people/leave/calendar?year=${y}&month=${m}`);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border bg-card">
      {/* Month title + Prev/Today/Next (44px each on touch) is tight at 375px;
        * wrapping keeps the Next arrow inside the card. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
        <h3 className="text-[15px] font-semibold">{MONTHS[month]} {year}</h3>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="size-8" onClick={() => go(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { const now = new Date(); router.replace(`/people/leave/calendar?year=${now.getUTCFullYear()}&month=${now.getUTCMonth()}`); }}>Today</Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => go(1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-center text-[11.5px] font-medium text-muted-foreground">
        {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-24 border-b border-r bg-muted/20" />;
          const iso = ymd(new Date(Date.UTC(year, month, d)));
          const dow = new Date(Date.UTC(year, month, d)).getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const holiday = holidayByDay.get(iso);
          const onLeave = leavesOn(iso);
          return (
            <div key={i} className={cn("min-h-24 border-b border-r p-1.5", isWeekend && "bg-muted/30", holiday && "bg-warning/10")}>
              <div className="flex items-center justify-between">
                <span className={cn("text-[12px] font-medium", isWeekend && "text-muted-foreground")}>{d}</span>
              </div>
              {holiday && <div className="mt-0.5 truncate text-[10px] font-medium text-warning" title={holiday}>{holiday}</div>}
              <div className="mt-1 space-y-0.5">
                {onLeave.slice(0, 3).map((l) => (
                  <div key={l.id} className="flex items-center gap-1 truncate text-[10.5px]" title={`${l.employee.firstName} ${l.employee.lastName} · ${l.leaveType.code}`}>
                    <span className={cn("inline-block size-1.5 shrink-0 rounded-full", HUE_DOT[l.leaveType.color] ?? "bg-zinc-500")} />
                    <span className="truncate">{l.employee.firstName} {l.employee.lastName[0]}.</span>
                  </div>
                ))}
                {onLeave.length > 3 && <div className="text-[10px] text-muted-foreground">+{onLeave.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
