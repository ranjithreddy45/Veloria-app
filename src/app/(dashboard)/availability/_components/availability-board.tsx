"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getAvailabilityGrid, getAvailabilityMonth, type VenueRow, type VenueMonth } from "@/actions/availability.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SLOT_COLS = [
  { key: "MORNING", label: "Morning" },
  { key: "AFTERNOON", label: "Afternoon" },
  { key: "EVENING", label: "Evening" },
  { key: "FULL_DAY", label: "Full Day" },
];

const STATUS_STYLE: Record<string, string> = {
  FREE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  HOLD: "bg-amber-50 text-amber-700 border-amber-200",
  TENTATIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-rose-50 text-rose-700 border-rose-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-slate-50 text-slate-600 border-slate-200",
  BLACKOUT: "bg-zinc-800 text-zinc-100 border-zinc-800",
};

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function heatColor(booked: number, blackout: boolean) {
  if (blackout) return "bg-zinc-700";
  if (booked >= 3) return "bg-rose-500";
  if (booked === 2) return "bg-orange-400";
  if (booked === 1) return "bg-amber-300";
  return "bg-emerald-100";
}

export function AvailabilityBoard({ initialDate }: { initialDate: string }) {
  const [dateISO, setDateISO] = useState(initialDate);
  const [grid, setGrid] = useState<VenueRow[] | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const d0 = new Date(initialDate);
  const [year, setYear] = useState(d0.getFullYear());
  const [month, setMonth] = useState(d0.getMonth() + 1);
  const [monthData, setMonthData] = useState<{ days: number; rows: VenueMonth[] } | null>(null);

  const loadGrid = useCallback(async (iso: string) => {
    setLoadingGrid(true);
    try {
      const res = await getAvailabilityGrid(iso);
      setGrid(res.success ? res.data : []);
    } finally {
      setLoadingGrid(false);
    }
  }, []);

  useEffect(() => { loadGrid(dateISO); }, [dateISO, loadGrid]);
  useEffect(() => {
    getAvailabilityMonth(year, month).then((res) => setMonthData(res.success ? res.data : null));
  }, [year, month]);

  function shiftDay(delta: number) {
    const d = new Date(dateISO);
    d.setDate(d.getDate() + delta);
    setDateISO(isoOf(d));
  }
  function shiftMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  const pretty = new Date(dateISO).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Day grid: venues × slots */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Slot availability — {pretty}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} className="h-8 w-40" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDateISO(isoOf(new Date()))}>Today</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGrid ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !grid || grid.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active venues.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Venue</th>
                    {SLOT_COLS.map((s) => <th key={s.key} className="px-2 py-2 font-medium">{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((v) => (
                    <tr key={v.venueId} className="border-t">
                      <td className="px-2 py-2">
                        <div className="font-medium">{v.venueName}</div>
                        <div className="text-[11px] text-muted-foreground">cap {v.capacity}</div>
                      </td>
                      {SLOT_COLS.map((s) => {
                        const cell = v.slots[s.key];
                        return (
                          <td key={s.key} className="px-1.5 py-1.5">
                            <div className={`rounded-md border px-2 py-1.5 text-xs ${STATUS_STYLE[cell.status] ?? STATUS_STYLE.FREE}`}>
                              <div className="font-semibold">{cell.status === "FREE" ? "Available" : cell.status === "BLACKOUT" ? "Blackout" : cell.status}</div>
                              {cell.label && <div className="truncate opacity-80" title={cell.label}>{cell.label}</div>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month heatmap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Month overview — {monthName}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {!monthData ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium">Venue</th>
                      {Array.from({ length: monthData.days }, (_, i) => (
                        <th key={i} className="w-5 px-0 py-1 text-center font-normal text-muted-foreground">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthData.rows.map((v) => (
                      <tr key={v.venueId}>
                        <td className="sticky left-0 bg-background px-2 py-1 text-xs font-medium whitespace-nowrap">{v.venueName}</td>
                        {v.days.map((d) => (
                          <td key={d.day} className="px-px py-px">
                            <button
                              onClick={() => setDateISO(isoOf(new Date(year, month - 1, d.day)))}
                              title={`${monthName.split(" ")[0]} ${d.day} — ${d.blackout ? "blackout" : d.booked + " slot(s) booked"}`}
                              className={`h-5 w-5 rounded-sm ${heatColor(d.booked, d.blackout)} hover:ring-2 hover:ring-primary`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-100" /> free</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-300" /> 1 slot</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-400" /> 2 slots</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-rose-500" /> full</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-zinc-700" /> blackout</span>
                <span>· click a day to inspect its slots</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
