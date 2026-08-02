"use client";

import { Download, TrendingDown, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { TypeChip } from "./type-chip";
import { round2, stamp, type LapsedRow } from "../_lib/types";

export function LapsedView({ rows, year }: { rows: LapsedRow[]; year: number }) {
  const employees = new Set(rows.map((r) => r.empCode)).size;
  const totalLapse = round2(rows.reduce((s, r) => s + r.projectedLapse, 0));

  function handleExport() {
    const headers = ["Employee", "Emp Code", "Leave Type", "Code", "Available", "Carry-Forward Max", "Projected Lapse"];
    const data = rows.map((r) => [
      r.name, r.empCode, r.leaveTypeName, r.leaveTypeCode, r.available, r.carryForwardMax, r.projectedLapse,
    ]);
    downloadCSV(`leave-projected-lapse-${year}-${stamp()}.csv`, toCSV(headers, data));
  }

  return (
    <div className="space-y-5">
      {/* Honesty note — the schema does not model a year-end rollover event, so
          this is a forward-looking projection, not a booked lapse. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-detail text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Projected lapse, not a booked lapse.</span> Year-end rollover
          isn&apos;t recorded in the system, so this projects what <em>would</em> lapse at the end of {year} if
          balances stayed as they are today: <code className="rounded bg-warning/15 px-1">max(0, available − carry-forward max)</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Employees affected" value={employees} accent="amber" icon={<Users />} sub="Would lose some balance" />
        <StatTile label="Projected lapse" value={totalLapse} accent="rose" icon={<TrendingDown />} sub={`Days at risk at end of ${year}`} />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing projected to lapse" description={`No balances exceed their carry-forward cap for ${year}.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-meta uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Available</th>
                <th className="px-4 py-2.5 text-right font-medium">CF max</th>
                <th className="px-4 py-2.5 text-right font-medium">Projected lapse</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.empCode}-${r.leaveTypeCode}-${i}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-meta text-muted-foreground">{r.empCode}</div>
                  </td>
                  <td className="px-4 py-2.5"><TypeChip code={r.leaveTypeCode} color={r.color} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.available}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.carryForwardMax}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-destructive">{r.projectedLapse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
