"use client";

import { Download, Scale, TrendingDown, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import type { GratuityRow } from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";
import {
  formatInr,
  EMP_STATUS_HUE,
} from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";

// Under/over-accrual per employee = what is OWED today (projected payout) minus
// what has already been BOOKED as cost (sum of payslip gratuity accruals).
// Positive → UNDER-accrued (a funding shortfall). Negative → OVER-accrued.
// Null projected (no salary structure) → not comparable, returns null.
function underAccrual(r: GratuityRow): number | null {
  if (r.projectedPayout == null) return null;
  return r.projectedPayout - r.accruedToDate;
}

export function GratuityReportView({ rows }: { rows: GratuityRow[] }) {
  const totalAccrued = rows.reduce((s, r) => s + r.accruedToDate, 0);
  const totalProjected = rows.reduce((s, r) => s + (r.projectedPayout ?? 0), 0);
  // Net gap across employees where a comparison is possible.
  const netGap = rows.reduce((s, r) => {
    const g = underAccrual(r);
    return g == null ? s : s + g;
  }, 0);

  function handleExport() {
    const headers = [
      "Employee",
      "Emp Code",
      "Status",
      "Date of Joining",
      "Years of Service",
      "Eligible",
      "Last Drawn Basic",
      "Projected Payout",
      "Accrued To Date",
      "Under/(Over) Accrual",
    ];
    const data = rows.map((r) => {
      const gap = underAccrual(r);
      return [
        r.name,
        r.empCode,
        r.status,
        r.doj ?? "",
        r.yearsOfService.toFixed(2),
        r.eligible ? "Yes" : "No",
        r.lastBasic ?? "",
        r.projectedPayout ?? "",
        r.accruedToDate,
        gap ?? "",
      ];
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`gratuity-accrual-report-${stamp}.csv`, toCSV(headers, data));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Accrued to date"
          value={formatInr(totalAccrued)}
          accent="blue"
          icon={<PiggyBank />}
          sub="Booked cost across all payslips"
        />
        <StatTile
          label="Projected payable"
          value={formatInr(totalProjected)}
          accent="amber"
          icon={<Scale />}
          sub="Owed if everyone separated today"
        />
        <StatTile
          label="Net under/(over)-accrual"
          value={formatInr(netGap)}
          accent={netGap > 0 ? "rose" : "emerald"}
          icon={<TrendingDown />}
          sub={netGap > 0 ? "Booked less than owed (shortfall)" : "Fully / over-provisioned"}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div>
            <h3 className="text-[14px] font-semibold">Accrued vs. payable</h3>
            <p className="text-[12.5px] text-muted-foreground">
              The under/over-accrual column is projected payout minus what has already been booked —
              a positive value is a funding shortfall.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Scale />}
            title="Nothing to report yet"
            description="Once employees and payslips exist, the accrued-vs-payable comparison shows here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Years</th>
                  <th className="px-3 py-2.5 text-right font-medium">Projected payout</th>
                  <th className="px-3 py-2.5 text-right font-medium">Accrued to date</th>
                  <th className="px-5 py-2.5 text-right font-medium">Under/(Over) accrual</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const gap = underAccrual(r);
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{r.empCode}</div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill
                          label={r.status.replace(/_/g, " ").toLowerCase()}
                          hue={EMP_STATUS_HUE[r.status] ?? "slate"}
                          size="xs"
                        />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.yearsOfService.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.projectedPayout == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatInr(r.projectedPayout)
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatInr(r.accruedToDate)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {gap == null ? (
                          <span className="font-normal text-muted-foreground">—</span>
                        ) : (
                          <span className={gap > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                            {gap > 0 ? formatInr(gap) : `(${formatInr(Math.abs(gap))})`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold tabular-nums">
                  <td className="px-5 py-3" colSpan={3}>
                    Totals
                  </td>
                  <td className="px-3 py-3 text-right">{formatInr(totalProjected)}</td>
                  <td className="px-3 py-3 text-right">{formatInr(totalAccrued)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={netGap > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {netGap > 0 ? formatInr(netGap) : `(${formatInr(Math.abs(netGap))})`}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
