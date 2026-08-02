"use client";

import * as React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getSalarySheetDetailed, type SalaryDetailedSheet, type SalaryRunPeriod,
} from "@/actions/hr-report-salary.actions";
import {
  ReportToolbar, ReportEmpty, inr, printReport, exportCSV,
} from "../../_components/report-toolbar";

export function SalaryDetailedView({
  periods, initial, initialKey,
}: {
  periods: SalaryRunPeriod[];
  initial: SalaryDetailedSheet | null;
  initialKey: string;
}) {
  const [key, setKey] = React.useState(initialKey);
  const [includeDraft, setIncludeDraft] = React.useState(false);
  const [data, setData] = React.useState<SalaryDetailedSheet | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (k: string, draft: boolean) => {
    if (!k) return;
    const [fy, m] = k.split("|");
    setLoading(true);
    const d = await getSalarySheetDetailed({ fy, month: Number(m), includeDraft: draft });
    setData(d);
    setLoading(false);
  }, []);

  function onSelect(k: string) { setKey(k); void load(k, includeDraft); }
  function onToggleDraft(v: boolean) { setIncludeDraft(v); void load(key, v); }

  const rows = data?.rows ?? [];
  const earnCols = data?.earningColumns ?? [];
  const dedCols = data?.deductionColumns ?? [];
  const hasData = rows.length > 0;
  const periodLabel = data?.runLabel ?? "";

  const HEADERS = [
    "Emp code", "Employee", "Paid days",
    ...earnCols.map((c) => c.name),
    "Gross",
    ...dedCols.map((c) => `− ${c.name}`),
    "Net",
  ];
  const rightFrom = 2; // paid days onward are numeric

  function tableRows(): (string | number)[][] {
    return rows.map((r) => [
      r.empCode, r.name, Math.round(r.paidDays),
      ...earnCols.map((c) => Math.round(r.earnings[c.code] ?? 0)),
      Math.round(r.gross),
      ...dedCols.map((c) => Math.round(r.deductions[c.code] ?? 0)),
      Math.round(r.net),
    ]);
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        periods={periods} periodKey={key} onSelect={onSelect}
        includeDraft={includeDraft} onToggleDraft={onToggleDraft}
        runStatus={data?.runStatus ?? null} loading={loading}
        hasData={hasData}
        onCSV={() => exportCSV(`salary-sheet-detailed-${key.replace("|", "-")}.csv`, HEADERS, tableRows())}
        onPrint={() => printReport({ title: "Salary Sheet (Detailed)", subtitle: periodLabel, headers: HEADERS, rows: tableRows(), rightAlignFrom: rightFrom })}
      />

      {hasData ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Paid days</TableHead>
                {earnCols.map((c) => (
                  <TableHead key={`e-${c.code}`} className="text-right">{c.name}</TableHead>
                ))}
                <TableHead className="text-right">Gross</TableHead>
                {dedCols.map((c) => (
                  <TableHead key={`d-${c.code}`} className="text-right">− {c.name}</TableHead>
                ))}
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-detail">{r.empCode}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(r.paidDays)}</TableCell>
                  {earnCols.map((c) => (
                    <TableCell key={`e-${c.code}`} className="text-right tabular-nums">{inr(r.earnings[c.code] ?? 0)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.gross)}</TableCell>
                  {dedCols.map((c) => (
                    <TableCell key={`d-${c.code}`} className="text-right tabular-nums">{inr(r.deductions[c.code] ?? 0)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
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
