"use client";

import * as React from "react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCtcSheet, type CtcSheet, type SalaryRunPeriod,
} from "@/actions/hr-report-salary.actions";
import {
  ReportToolbar, ReportEmpty, inr, printReport, exportCSV,
} from "../../_components/report-toolbar";

export function CtcSheetView({
  periods, initial, initialKey,
}: {
  periods: SalaryRunPeriod[];
  initial: CtcSheet | null;
  initialKey: string;
}) {
  const [key, setKey] = React.useState(initialKey);
  const [includeDraft, setIncludeDraft] = React.useState(false);
  const [data, setData] = React.useState<CtcSheet | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (k: string, draft: boolean) => {
    if (!k) return;
    const [fy, m] = k.split("|");
    setLoading(true);
    const d = await getCtcSheet({ fy, month: Number(m), includeDraft: draft });
    setData(d);
    setLoading(false);
  }, []);

  function onSelect(k: string) { setKey(k); void load(k, includeDraft); }
  function onToggleDraft(v: boolean) { setIncludeDraft(v); void load(key, v); }

  const rows = data?.rows ?? [];
  const hasData = rows.length > 0;
  const periodLabel = data?.runLabel ?? "";
  const t = data?.totals;

  const HEADERS = [
    "Emp code", "Employee", "Gross", "Employer PF", "· EPS", "· EPF",
    "Employer ESI", "EDLI", "PF admin", "Gratuity accr.", "Employer cost", "CTC",
  ];
  function tableRows(): (string | number)[][] {
    return rows.map((r) => [
      r.empCode, r.name, Math.round(r.gross), Math.round(r.employerPf),
      Math.round(r.employerEps), Math.round(r.employerEpf), Math.round(r.employerEsi),
      Math.round(r.employerEdli), Math.round(r.employerPfAdmin), Math.round(r.gratuityAccrued),
      Math.round(r.employerCost), Math.round(r.ctc),
    ]);
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        periods={periods} periodKey={key} onSelect={onSelect}
        includeDraft={includeDraft} onToggleDraft={onToggleDraft}
        runStatus={data?.runStatus ?? null} loading={loading}
        hasData={hasData}
        onCSV={() => exportCSV(`ctc-sheet-${key.replace("|", "-")}.csv`, HEADERS, tableRows())}
        onPrint={() => printReport({ title: "CTC Sheet", subtitle: periodLabel, headers: HEADERS, rows: tableRows(), rightAlignFrom: 2 })}
      />

      {hasData ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Employer PF</TableHead>
                <TableHead className="text-right">· EPS</TableHead>
                <TableHead className="text-right">· EPF</TableHead>
                <TableHead className="text-right">Employer ESI</TableHead>
                <TableHead className="text-right">EDLI</TableHead>
                <TableHead className="text-right">PF admin</TableHead>
                <TableHead className="text-right">Gratuity accr.</TableHead>
                <TableHead className="text-right">Employer cost</TableHead>
                <TableHead className="text-right">CTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-detail">{r.empCode}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerPf)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(r.employerEps)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(r.employerEpf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerEsi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerEdli)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerPfAdmin)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.gratuityAccrued)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.employerCost)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(r.ctc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {t && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Totals ({t.headcount})</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.gross)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.employerPf)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted-foreground">{inr(t.employerEps)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted-foreground">{inr(t.employerEpf)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.employerEsi)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.employerEdli)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.employerPfAdmin)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.gratuityAccrued)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.employerCost)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(t.ctc)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
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
