"use client";

import { Download, Gift, Users, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { TypeChip } from "./type-chip";
import { round2, stamp, type AllotmentRow } from "../_lib/types";

export function AllotmentView({ rows, year }: { rows: AllotmentRow[]; year: number }) {
  const employees = new Set(rows.map((r) => r.employeeId)).size;
  const totalAllotted = round2(rows.reduce((s, r) => s + r.allotted, 0));
  const totalCarried = round2(rows.reduce((s, r) => s + r.carriedForward, 0));

  function handleExport() {
    const headers = ["Employee", "Emp Code", "Leave Type", "Code", "Entitled", "Carried Forward", "Allotted"];
    const data = rows.map((r) => [
      r.name, r.empCode, r.leaveTypeName, r.leaveTypeCode, r.entitled, r.carriedForward, r.allotted,
    ]);
    downloadCSV(`leave-allotment-${year}-${stamp()}.csv`, toCSV(headers, data));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Employees" value={employees} accent="blue" icon={<Users />} sub={`Granted for ${year}`} />
        <StatTile label="Total allotted" value={totalAllotted} accent="gold" icon={<Gift />} sub="Entitled + carried forward" />
        <StatTile label="Carried forward" value={totalCarried} accent="cyan" icon={<ArrowRightLeft />} sub="Brought in from last year" />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No allotments" description={`No leave was granted for ${year}.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Entitled</th>
                <th className="px-4 py-2.5 text-right font-medium">Carried fwd</th>
                <th className="px-4 py-2.5 text-right font-medium">Allotted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.employeeId}-${r.leaveTypeCode}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.empCode}</div>
                  </td>
                  <td className="px-4 py-2.5"><TypeChip code={r.leaveTypeCode} color={r.color} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.entitled}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.carriedForward}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-violet-600 dark:text-violet-400">{r.allotted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
