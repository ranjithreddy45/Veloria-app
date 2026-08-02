"use client";

import { Download, PieChart, Sigma, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { TypeChip } from "./type-chip";
import { round2, stamp, type SummaryRow } from "../_lib/types";

export function SummaryView({ rows, year }: { rows: SummaryRow[]; year: number }) {
  const totalAllotted = round2(rows.reduce((s, r) => s + r.totalAllotted, 0));
  const totalUsed = round2(rows.reduce((s, r) => s + r.totalUsed, 0));
  const utilisation = totalAllotted > 0 ? round2((totalUsed / totalAllotted) * 100) : 0;

  function handleExport() {
    const headers = ["Leave Type", "Code", "Paid", "Total Entitled", "Total Carried", "Total Allotted", "Total Used", "Total Pending", "Utilisation %"];
    const data = rows.map((r) => [
      r.name, r.code, r.paid ? "Yes" : "No",
      r.totalEntitled, r.totalCarried, r.totalAllotted, r.totalUsed, r.totalPending, r.utilisationPct,
    ]);
    downloadCSV(`leave-summary-${year}-${stamp()}.csv`, toCSV(headers, data));
  }

  const hasData = rows.some((r) => r.totalAllotted > 0 || r.totalUsed > 0 || r.totalPending > 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total allotted" value={totalAllotted} accent="gold" icon={<PieChart />} sub={`Across all types, ${year}`} />
        <StatTile label="Total used" value={totalUsed} accent="blue" icon={<Sigma />} sub="Days consumed" />
        <StatTile label="Utilisation" value={`${utilisation}%`} accent={utilisation > 85 ? "rose" : "emerald"} icon={<Gauge />} sub="Used ÷ allotted" pct={Math.min(100, utilisation)} />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {!hasData ? (
        <EmptyState title="No leave data" description={`No leave balances recorded for ${year}.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-meta uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Leave type</th>
                <th className="px-4 py-2.5 text-right font-medium">Entitled</th>
                <th className="px-4 py-2.5 text-right font-medium">Carried</th>
                <th className="px-4 py-2.5 text-right font-medium">Allotted</th>
                <th className="px-4 py-2.5 text-right font-medium">Used</th>
                <th className="px-4 py-2.5 text-right font-medium">Pending</th>
                <th className="px-4 py-2.5 text-right font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.leaveTypeId} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <TypeChip code={r.code} color={r.color} />
                      <span className="font-medium text-foreground">{r.name}</span>
                      {!r.paid && <span className="text-meta text-muted-foreground">(unpaid)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.totalEntitled}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.totalCarried}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.totalAllotted}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.totalUsed}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-warning">{r.totalPending}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.utilisationPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
