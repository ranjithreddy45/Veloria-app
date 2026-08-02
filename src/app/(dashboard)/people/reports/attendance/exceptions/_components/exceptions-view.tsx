"use client";

import * as React from "react";
import { Download, ShieldAlert, MapPinOff, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getExceptions,
  type ExceptionReport,
} from "@/actions/hr-report-attendance.actions";
import { DateRangeControls, StatusBadge, YesNoBadge, MethodNote } from "../../_components/shared";
import { fmtDay, fmtDayIso, fmtTimeIst } from "../../_lib/format";

function accuracyLabel(m: number | null): string {
  if (m == null) return "—";
  return `±${Math.round(m)}m`;
}

export function ExceptionsView({
  initialFrom,
  initialTo,
  initial,
}: {
  initialFrom: string;
  initialTo: string;
  initial: ExceptionReport | null;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [data, setData] = React.useState<ExceptionReport | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback((f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setLoading(true);
    getExceptions({ from: f, to: t })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows ?? [];

  function handleExport() {
    if (!data) return;
    const headers = [
      "Date", "Employee", "Emp Code", "Status", "Flagged", "Flag reason",
      "Location verified", "Check-out verified", "Accuracy (m)", "Site",
      "Check-in (IST)", "Visit type", "Regularized",
    ];
    const body = rows.map((r) => [
      fmtDayIso(r.date), r.name, r.empCode, r.status,
      r.flagged ? "Yes" : "No", r.flagReason ?? "",
      r.locationVerified == null ? "" : r.locationVerified ? "Yes" : "No",
      r.checkOutVerified == null ? "" : r.checkOutVerified ? "Yes" : "No",
      r.accuracyM == null ? "" : Math.round(r.accuracyM),
      r.siteName ?? "", fmtTimeIst(r.checkInAt), r.visitType ?? "",
      r.isRegularized ? "Yes" : "No",
    ]);
    downloadCSV(`attendance-exceptions-${data.from}_to_${data.to}.csv`, toCSV(headers, body));
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
        An exception is any punch that is <strong>flagged</strong> for review <em>or</em> whose GPS location the system
        could not verify against a site. GPS accuracy (±m) is the fix quality — a coarse fix can &quot;match&quot; a small
        radius by luck, so low-accuracy verified punches still warrant a look.
      </MethodNote>

      {t && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Exceptions" value={t.total} accent="rose" icon={<ShieldAlert />} sub="In selected range" />
          <StatTile label="Flagged" value={t.flagged} accent="amber" icon={<Flag />} sub="Marked for review" />
          <StatTile label="Unverified location" value={t.unverified} accent="red" icon={<MapPinOff />} sub="GPS did not match a site" />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        {rows.length === 0 ? (
          <EmptyState icon={<ShieldAlert />} title="No exceptions in this range" description="Every punch here was verified and un-flagged. Widen the range to look further back." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b text-left text-meta uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                  <th className="px-3 py-2.5 text-right font-medium">Accuracy</th>
                  <th className="px-3 py-2.5 font-medium">Site</th>
                  <th className="px-3 py-2.5 font-medium">Loc. verified</th>
                  <th className="px-3 py-2.5 pr-5 font-medium">Out verified</th>
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
                    <td className="px-3 py-2.5 max-w-[16rem]">
                      {r.flagged ? (
                        <span className="text-detail">{r.flagReason ?? "Flagged"}</span>
                      ) : (
                        <span className="text-detail text-muted-foreground">Unverified location</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{accuracyLabel(r.accuracyM)}</td>
                    <td className="px-3 py-2.5">{r.siteName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5"><YesNoBadge value={r.locationVerified} /></td>
                    <td className="px-3 py-2.5 pr-5"><YesNoBadge value={r.checkOutVerified} /></td>
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
