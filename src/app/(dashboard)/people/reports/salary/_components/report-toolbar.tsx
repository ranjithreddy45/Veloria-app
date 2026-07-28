"use client";

import * as React from "react";
import { Download, Printer, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { COMPANY_LEGAL_LINE, APP_NAME } from "@/lib/constants";
import type { SalaryRunPeriod } from "@/actions/hr-report-salary.actions";

export const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RUN_HUE: Record<string, Hue> = { DRAFT: "amber", LOCKED: "indigo", PAID: "emerald" };

/** en-IN rupee formatter, whole rupees — money already Number()'d at the boundary. */
const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const inr = (n: number) => inrFmt.format(Math.round(Number(n) || 0));

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * Branded print — opens a new window with a print-styled HTML table and calls
 * window.print(). Mirrors the payslip PDF route's branded-document approach but
 * client-side (no server route added).
 */
export function printReport(opts: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  note?: string;
  rightAlignFrom?: number; // column index from which cells are numeric/right-aligned
}) {
  const rightFrom = opts.rightAlignFrom ?? opts.headers.length;
  const thead = opts.headers
    .map((h, i) => `<th class="${i >= rightFrom ? "num" : ""}">${esc(h)}</th>`)
    .join("");
  const tbody = opts.rows
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td class="${i >= rightFrom ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e;margin:28px;font-size:12px}
    .hd{border-bottom:2px solid #2D1B3D;padding-bottom:10px;margin-bottom:14px}
    .hd h1{margin:0;font-size:18px;color:#2D1B3D}
    .hd .co{font-size:12px;color:#555;margin-top:2px}
    .hd .sub{font-size:12.5px;color:#333;margin-top:6px;font-weight:600}
    table{border-collapse:collapse;width:100%;margin-top:6px}
    th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
    th{background:#FAF7F2;color:#2D1B3D;font-size:11px;text-transform:uppercase;letter-spacing:.02em}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    tr:nth-child(even) td{background:#faf9fb}
    .note{margin-top:10px;font-size:11px;color:#8a6d3b;background:#fcf8e3;border:1px solid #faebcc;padding:6px 9px;border-radius:4px}
    .ft{margin-top:16px;font-size:10px;color:#999}
    @media print{body{margin:12mm}.note{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <div class="hd">
      <h1>${esc(APP_NAME)}</h1>
      <div class="co">${esc(COMPANY_LEGAL_LINE)}</div>
      <div class="sub">${esc(opts.title)} · ${esc(opts.subtitle)}</div>
    </div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    ${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ""}
    <div class="ft">Generated ${esc(new Date().toLocaleString("en-IN"))} · Confidential — payroll</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  downloadCSV(filename, toCSV(headers, rows));
}

// ------------------------------------------------------------
// Toolbar — period picker + draft toggle + status pill + CSV/Print.
// ------------------------------------------------------------
export function ReportToolbar({
  periods,
  periodKey,
  onSelect,
  includeDraft,
  onToggleDraft,
  runStatus,
  loading,
  onCSV,
  onPrint,
  hasData,
}: {
  periods: SalaryRunPeriod[];
  periodKey: string;
  onSelect: (key: string) => void;
  includeDraft: boolean;
  onToggleDraft: (v: boolean) => void;
  runStatus: string | null;
  loading: boolean;
  onCSV: () => void;
  onPrint: () => void;
  hasData: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-60">
        <Select value={periodKey} onValueChange={onSelect}>
          <SelectTrigger><SelectValue placeholder="Select payroll period" /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={`${p.fy}|${p.month}`} value={`${p.fy}|${p.month}`}>
                {MONTHS[p.month]} · FY {p.fy} ({p.headcount}){p.isFinal ? "" : " · draft"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {runStatus && <StatusPill label={runStatus} hue={RUN_HUE[runStatus] ?? "slate"} size="sm" />}

      <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Switch checked={includeDraft} onCheckedChange={onToggleDraft} />
        Show draft runs
      </label>

      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCSV} disabled={!hasData}>
          <Download className="size-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint} disabled={!hasData}>
          <Printer className="size-3.5" /> Print
        </Button>
      </div>
    </div>
  );
}

/** Shared empty / draft-withheld / no-runs states. */
export function ReportEmpty({
  periodsEmpty,
  draftHidden,
  runExists,
  onEnableDraft,
}: {
  periodsEmpty: boolean;
  draftHidden: boolean;
  runExists: boolean;
  onEnableDraft: () => void;
}) {
  if (periodsEmpty) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        No payroll runs yet. Run payroll for a month to populate salary reports.
      </div>
    );
  }
  if (draftHidden) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">
        This period&apos;s run is still a <span className="font-medium">draft</span>. Draft figures are
        withheld from reports until the run is locked.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onEnableDraft}>Show draft figures anyway</Button>
        </div>
      </div>
    );
  }
  if (!runExists) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        No payroll run for this period.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
      No payslips in this period.
    </div>
  );
}
