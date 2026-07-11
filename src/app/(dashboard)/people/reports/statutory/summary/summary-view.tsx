"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getStatutorySummary, type StatutorySummary, type StatutoryPeriod,
} from "@/actions/hr-report-statutory.actions";
import {
  PeriodPicker, RegisterToolbar, MONTHS, inr,
  exportCSV, printBrandedRegister, buildTableHTML,
} from "../_components/statutory-shared";

export function StatutorySummaryView({
  periods, initial,
}: {
  periods: StatutoryPeriod[];
  initial: StatutorySummary | null;
}) {
  const [key, setKey] = React.useState(initial?.found ? `${initial.fy}|${initial.month}` : periods[0] ? `${periods[0].fy}|${periods[0].month}` : "");
  const [reg, setReg] = React.useState<StatutorySummary | null>(initial);
  const [loading, setLoading] = React.useState(false);

  async function select(k: string) {
    setKey(k);
    const [fy, m] = k.split("|");
    setLoading(true);
    setReg(await getStatutorySummary({ fy, month: Number(m) }));
    setLoading(false);
  }

  const subtitle = reg?.found ? `${MONTHS[reg.month]} FY ${reg.fy} · ${reg.headcount} employees` : "";
  const hasData = !!reg?.found && reg.rows.length > 0;

  function onCsv() {
    if (!hasData || !reg) return;
    const headers = ["Statute", "Note", "Run total"];
    const rows = reg.rows.map((r) => [r.statute, r.note, r.amount]);
    rows.push(["GRAND TOTAL", "All statutory contributions", reg.grandTotal]);
    exportCSV(`Statutory-summary-${reg.fy}-${MONTHS[reg.month]}.csv`, headers, rows);
  }

  function onPrint() {
    if (!hasData || !reg) return;
    const headers = [{ label: "Statute" }, { label: "Note" }, { label: "Run total", right: true }];
    const rows = reg.rows.map((r) => ({
      cells: [{ v: r.statute }, { v: r.note }, { v: inr(r.amount), right: true }],
    }));
    const footer = [{ v: "Grand total" }, { v: "" }, { v: inr(reg.grandTotal), right: true }];
    printBrandedRegister({
      title: "Statutory summary (reconciliation, not a filed return)",
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
        Statutory summary — one row per statute for the run. Reconciliation view, not a filed return.
      </p>

      {hasData && reg ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statute</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Run total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.statute}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">{r.note}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Grand total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.grandTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="size-4" /> No locked/paid payslips for this period.
        </div>
      )}
    </div>
  );
}
