// ============================================================
// TopExpenses — the five biggest expense accounts this FY, drawn as labelled
// amount bars (each bar relative to the largest in the list).
// ============================================================

import { Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import type { TopAccountRow } from "@/actions/finance-cockpit.actions";

interface TopExpensesProps {
  fy: string;
  rows: TopAccountRow[];
}

export function TopExpenses({ fy, rows }: TopExpensesProps) {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <Flame className="size-4" />
          </span>
          Top expenses this year
        </CardTitle>
        <span className="text-[11.5px] text-muted-foreground">FY {fy}</span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Flame className="size-5" />}
            title="No expenses yet"
            description="Posted expense entries for this financial year will show up here."
          />
        ) : (
          <ul className="space-y-3.5">
            {rows.map((r) => (
              <li key={r.code}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    <span className="text-muted-foreground tabular-nums">{r.code}</span>{" "}
                    {r.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatINR(r.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500"
                    style={{ width: `${Math.max(4, r.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
