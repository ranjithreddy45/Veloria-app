"use client";

import * as React from "react";
import { Download, Users, CalendarCheck, UserX, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getMonthlySummary,
  type MonthlySummary,
} from "@/actions/hr-report-attendance.actions";
import { MonthControls } from "../../_components/shared";
import { MONTHS, fmtHm, hoursDecimal } from "../../_lib/format";

export function MonthlySummaryView({
  initialFy,
  initialMonth,
  initial,
}: {
  initialFy: string;
  initialMonth: number;
  initial: MonthlySummary | null;
}) {
  const [fy, setFy] = React.useState(initialFy);
  const [month, setMonth] = React.useState(initialMonth);
  const [data, setData] = React.useState<MonthlySummary | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback((f: string, m: number) => {
    setFy(f);
    setMonth(m);
    setLoading(true);
    getMonthlySummary({ fy: f, month: m })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows ?? [];

  function handleExport() {
    if (!data) return;
    const headers = [
      "Employee", "Emp Code", "Department", "Present", "Absent", "Half-day",
      "WFH", "On leave", "Holiday", "Week-off", "Recorded days", "Worked hours",
    ];
    const body = rows.map((r) => [
      r.name, r.empCode, r.department ?? "", r.present, r.absent, r.halfDay,
      r.wfh, r.onLeave, r.holiday, r.weekend, r.recordedDays, hoursDecimal(r.workedMinutes),
    ]);
    downloadCSV(
      `attendance-monthly-summary-${data.fy}-${String(data.month).padStart(2, "0")}.csv`,
      toCSV(headers, body),
    );
  }

  const t = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthControls fy={fy} month={month} onChange={load} loading={loading} />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {t && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Employees" value={t.headcount} accent="blue" icon={<Users />} sub={`${MONTHS[month - 1]} ${data?.year}`} />
          <StatTile label="Present days" value={t.present} accent="emerald" icon={<CalendarCheck />} sub={`+${t.halfDay} half · +${t.wfh} WFH`} />
          <StatTile label="Absent days" value={t.absent} accent="rose" icon={<UserX />} sub={`${t.onLeave} on leave`} />
          <StatTile label="Worked hours" value={Math.round(t.workedMinutes / 60)} accent="amber" icon={<Clock />} sub="Across all employees" />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">Per-employee tally</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Counts are days recorded with each status in the selected month. Worked hours sum the recorded workedMinutes.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<CalendarCheck />} title="No attendance in this month" description="Pick another month, or once punches are posted they tally here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 text-right font-medium">Present</th>
                  <th className="px-3 py-2.5 text-right font-medium">Absent</th>
                  <th className="px-3 py-2.5 text-right font-medium">Half</th>
                  <th className="px-3 py-2.5 text-right font-medium">WFH</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leave</th>
                  <th className="px-3 py-2.5 text-right font-medium">Holiday</th>
                  <th className="px-3 py-2.5 text-right font-medium">Week-off</th>
                  <th className="px-3 py-2.5 pr-5 text-right font-medium">Worked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {r.empCode}{r.department ? ` · ${r.department}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-300">{r.present}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-300">{r.absent || ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.halfDay || ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.wfh || ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.onLeave || ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.holiday || ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.weekend || ""}</td>
                    <td className="px-3 py-2.5 pr-5 text-right tabular-nums font-medium">{fmtHm(r.workedMinutes)}</td>
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
