"use client";

import * as React from "react";
import { Users, Wallet, PiggyBank, ShieldPlus, Receipt, BadgeIndianRupee, Building2, Landmark } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getSalarySummary, type SalarySummary, type SalaryRunPeriod,
} from "@/actions/hr-report-salary.actions";
import {
  ReportToolbar, ReportEmpty, inr, printReport, exportCSV,
} from "../../_components/report-toolbar";

export function SalarySummaryView({
  periods, initial, initialKey,
}: {
  periods: SalaryRunPeriod[];
  initial: SalarySummary | null;
  initialKey: string;
}) {
  const [key, setKey] = React.useState(initialKey);
  const [includeDraft, setIncludeDraft] = React.useState(false);
  const [data, setData] = React.useState<SalarySummary | null>(initial);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (k: string, draft: boolean) => {
    if (!k) return;
    const [fy, m] = k.split("|");
    setLoading(true);
    const d = await getSalarySummary({ fy, month: Number(m), includeDraft: draft });
    setData(d);
    setLoading(false);
  }, []);

  function onSelect(k: string) { setKey(k); void load(k, includeDraft); }
  function onToggleDraft(v: boolean) { setIncludeDraft(v); void load(key, v); }

  const hasData = !!data && data.runExists && !data.draftHidden && data.headcount > 0;
  const periodLabel = data?.runLabel ?? "";

  const HEADERS = ["Metric", "Amount"];
  function tableRows(): (string | number)[][] {
    if (!data) return [];
    return [
      ["Headcount", data.headcount],
      ["Total gross", Math.round(data.totalGross)],
      ["PF — employee", Math.round(data.pfEmployee)],
      ["PF — employer", Math.round(data.pfEmployer)],
      ["PF — total (ee+er)", Math.round(data.pfTotal)],
      ["ESI — employee", Math.round(data.esiEmployee)],
      ["ESI — employer", Math.round(data.esiEmployer)],
      ["ESI — total (ee+er)", Math.round(data.esiTotal)],
      ["Total TDS", Math.round(data.totalTds)],
      ["Total net", Math.round(data.totalNet)],
      ["Total employer cost", Math.round(data.totalEmployerCost)],
      ["Total CTC", Math.round(data.totalCtc)],
    ];
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        periods={periods} periodKey={key} onSelect={onSelect}
        includeDraft={includeDraft} onToggleDraft={onToggleDraft}
        runStatus={data?.runStatus ?? null} loading={loading}
        hasData={hasData}
        onCSV={() => exportCSV(`salary-summary-${key.replace("|", "-")}.csv`, HEADERS, tableRows())}
        onPrint={() => printReport({ title: "Salary Summary", subtitle: periodLabel, headers: HEADERS, rows: tableRows(), rightAlignFrom: 1 })}
      />

      {hasData && data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Headcount" value={data.headcount} accent="indigo" icon={<Users />} />
            <StatTile label="Total gross" value={inr(data.totalGross)} accent="violet" icon={<Wallet />} />
            <StatTile label="Total net" value={inr(data.totalNet)} accent="emerald" icon={<BadgeIndianRupee />} sub="Payable" />
            <StatTile label="Total CTC" value={inr(data.totalCtc)} accent="amber" icon={<Building2 />} sub="Gross + employer cost" />
            <StatTile label="PF (ee + er)" value={inr(data.pfTotal)} accent="cyan" icon={<PiggyBank />} sub={`ee ${inr(data.pfEmployee)} · er ${inr(data.pfEmployer)}`} />
            <StatTile label="ESI (ee + er)" value={inr(data.esiTotal)} accent="teal" icon={<ShieldPlus />} sub={`ee ${inr(data.esiEmployee)} · er ${inr(data.esiEmployer)}`} />
            <StatTile label="Total TDS" value={inr(data.totalTds)} accent="rose" icon={<Receipt />} />
            <StatTile label="Employer cost" value={inr(data.totalEmployerCost)} accent="pink" icon={<Landmark />} sub="Above gross" />
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows().map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r[0]}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {i === 0 ? r[1] : inr(Number(r[1]))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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
