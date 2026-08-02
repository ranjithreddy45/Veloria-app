"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/utils";
import { getStatutoryRegister, type StatutoryRegister } from "@/actions/hr-statutory-reports.actions";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
interface Period { fy: string; month: number; label: string; status: string; headcount: number }

const RUN_HUE: Record<string, "slate" | "amber" | "emerald"> = {
  DRAFT: "slate", LOCKED: "amber", PAID: "emerald",
};

export function RegistersView({ periods, initial }: { periods: Period[]; initial: StatutoryRegister | null }) {
  const [key, setKey] = React.useState(initial ? `${initial.fy}|${initial.month}` : "");
  const [reg, setReg] = React.useState<StatutoryRegister | null>(initial);
  const [loading, setLoading] = React.useState(false);

  async function select(k: string) {
    setKey(k);
    const [fy, m] = k.split("|");
    setLoading(true);
    const data = await getStatutoryRegister({ fy, month: Number(m) });
    setLoading(false);
    setReg(data);
  }

  if (periods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        No payroll runs yet. Run payroll for a month to populate the statutory register.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Select value={key} onValueChange={select}>
            <SelectTrigger><SelectValue placeholder="Select payroll period" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={`${p.fy}|${p.month}`} value={`${p.fy}|${p.month}`}>
                  {MONTHS[p.month]} · FY {p.fy} ({p.headcount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {reg?.runStatus && <StatusPill label={reg.runStatus} hue={RUN_HUE[reg.runStatus] ?? "slate"} size="sm" />}
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {reg && reg.rows.length > 0 ? (
        <>
        {/* Eight columns of rupee figures cannot be squeezed into 375px and must
          * not be truncated, so the register keeps its horizontal scroll — but
          * an unannounced sideways scroll reads as a broken page. Say it out
          * loud on phones only. */}
        <p className="text-detail text-muted-foreground sm:hidden">
          Swipe the register sideways to see PF, ESI, PT, TDS and Net.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">ESI</TableHead>
                <TableHead className="text-right">PT</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-detail">{r.empCode}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.pf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.esi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.pt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.tds)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Totals ({reg.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.gross)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.pf)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.esi)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.pt)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.tds)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatINR(reg.totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="size-4" /> No payslips in this period.
        </div>
      )}
    </div>
  );
}
