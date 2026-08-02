"use client";

import * as React from "react";
import { Download, Timer, LogOut, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getLateEarly,
  type LateEarlyReport,
} from "@/actions/hr-report-attendance.actions";
import { DateRangeControls, StatusBadge, MethodNote } from "../../_components/shared";
import { fmtDay, fmtDayIso, fmtTimeIst, fmtHm, fmtMinuteClock } from "../../_lib/format";

/** "HH:MM" clock input → minutes-since-midnight, or null if malformed. */
function clockToMin(v: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min < 1440 ? min : null;
}

export function LateEarlyView({
  initialFrom,
  initialTo,
  initial,
}: {
  initialFrom: string;
  initialTo: string;
  initial: LateEarlyReport | null;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [expIn, setExpIn] = React.useState(
    fmtMinuteClock(initial?.expectedInMin ?? 9 * 60 + 30),
  );
  const [expOut, setExpOut] = React.useState(
    fmtMinuteClock(initial?.expectedOutMin ?? 18 * 60),
  );
  const [data, setData] = React.useState<LateEarlyReport | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(
    (f: string, t: string, inClk: string, outClk: string) => {
      setFrom(f);
      setTo(t);
      setLoading(true);
      getLateEarly({
        from: f,
        to: t,
        expectedInMin: clockToMin(inClk) ?? undefined,
        expectedOutMin: clockToMin(outClk) ?? undefined,
      })
        .then(setData)
        .finally(() => setLoading(false));
    },
    [],
  );

  const rows = data?.rows ?? [];

  function handleExport() {
    if (!data) return;
    const headers = [
      "Date", "Employee", "Emp Code", "Status", "Check-in (IST)", "Check-out (IST)",
      "Worked", "Late by (min)", "Early-out by (min)", "Short day",
    ];
    const body = rows.map((r) => [
      fmtDayIso(r.date), r.name, r.empCode, r.status,
      fmtTimeIst(r.checkInAt), fmtTimeIst(r.checkOutAt), fmtHm(r.workedMinutes),
      r.lateInMinutes || "", r.earlyOutMinutes || "", r.isShortDay ? "Yes" : "",
    ]);
    downloadCSV(`attendance-late-early-${data.from}_to_${data.to}.csv`, toCSV(headers, body));
  }

  const t = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <DateRangeControls from={from} to={to} onApply={(f, tt) => load(f, tt, expIn, expOut)} loading={loading} />
          <label className="flex flex-col gap-1">
            <span className="text-meta font-medium text-muted-foreground">Expected in</span>
            <Input type="time" value={expIn} onChange={(e) => setExpIn(e.target.value)} className="h-9 w-[7.5rem]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta font-medium text-muted-foreground">Expected out</span>
            <Input type="time" value={expOut} onChange={(e) => setExpOut(e.target.value)} className="h-9 w-[7.5rem]" />
          </label>
          <Button size="sm" variant="secondary" className="h-9" disabled={loading} onClick={() => load(from, to, expIn, expOut)}>
            Recalculate
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <MethodNote>
        <strong>What &quot;late&quot; means here:</strong> this org has no per-employee shift roster joinable to a punch, so
        &quot;late&quot; is <em>not</em> graded against an individual shift. It is measured against a single, org-wide
        expected clock window — currently in by <strong>{data ? fmtMinuteClock(data.expectedInMin) : expIn}</strong> and
        out by <strong>{data ? fmtMinuteClock(data.expectedOutMin) : expOut}</strong> (IST), which you can change above.
        A day is also marked <strong>short</strong> when worked time is under {data ? fmtHm(data.shortDayMin) : "4h"}.
        Treat these as eyeball aids, not a payroll-grade verdict.
      </MethodNote>

      {t && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Late arrivals" value={t.late} accent="amber" icon={<Timer />} sub={`After ${data ? fmtMinuteClock(data.expectedInMin) : ""} IST`} />
          <StatTile label="Early departures" value={t.earlyOut} accent="rose" icon={<LogOut />} sub={`Before ${data ? fmtMinuteClock(data.expectedOutMin) : ""} IST`} />
          <StatTile label="Short days" value={t.shortDay} accent="red" icon={<Hourglass />} sub={`Worked under ${data ? fmtHm(data.shortDayMin) : ""}`} />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        {rows.length === 0 ? (
          <EmptyState icon={<Timer />} title="Nobody late or short here" description="Every worked day in this range met the expected window. Adjust the window or range to review more." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b text-left text-meta uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">In</th>
                  <th className="px-3 py-2.5 font-medium">Out</th>
                  <th className="px-3 py-2.5 text-right font-medium">Worked</th>
                  <th className="px-3 py-2.5 pr-5 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-2.5 whitespace-nowrap tabular-nums">{fmtDay(r.date)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-meta text-muted-foreground">{r.empCode}</div>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtTimeIst(r.checkInAt) || "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtTimeIst(r.checkOutAt) || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtHm(r.workedMinutes)}</td>
                    <td className="px-3 py-2.5 pr-5">
                      <div className="flex flex-wrap gap-1">
                        {r.isLate && <StatusPill label={`Late ${r.lateInMinutes}m`} hue="amber" size="xs" />}
                        {r.isEarlyOut && <StatusPill label={`Early ${r.earlyOutMinutes}m`} hue="rose" size="xs" />}
                        {r.isShortDay && <StatusPill label="Short" hue="red" size="xs" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
