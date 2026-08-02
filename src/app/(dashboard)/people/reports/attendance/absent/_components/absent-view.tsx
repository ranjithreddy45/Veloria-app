"use client";

import * as React from "react";
import { Download, UserX, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getAbsentReport,
  type AbsentReport,
} from "@/actions/hr-report-attendance.actions";
import { DateRangeControls, MethodNote } from "../../_components/shared";
import { fmtDay, fmtDayIso } from "../../_lib/format";

export function AbsentView({
  initialFrom,
  initialTo,
  initial,
}: {
  initialFrom: string;
  initialTo: string;
  initial: AbsentReport | null;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [data, setData] = React.useState<AbsentReport | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback((f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setLoading(true);
    getAbsentReport({ from: f, to: t })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows ?? [];

  function handleExport() {
    if (!data) return;
    const headers = ["Date", "Employee", "Emp Code", "Department", "Regularized", "Note"];
    const body = rows.map((r) => [
      fmtDayIso(r.date), r.name, r.empCode, r.department ?? "",
      r.isRegularized ? "Yes" : "No", r.note ?? "",
    ]);
    downloadCSV(`attendance-absent-${data.from}_to_${data.to}.csv`, toCSV(headers, body));
  }

  const t = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeControls from={from} to={to} onApply={load} loading={loading} />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <MethodNote>
        This lists rows explicitly marked <strong>ABSENT</strong> in the range. Days with <em>no record at all</em> are
        deliberately <strong>not</strong> inferred as absent — without an authoritative per-employee working-day /
        holiday calendar, a missing row could equally be a week-off, holiday or simply un-posted attendance. Use the
        Monthly Summary to spot coverage gaps.
      </MethodNote>

      {t && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Absent days" value={t.total} accent="red" icon={<UserX />} sub="In selected range" />
          <StatTile label="Employees affected" value={t.employees} accent="amber" icon={<Users />} sub="Distinct people" />
          <StatTile label="Regularized" value={t.regularized} accent="emerald" icon={<CheckCircle2 />} sub="Since corrected" />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        {rows.length === 0 ? (
          <EmptyState icon={<UserX />} title="No absences recorded" description="No ABSENT rows in this range. Widen the range to look further back." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b text-left text-meta uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Department</th>
                  <th className="px-3 py-2.5 font-medium">Regularized</th>
                  <th className="px-3 py-2.5 pr-5 font-medium">Note</th>
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
                    <td className="px-3 py-2.5">{r.department ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {r.isRegularized
                        ? <StatusPill label="Regularized" hue="emerald" size="xs" />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 pr-5 max-w-[20rem] text-detail text-muted-foreground">{r.note ?? ""}</td>
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
