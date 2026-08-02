"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getPfRegister, type PfRegister, type StatutoryPeriod,
} from "@/actions/hr-report-statutory.actions";
import {
  PeriodPicker, RegisterToolbar, MONTHS, inr,
  exportCSV, printBrandedRegister, buildTableHTML,
} from "../_components/statutory-shared";

export function PfRegisterView({
  periods, initial,
}: {
  periods: StatutoryPeriod[];
  initial: PfRegister | null;
}) {
  const [key, setKey] = React.useState(initial?.found ? `${initial.fy}|${initial.month}` : periods[0] ? `${periods[0].fy}|${periods[0].month}` : "");
  const [reg, setReg] = React.useState<PfRegister | null>(initial);
  const [loading, setLoading] = React.useState(false);

  async function select(k: string) {
    setKey(k);
    const [fy, m] = k.split("|");
    setLoading(true);
    setReg(await getPfRegister({ fy, month: Number(m) }));
    setLoading(false);
  }

  const subtitle = reg?.found ? `${MONTHS[reg.month]} FY ${reg.fy}` : "";

  function onCsv() {
    if (!reg?.found) return;
    const headers = ["Emp code", "Employee", "UAN (masked)", "PF no (masked)", "Employee PF", "Employer EPS", "Employer EPF", "EDLI", "Admin", "Total"];
    const rows = reg.rows.map((r) => [
      r.empCode, r.name, r.uanMasked ?? "—", r.pfNoMasked ?? "—",
      r.employeePf, r.employerEps, r.employerEpf, r.edli, r.admin, r.total,
    ]);
    rows.push(["", "TOTALS", "", "", reg.totals.employeePf, reg.totals.employerEps, reg.totals.employerEpf, reg.totals.edli, reg.totals.admin, reg.totals.total]);
    exportCSV(`PF-register-${reg.fy}-${MONTHS[reg.month]}.csv`, headers, rows);
  }

  function onPrint() {
    if (!reg?.found) return;
    const headers = [
      { label: "Emp code" }, { label: "Employee" }, { label: "UAN (masked)" }, { label: "PF no (masked)" },
      { label: "Emp PF", right: true }, { label: "Er EPS", right: true }, { label: "Er EPF", right: true },
      { label: "EDLI", right: true }, { label: "Admin", right: true }, { label: "Total", right: true },
    ];
    const rows = reg.rows.map((r) => ({
      cells: [
        { v: r.empCode }, { v: r.name }, { v: r.uanMasked ?? "—" }, { v: r.pfNoMasked ?? "—" },
        { v: inr(r.employeePf), right: true }, { v: inr(r.employerEps), right: true }, { v: inr(r.employerEpf), right: true },
        { v: inr(r.edli), right: true }, { v: inr(r.admin), right: true }, { v: inr(r.total), right: true },
      ],
    }));
    const footer = [
      { v: `Totals (${reg.totals.headcount})` }, { v: "" }, { v: "" }, { v: "" },
      { v: inr(reg.totals.employeePf), right: true }, { v: inr(reg.totals.employerEps), right: true }, { v: inr(reg.totals.employerEpf), right: true },
      { v: inr(reg.totals.edli), right: true }, { v: inr(reg.totals.admin), right: true }, { v: inr(reg.totals.total), right: true },
    ];
    printBrandedRegister({
      title: "PF contribution register (for reconciliation, not the ECR file)",
      subtitle,
      tableHTML: buildTableHTML(headers, rows, footer),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker periods={periods} value={key} onChange={select} status={reg?.runStatus} loading={loading} />
        <RegisterToolbar onCsv={onCsv} onPrint={onPrint} disabled={!reg?.found || reg.rows.length === 0} />
      </div>

      <p className="text-detail font-medium text-muted-foreground">
        PF contribution register — for reconciliation, not the ECR file.
      </p>

      {reg?.found && reg.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>UAN (masked)</TableHead>
                <TableHead>PF no (masked)</TableHead>
                <TableHead className="text-right">Employee PF</TableHead>
                <TableHead className="text-right">Employer EPS</TableHead>
                <TableHead className="text-right">Employer EPF</TableHead>
                <TableHead className="text-right">EDLI</TableHead>
                <TableHead className="text-right">Admin</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-detail">{r.empCode}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="font-mono text-detail text-muted-foreground">{r.uanMasked ?? "—"}</TableCell>
                  <TableCell className="font-mono text-detail text-muted-foreground">{r.pfNoMasked ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employeePf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerEps)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerEpf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.edli)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.admin)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">Totals ({reg.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.employeePf)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.employerEps)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.employerEpf)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.edli)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.admin)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
      <FileText className="size-4" /> No locked/paid payslips for this period.
    </div>
  );
}
