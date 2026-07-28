// ============================================================
// CashFlowTable — the 13-week ledger: inflow (green), outflow (rose), net, and
// a running balance with an inline CSS bar that reads positive/negative at a
// glance (rose text + bar when the balance dips below zero).
// ============================================================

import { cn, formatINR } from "@/lib/utils";
import type { CashWeekRow } from "@/actions/finance-cashflow.actions";

function fmtWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function CashFlowTable({
  rows,
  cashNow,
  openReceivables,
  stress,
}: {
  rows: CashWeekRow[];
  cashNow: number;
  openReceivables: number;
  stress: boolean;
}) {
  // Bar scaling — symmetric around zero so negative balances render to the left.
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.runningBalance)), Math.abs(cashNow));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">Weekly forecast</h2>
          <p className="text-[11px] text-muted-foreground">
            Starting from {formatINR(cashNow)} cash now · {formatINR(openReceivables)} open receivables
            {stress ? " · stress mode" : ""}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Week</th>
              <th className="px-4 py-2 text-right font-medium">Inflow</th>
              <th className="px-4 py-2 text-right font-medium">Outflow</th>
              <th className="px-4 py-2 text-right font-medium">Net</th>
              <th className="px-4 py-2 text-right font-medium">Running balance</th>
              <th className="hidden w-[28%] px-4 py-2 text-left font-medium sm:table-cell">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const neg = r.runningBalance < 0;
              const barPct = Math.min(100, (Math.abs(r.runningBalance) / maxAbs) * 100);
              return (
                <tr
                  key={r.weekStart}
                  className="border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="font-medium">W{i + 1}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {fmtWeek(r.weekStart)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right numeric">
                    {r.inflow > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatINR(r.inflow)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right numeric">
                    {r.outflow > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        ({formatINR(r.outflow)})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right numeric",
                      r.net < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                    )}
                  >
                    {r.net < 0 ? `(${formatINR(Math.abs(r.net))})` : formatINR(r.net)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium numeric",
                      neg ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                    )}
                  >
                    {neg
                      ? `(${formatINR(Math.abs(r.runningBalance))})`
                      : formatINR(r.runningBalance)}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          neg ? "bg-rose-500" : "bg-emerald-500",
                        )}
                        style={{ width: `${barPct}%` }}
                        aria-hidden
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
