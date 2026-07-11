"use client";

import { useMemo, useState } from "react";
import { Download, Wallet, Users, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { TypeChip } from "./type-chip";
import { round2, stamp, type BalanceRow, type LeaveTypeLite } from "../_lib/types";

export function BalanceView({
  rows,
  types,
  year,
}: {
  rows: BalanceRow[];
  types: LeaveTypeLite[];
  year: number;
}) {
  const [typeFilter, setTypeFilter] = useState<string>("");

  const filtered = useMemo(
    () => (typeFilter ? rows.filter((r) => r.leaveTypeId === typeFilter) : rows),
    [rows, typeFilter],
  );

  const employees = new Set(filtered.map((r) => r.employeeId)).size;
  const totalAvailable = round2(filtered.reduce((s, r) => s + r.available, 0));
  const totalPending = round2(filtered.reduce((s, r) => s + r.pending, 0));

  function handleExport() {
    const headers = [
      "Employee", "Emp Code", "Leave Type", "Code",
      "Entitled", "Carried Forward", "Used", "Pending", "Available",
    ];
    const data = filtered.map((r) => [
      r.name, r.empCode, r.leaveTypeName, r.leaveTypeCode,
      r.entitled, r.carriedForward, r.used, r.pending, r.available,
    ]);
    downloadCSV(`leave-balance-${year}-${stamp()}.csv`, toCSV(headers, data));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Employees" value={employees} accent="blue" icon={<Users />} sub={`Balances for ${year}`} />
        <StatTile label="Total available" value={totalAvailable} accent="emerald" icon={<Wallet />} sub="Entitled + CF − used − pending" />
        <StatTile label="Total pending" value={totalPending} accent="amber" icon={<CalendarClock />} sub="Awaiting approval" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          Leave type
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-border/70 bg-background px-2 text-[12.5px] font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No balances" description={`No leave balances recorded for ${year}.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Entitled</th>
                <th className="px-4 py-2.5 text-right font-medium">Carried fwd</th>
                <th className="px-4 py-2.5 text-right font-medium">Used</th>
                <th className="px-4 py-2.5 text-right font-medium">Pending</th>
                <th className="px-4 py-2.5 text-right font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.employeeId}-${r.leaveTypeId}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.empCode}</div>
                  </td>
                  <td className="px-4 py-2.5"><TypeChip code={r.leaveTypeCode} color={r.color} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.entitled}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.carriedForward}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.used}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.pending}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{r.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
