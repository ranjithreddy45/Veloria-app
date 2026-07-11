"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getPtRegister, type PtRegister, type StatutoryPeriod,
} from "@/actions/hr-report-statutory.actions";
import {
  PeriodPicker, RegisterToolbar, MONTHS, inr,
  exportCSV, printBrandedRegister, buildTableHTML,
} from "../_components/statutory-shared";

export function PtRegisterView({
  periods, initial,
}: {
  periods: StatutoryPeriod[];
  initial: PtRegister | null;
}) {
  const [key, setKey] = React.useState(initial?.found ? `${initial.fy}|${initial.month}` : periods[0] ? `${periods[0].fy}|${periods[0].month}` : "");
  const [reg, setReg] = React.useState<PtRegister | null>(initial);
  const [loading, setLoading] = React.useState(false);

  async function select(k: string) {
    setKey(k);
    const [fy, m] = k.split("|");
    setLoading(true);
    setReg(await getPtRegister({ fy, month: Number(m) }));
    setLoading(false);
  }

  const subtitle = reg?.found ? `${MONTHS[reg.month]} FY ${reg.fy}` : "";
  const hasData = !!reg?.found && reg.groups.length > 0;

  function onCsv() {
    if (!hasData || !reg) return;
    const headers = ["PT state", "Emp code", "Employee", "PT"];
    const rows: (string | number)[][] = [];
    for (const g of reg.groups) {
      for (const r of g.rows) rows.push([g.state, r.empCode, r.name, r.pt]);
      rows.push([`${g.state} subtotal`, "", "", g.subtotal]);
    }
    rows.push([`TOTAL (${reg.totals.headcount})`, "", "", reg.totals.pt]);
    exportCSV(`PT-register-${reg.fy}-${MONTHS[reg.month]}.csv`, headers, rows);
  }

  function onPrint() {
    if (!hasData || !reg) return;
    const headers = [
      { label: "PT state" }, { label: "Emp code" }, { label: "Employee" }, { label: "PT", right: true },
    ];
    const rows: { cells: { v: string; right?: boolean }[]; className?: string }[] = [];
    for (const g of reg.groups) {
      rows.push({ className: "grp", cells: [{ v: `State: ${g.state}` }, { v: "" }, { v: "" }, { v: "", right: true }] });
      for (const r of g.rows) {
        rows.push({ cells: [{ v: g.state }, { v: r.empCode }, { v: r.name }, { v: inr(r.pt), right: true }] });
      }
      rows.push({ className: "sub", cells: [{ v: `${g.state} subtotal` }, { v: "" }, { v: "" }, { v: inr(g.subtotal), right: true }] });
    }
    const footer = [{ v: `Total (${reg.totals.headcount})` }, { v: "" }, { v: "" }, { v: inr(reg.totals.pt), right: true }];
    printBrandedRegister({
      title: "Professional Tax register (for reconciliation, not the PT challan)",
      subtitle,
      tableHTML: buildTableHTML(headers, rows, footer),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker periods={periods} value={key} onChange={select} status={reg?.runStatus} loading={loading} />
        <RegisterToolbar onCsv={onCsv} onPrint={onPrint} disabled={!hasData} />
      </div>

      <p className="text-[12px] font-medium text-muted-foreground">
        Professional Tax register — for reconciliation, not the PT challan. Grouped by the entity&apos;s PT state.
      </p>

      {hasData && reg ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PT state</TableHead>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">PT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.groups.map((g) => (
                <React.Fragment key={g.state}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={4} className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                      State: {g.state} · {g.rows.length} employee{g.rows.length === 1 ? "" : "s"}
                    </TableCell>
                  </TableRow>
                  {g.rows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell className="text-muted-foreground">{g.state}</TableCell>
                      <TableCell className="font-mono text-[12px]">{r.empCode}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(r.pt)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-[12.5px] font-medium">{g.state} subtotal</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{inr(g.subtotal)}</TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">Total ({reg.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.pt)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="size-4" /> No PT-liable payslips for this period.
        </div>
      )}
    </div>
  );
}
