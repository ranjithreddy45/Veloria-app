"use client";

import * as React from "react";
import { Loader2, Printer, Download } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { downloadCSV, toCSV } from "@/lib/csv-export";
import {
  COMPANY_LEGAL_LINE, COMPANY_ADDRESS, COMPANY_GSTIN,
} from "@/lib/constants";
import type { StatutoryPeriod } from "@/actions/hr-report-statutory.actions";

export const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RUN_HUE: Record<string, "slate" | "amber" | "emerald"> = {
  DRAFT: "slate", LOCKED: "amber", PAID: "emerald",
};

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0),
  );

/** The mandatory "these are registers, not filed returns" banner. */
export function NotFiledBanner() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[12.5px] leading-relaxed text-warning">
      <strong className="font-semibold">These are reconciliation registers.</strong>{" "}
      Statutory RETURN files (PF ECR, ESI, PT challan, Form 24Q) are generated separately and are{" "}
      <strong className="font-semibold">not</strong> produced here. Use these to tie payroll out before filing.
    </div>
  );
}

/** FY + month period picker shared by every register view. */
export function PeriodPicker({
  periods, value, onChange, status, loading,
}: {
  periods: StatutoryPeriod[];
  value: string;
  onChange: (key: string) => void;
  status?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-64">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select payroll period" /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={`${p.fy}|${p.month}`} value={`${p.fy}|${p.month}`}>
                {MONTHS[p.month]} · FY {p.fy} ({p.headcount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {status && <StatusPill label={status} hue={RUN_HUE[status] ?? "slate"} size="sm" />}
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

/** CSV + Print toolbar. */
export function RegisterToolbar({ onCsv, onPrint, disabled }: { onCsv: () => void; onPrint: () => void; disabled?: boolean }) {
  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={onCsv} disabled={disabled}>
        <Download className="size-3.5" /> CSV
      </button>
      <button type="button" className={btn} onClick={onPrint} disabled={disabled}>
        <Printer className="size-3.5" /> Print
      </button>
    </div>
  );
}

/** CSV download wrapper (BOM + escaping handled by csv-export). */
export function exportCSV(filename: string, headers: string[], rows: (string | number | null)[][]) {
  downloadCSV(filename, toCSV(headers, rows));
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * Open a branded, print-ready window for a register — mirrors the payslip PDF
 * route's branded HTML + window.print approach. `tableHTML` is trusted markup
 * built by the caller from already-escaped cells.
 */
export function printBrandedRegister(opts: {
  title: string;
  subtitle: string;
  disclaimer?: string;
  tableHTML: string;
}) {
  const PLUM = "#2D1B3D";
  const GOLD = "#C9A96E";
  const IVORY = "#FAF7F2";
  const disclaimer =
    opts.disclaimer ??
    "Reconciliation register — NOT a filed return. Statutory return files (PF ECR, ESI, PT challan, Form 24Q) are generated separately.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(opts.title)} — ${esc(opts.subtitle)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 1100px; margin: 0 auto; }
  .actions { text-align:center; margin: 0 0 16px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  .header { display:flex; align-items:flex-end; justify-content:space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 12px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing:-0.02em; }
  .brand small { display:block; font-size: 10.5px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${GOLD}; }
  .title { text-align:right; font-size: 15px; font-weight:700; }
  .title small { display:block; font-weight:500; color:#6b5b73; }
  .banner { margin: 12px 0; padding: 8px 12px; border:1px solid #d9a441; background:#fdf3dc; border-radius:8px; font-size:11px; color:#6b4c00; }
  table { width:100%; border-collapse:collapse; font-size:11.5px; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(45,27,61,.08); }
  th, td { padding:7px 9px; text-align:left; border-bottom:1px solid #efe7dd; }
  th { background:${PLUM}; color:${IVORY}; font-weight:600; font-size:10.5px; }
  td.r, th.r { text-align:right; white-space:nowrap; }
  tfoot td, tr.sub td { font-weight:700; background:#f6efe2; }
  tr.grp td { background:${PLUM}; color:${IVORY}; font-weight:700; font-size:11px; }
  .footer { margin-top:18px; padding-top:10px; border-top:1px solid #e6dccb; font-size:10px; color:#6b5b73; display:flex; justify-content:space-between; }
  @media print { .actions { display:none; } body { padding:0; } }
</style></head>
<body><div class="doc">
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="header">
    <div class="brand">Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small><small>${esc(COMPANY_ADDRESS)}</small>${COMPANY_GSTIN ? `<small>GSTIN: ${esc(COMPANY_GSTIN)}</small>` : ""}</div>
    <div class="title">${esc(opts.title)}<small>${esc(opts.subtitle)}</small></div>
  </div>
  <div class="banner">${esc(disclaimer)}</div>
  ${opts.tableHTML}
  <div class="footer"><span>Computer-generated reconciliation register — not a signed statutory return.</span><span>${esc(COMPANY_LEGAL_LINE)}</span></div>
</div></body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Build a simple <table> from headers + string rows (cells pre-escaped here). */
export function buildTableHTML(
  headers: { label: string; right?: boolean }[],
  rows: { cells: { v: string; right?: boolean }[]; className?: string }[],
  footer?: { v: string; right?: boolean }[],
): string {
  const thead = `<thead><tr>${headers.map((h) => `<th class="${h.right ? "r" : ""}">${esc(h.label)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (r) => `<tr class="${r.className ?? ""}">${r.cells.map((c) => `<td class="${c.right ? "r" : ""}">${esc(c.v)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody>`;
  const tfoot = footer
    ? `<tfoot><tr>${footer.map((c) => `<td class="${c.right ? "r" : ""}">${esc(c.v)}</td>`).join("")}</tr></tfoot>`
    : "";
  return `<table>${thead}${tbody}${tfoot}</table>`;
}
