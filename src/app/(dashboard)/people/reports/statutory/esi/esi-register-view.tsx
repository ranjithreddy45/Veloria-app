"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getEsiRegister, type EsiRegister, type StatutoryPeriod,
} from "@/actions/hr-report-statutory.actions";
import {
  PeriodPicker, RegisterToolbar, MONTHS, inr,
  exportCSV, printBrandedRegister, buildTableHTML,
} from "../_components/statutory-shared";

export function EsiRegisterView({
  periods, initial,
}: {
  periods: StatutoryPeriod[];
  initial: EsiRegister | null;
}) {
  const [key, setKey] = React.useState(initial?.found ? `${initial.fy}|${initial.month}` : periods[0] ? `${periods[0].fy}|${periods[0].month}` : "");
  const [reg, setReg] = React.useState<EsiRegister | null>(initial);
  const [loading, setLoading] = React.useState(false);

  async function select(k: string) {
    setKey(k);
    const [fy, m] = k.split("|");
    setLoading(true);
    setReg(await getEsiRegister({ fy, month: Number(m) }));
    setLoading(false);
  }

  const subtitle = reg?.found ? `${MONTHS[reg.month]} FY ${reg.fy}` : "";

  function onCsv() {
    if (!reg?.found) return;
    const headers = ["Emp code", "Employee", "ESI no (masked)", "Employee ESI", "Employer ESI", "Total"];
    const rows = reg.rows.map((r) => [r.empCode, r.name, r.esiNoMasked ?? "—", r.employeeEsi, r.employerEsi, r.total]);
    rows.push(["", "TOTALS", "", reg.totals.employeeEsi, reg.totals.employerEsi, reg.totals.total]);
    exportCSV(`ESI-register-${reg.fy}-${MONTHS[reg.month]}.csv`, headers, rows);
  }

  function onPrint() {
    if (!reg?.found) return;
    const headers = [
      { label: "Emp code" }, { label: "Employee" }, { label: "ESI no (masked)" },
      { label: "Emp ESI", right: true }, { label: "Er ESI", right: true }, { label: "Total", right: true },
    ];
    const rows = reg.rows.map((r) => ({
      cells: [
        { v: r.empCode }, { v: r.name }, { v: r.esiNoMasked ?? "—" },
        { v: inr(r.employeeEsi), right: true }, { v: inr(r.employerEsi), right: true }, { v: inr(r.total), right: true },
      ],
    }));
    const footer = [
      { v: `Totals (${reg.totals.headcount})` }, { v: "" }, { v: "" },
      { v: inr(reg.totals.employeeEsi), right: true }, { v: inr(reg.totals.employerEsi), right: true }, { v: inr(reg.totals.total), right: true },
    ];
    printBrandedRegister({
      title: "ESI contribution register (for reconciliation, not the ESI return)",
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

      <p className="text-[12px] font-medium text-muted-foreground">
        ESI contribution register — for reconciliation, not the ESI return.
      </p>

      {reg?.found && reg.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp code</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>ESI no (masked)</TableHead>
                <TableHead className="text-right">Employee ESI</TableHead>
                <TableHead className="text-right">Employer ESI</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-mono text-[12px]">{r.empCode}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{r.esiNoMasked ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employeeEsi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.employerEsi)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">Totals ({reg.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.employeeEsi)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.employerEsi)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(reg.totals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="size-4" /> No ESI-liable payslips for this period.
        </div>
      )}
    </div>
  );
}
