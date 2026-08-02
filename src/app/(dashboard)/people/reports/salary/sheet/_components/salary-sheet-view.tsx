"use client";

import * as React from "react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getSalarySheet, type SalarySheet, type SalaryRunPeriod,
} from "@/actions/hr-report-salary.actions";
import {
  ReportToolbar, ReportEmpty, inr, printReport, exportCSV,
} from "../../_components/report-toolbar";

export function SalarySheetView({
  periods, initial, initialKey,
}: {
  periods: SalaryRunPeriod[];
  initial: SalarySheet | null;
  initialKey: string;
}) {
  const [key, setKey] = React.useState(initialKey);
  const [includeDraft, setIncludeDraft] = React.useState(false);
  const [data, setData] = React.useState<SalarySheet | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (k: string, draft: boolean) => {
    if (!k) return;
    const [fy, m] = k.split("|");
    setLoading(true);
    const d = await getSalarySheet({ fy, month: Number(m), includeDraft: draft });
    setData(d);
    setLoading(false);
  }, []);

  function onSelect(k: string) { setKey(k); void load(k, includeDraft); }
  function onToggleDraft(v: boolean) { setIncludeDraft(v); void load(key, v); }

  const rows = data?.rows ?? [];
  const hasData = rows.length > 0;
  const periodLabel = data?.runLabel ?? "";

  const HEADERS = ["Emp code", "Employee", "Paid days", "LOP", "Gross", "PF", "ESI", "PT", "TDS", "Other ded.", "Net"];
  function tableRows(): (string | number)[][] {
    return rows.map((r) => [
      r.empCode, r.name, Math.round(r.paidDays), Math.round(r.lopDays),
      Math.round(r.gross), Math.round(r.pf), Math.round(r.esi), Math.round(r.pt),
      Math.round(r.tds), Math.round(r.otherDeductions), Math.round(r.net),
    ]);
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        periods={periods} periodKey={key} onSelect={onSelect}
        includeDraft={includeDraft} onToggleDraft={onToggleDraft}
        runStatus={data?.runStatus ?? null} loading={loading}
        hasData={hasData}
        onCSV={() => exportCSV(`salary-sheet-${key.replace("|", "-")}.csv`, HEADERS, tableRows())}
        onPrint={() => printReport({ title: "Salary Sheet", subtitle: periodLabel, headers: HEADERS, rows: tableRows(), rightAlignFrom: 2 })}
      />

      {hasData ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Paid days</TableHead>
                <TableHead className="text-right">LOP</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">ESI</TableHead>
                <TableHead className="text-right">PT</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Other ded.</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-detail">{r.empCode}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(r.paidDays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(r.lopDays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.pf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.esi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.pt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.tds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.otherDeductions)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">Totals ({data!.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.gross)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.pf)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.esi)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.pt)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.tds)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.otherDeductions)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <ReportEmpty
          periodsEmpty={periods.length === 0}
          draftHidden={!!data?.draftHidden}
          runExists={!!data?.runExists}
          onEnableDraft={() => onToggleDraft(true)}
        />
      )}
    </div>
  );
}
