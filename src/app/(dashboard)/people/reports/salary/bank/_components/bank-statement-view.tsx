"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getBankStatement, type BankStatement, type SalaryRunPeriod,
} from "@/actions/hr-report-salary.actions";
import {
  ReportToolbar, ReportEmpty, inr, printReport, exportCSV,
} from "../../_components/report-toolbar";

export function BankStatementView({
  periods, initial, initialKey,
}: {
  periods: SalaryRunPeriod[];
  initial: BankStatement | null;
  initialKey: string;
}) {
  const [key, setKey] = React.useState(initialKey);
  const [includeDraft, setIncludeDraft] = React.useState(false);
  const [data, setData] = React.useState<BankStatement | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (k: string, draft: boolean) => {
    if (!k) return;
    const [fy, m] = k.split("|");
    setLoading(true);
    const d = await getBankStatement({ fy, month: Number(m), includeDraft: draft });
    setData(d);
    setLoading(false);
  }, []);

  function onSelect(k: string) { setKey(k); void load(k, includeDraft); }
  function onToggleDraft(v: boolean) { setIncludeDraft(v); void load(key, v); }

  const rows = data?.rows ?? [];
  const hasData = rows.length > 0;
  const periodLabel = data?.runLabel ?? "";
  const heldCount = data?.heldCount ?? 0;

  const HEADERS = ["Emp code", "Employee", "Bank A/C", "IFSC", "Net"];
  function tableRows(): (string | number)[][] {
    return rows.map((r) => [
      r.empCode, r.name, r.bankAccountMasked ?? "—", r.bankIfsc ?? "—", Math.round(r.net),
    ]);
  }
  const heldNote = heldCount > 0
    ? `${heldCount} on-hold ${heldCount === 1 ? "salary is" : "salaries are"} excluded from this advice (${inr(data?.heldTotal ?? 0)} withheld).`
    : "No salaries on hold — all payable rows are included.";

  return (
    <div className="space-y-4">
      <ReportToolbar
        periods={periods} periodKey={key} onSelect={onSelect}
        includeDraft={includeDraft} onToggleDraft={onToggleDraft}
        runStatus={data?.runStatus ?? null} loading={loading}
        hasData={hasData}
        onCSV={() => exportCSV(`bank-advice-${key.replace("|", "-")}.csv`, HEADERS, tableRows())}
        onPrint={() => printReport({ title: "Bank Statement / Advice", subtitle: periodLabel, headers: HEADERS, rows: tableRows(), rightAlignFrom: 4, note: heldNote })}
      />

      {(data?.runExists && !data?.draftHidden) && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>On-hold salaries are excluded from this bank advice. {heldNote}</span>
        </div>
      )}

      {hasData ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Bank A/C</TableHead>
                <TableHead>IFSC</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-[12px]">{r.empCode}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.bankAccountMasked ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.bankIfsc ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">Payable ({data!.payableCount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(data!.total)}</TableCell>
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
