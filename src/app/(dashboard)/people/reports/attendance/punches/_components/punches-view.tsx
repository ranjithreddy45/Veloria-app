"use client";

import * as React from "react";
import { Download, MapPin, Clock, Fingerprint, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getPunchReport,
  type PunchReport,
} from "@/actions/hr-report-attendance.actions";
import { DateRangeControls, StatusBadge, YesNoBadge } from "../../_components/shared";
import { fmtDay, fmtDayIso, fmtTimeIst, fmtHm, hoursDecimal, mapsLink } from "../../_lib/format";

export function PunchesView({
  initialFrom,
  initialTo,
  initial,
}: {
  initialFrom: string;
  initialTo: string;
  initial: PunchReport | null;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [data, setData] = React.useState<PunchReport | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback((f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setLoading(true);
    getPunchReport({ from: f, to: t })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows ?? [];

  function handleExport() {
    if (!data) return;
    const headers = [
      "Date", "Employee", "Emp Code", "Status", "In (IST)", "Out (IST)",
      "Worked hours", "Site", "In verified", "Out verified", "Visit type",
      "Lat", "Lng", "Map link",
    ];
    const body = rows.map((r) => [
      fmtDayIso(r.date), r.name, r.empCode, r.status,
      fmtTimeIst(r.checkInAt), fmtTimeIst(r.checkOutAt), hoursDecimal(r.workedMinutes),
      r.siteName ?? "",
      r.checkInVerified == null ? "" : r.checkInVerified ? "Yes" : "No",
      r.checkOutVerified == null ? "" : r.checkOutVerified ? "Yes" : "No",
      r.visitType ?? "",
      r.lat ?? "", r.lng ?? "", mapsLink(r.lat, r.lng) ?? "",
    ]);
    downloadCSV(`attendance-punches-${data.from}_to_${data.to}.csv`, toCSV(headers, body));
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

      {t && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Punches" value={t.total} accent="blue" icon={<Fingerprint />} sub="Days with a check-in" />
          <StatTile label="Geo-tagged" value={t.withGeo} accent="teal" icon={<MapPin />} sub="GPS coordinates captured" />
          <StatTile label="Flagged" value={t.flagged} accent="rose" icon={<MapPin />} sub="Need review" />
          <StatTile label="Worked hours" value={Math.round(t.workedMinutes / 60)} accent="amber" icon={<Clock />} sub="Total in range" />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        {rows.length === 0 ? (
          <EmptyState icon={<Fingerprint />} title="No punches in this range" description="No check-ins recorded here. Widen the range to look further back." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">In</th>
                  <th className="px-3 py-2.5 font-medium">Out</th>
                  <th className="px-3 py-2.5 text-right font-medium">Worked</th>
                  <th className="px-3 py-2.5 font-medium">Site</th>
                  <th className="px-3 py-2.5 font-medium">In / Out ok</th>
                  <th className="px-3 py-2.5 font-medium">Visit</th>
                  <th className="px-3 py-2.5 pr-5 font-medium">Map</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const link = mapsLink(r.lat, r.lng);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-2.5 whitespace-nowrap tabular-nums">{fmtDay(r.date)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{r.empCode}</div>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{fmtTimeIst(r.checkInAt) || "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{fmtTimeIst(r.checkOutAt) || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtHm(r.workedMinutes)}</td>
                      <td className="px-3 py-2.5">{r.siteName ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <YesNoBadge value={r.checkInVerified} yes="In" no="In" />
                          <YesNoBadge value={r.checkOutVerified} yes="Out" no="Out" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-muted-foreground">{r.visitType ?? "—"}</td>
                      <td className="px-3 py-2.5 pr-5">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="size-3.5" />
                            Map
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
