"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { provisionLeaveBalances } from "@/actions/hr-leave.actions";

interface TypeCol { id: string; name: string; code: string; color: string }
interface Cell { entitled: number; used: number; pending: number; available: number }
interface Row {
  employeeId: string;
  name: string;
  empCode: string;
  byType: Record<string, Cell | null>;
}

export function LeaveBalancesAdmin({
  year, types, rows, canProvision,
}: {
  year: number; types: TypeCol[]; rows: Row[]; canProvision: boolean;
}) {
  const router = useRouter();
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 9 }, (_, i) => thisYear - 3 + i);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">Balances for {year}</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {rows.length} active employee{rows.length === 1 ? "" : "s"} · {types.length} leave type{types.length === 1 ? "" : "s"}. Each cell shows available of entitled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => router.push(`/people/leave/balances?year=${e.target.value}`)}
            className="h-9 rounded-md border bg-background px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {canProvision && <ProvisionButton year={year} />}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto size-7 text-muted-foreground/40" />
          <p className="mt-2">No active employees found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b text-left text-[12px] text-muted-foreground">
                <th className="sticky left-0 bg-card py-2 pr-3 font-medium">Employee</th>
                {types.map((t) => (
                  <th key={t.id} className="px-3 py-2 text-center font-medium">
                    <StatusPill label={t.code} hue={t.color as never} size="xs" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="sticky left-0 bg-card py-2.5 pr-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{r.empCode}</div>
                  </td>
                  {types.map((t) => {
                    const c = r.byType[t.id];
                    if (!c) {
                      return (
                        <td key={t.id} className="px-3 py-2.5 text-center text-[12px] text-muted-foreground/50">
                          —
                        </td>
                      );
                    }
                    const low = c.available <= 0;
                    return (
                      <td key={t.id} className="px-3 py-2.5 text-center">
                        <div className={cn("font-semibold tabular-nums", low && "text-red-600 dark:text-red-400")}>
                          {c.available}
                          <span className="font-normal text-muted-foreground"> / {c.entitled}</span>
                        </div>
                        {(c.used > 0 || c.pending > 0) && (
                          <div className="text-[11px] text-muted-foreground">
                            {c.used > 0 && <span>{c.used} used</span>}
                            {c.used > 0 && c.pending > 0 && <span> · </span>}
                            {c.pending > 0 && <span className="text-amber-600 dark:text-amber-400">{c.pending} pending</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProvisionButton({ year }: { year: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function run() {
    setBusy(true); setMsg(null);
    const res = await provisionLeaveBalances({ year });
    setBusy(false);
    if (res.success) {
      setMsg(`Created ${res.data.created}, skipped ${res.data.skipped} existing.`);
      router.refresh();
    } else {
      setMsg(res.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[12px] text-muted-foreground">{msg}</span>}
      <Button onClick={run} disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Provision balances for {year}
      </Button>
    </div>
  );
}
