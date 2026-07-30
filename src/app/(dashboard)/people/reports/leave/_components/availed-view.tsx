"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, CalendarCheck, Users, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { TypeChip } from "./type-chip";
import { fmtUtc, round2, stamp, type AvailedRow } from "../_lib/types";

export function AvailedView({
  rows,
  from,
  to,
}: {
  rows: AvailedRow[];
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(key: "from" | "to", val: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, val);
    router.push(`${pathname}?${params.toString()}`);
  }

  const employees = new Set(rows.map((r) => r.empCode)).size;
  const totalDays = round2(rows.reduce((s, r) => s + r.days, 0));

  function handleExport() {
    const headers = ["Employee", "Emp Code", "Leave Type", "Code", "From", "To", "Days", "Status", "Applied On"];
    const data = rows.map((r) => [
      r.name, r.empCode, r.leaveTypeName, r.leaveTypeCode,
      fmtUtc(r.startDate), fmtUtc(r.endDate), r.days, r.status, fmtUtc(r.appliedOn),
    ]);
    downloadCSV(`leave-availed-${from}_to_${to}-${stamp()}.csv`, toCSV(headers, data));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Requests" value={rows.length} accent="blue" icon={<CalendarCheck />} sub="Approved in period" />
        <StatTile label="Employees" value={employees} accent="gold" icon={<Users />} sub="Took leave in period" />
        <StatTile label="Total days" value={totalDays} accent="emerald" icon={<Sigma />} sub="Working days availed" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="inline-flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setRange("from", e.target.value)}
              className="h-8 rounded-lg border border-border/70 bg-background px-2 text-[12.5px] font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            />
          </label>
          <label className="inline-flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setRange("to", e.target.value)}
              className="h-8 rounded-lg border border-border/70 bg-background px-2 text-[12.5px] font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            />
          </label>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No leave availed" description="No approved leave overlaps the selected period." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 text-right font-medium">Days</th>
                <th className="px-4 py-2.5 font-medium">Applied on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.empCode}</div>
                  </td>
                  <td className="px-4 py-2.5"><TypeChip code={r.leaveTypeCode} color={r.color} /></td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtUtc(r.startDate)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtUtc(r.endDate)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.days}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmtUtc(r.appliedOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
