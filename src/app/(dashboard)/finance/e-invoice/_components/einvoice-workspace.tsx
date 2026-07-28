"use client";

// ============================================================
// Finance — E-Invoicing workspace (client).
// Sandbox banner + StatTiles (Generated / Pending / Cancelled) + invoices
// table with per-row Generate / Cancel actions (toast feedback), plus the
// GSTR-2B reconciliation placeholder. API: finance-einvoice.actions.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileCheck2, Clock, Ban, FileText, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import {
  generateEInvoice,
  cancelEInvoice,
  type EInvoiceRow,
  type EInvoiceStatus,
} from "@/actions/finance-einvoice.actions";
import { SandboxBanner } from "./sandbox-banner";
import { Gstr2bReconcileCard } from "./gstr2b-reconcile-card";

const STATUS_META: Record<EInvoiceStatus, { label: string; hue: Hue }> = {
  PENDING: { label: "Pending", hue: "amber" },
  GENERATED: { label: "Generated", hue: "emerald" },
  CANCELLED: { label: "Cancelled", hue: "rose" },
  FAILED: { label: "Failed", hue: "red" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function IrnCell({ irn }: { irn: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(irn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={irn}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 numeric text-[11.5px] text-muted-foreground transition-premium hover:bg-muted hover:text-foreground"
    >
      <span className="numeric">{irn.slice(0, 12)}…{irn.slice(-4)}</span>
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
    </button>
  );
}

export function EInvoiceWorkspace({ rows, canWrite }: { rows: EInvoiceRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    let generated = 0;
    let pending = 0;
    let cancelled = 0;
    for (const r of rows) {
      if (r.status === "GENERATED") generated++;
      else if (r.status === "CANCELLED") cancelled++;
      else pending++; // PENDING + FAILED both await action
    }
    return { generated, pending, cancelled };
  }, [rows]);

  function handleGenerate(invoiceId: string) {
    setPendingId(invoiceId);
    void generateEInvoice(invoiceId)
      .then((res) => {
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success(`E-invoice generated — IRN ${res.data.irn.slice(0, 12)}…`);
        router.refresh();
      })
      .finally(() => setPendingId(null));
  }

  function handleCancel(invoiceId: string) {
    setPendingId(invoiceId);
    void cancelEInvoice(invoiceId)
      .then((res) => {
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success("E-invoice cancelled.");
        router.refresh();
      })
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-6">
      <SandboxBanner />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Generated" value={counts.generated} accent="emerald" icon={<FileCheck2 className="size-4" />} sub="IRNs issued (sandbox)" />
        <StatTile label="Pending" value={counts.pending} accent="amber" icon={<Clock className="size-4" />} sub="Awaiting generation" />
        <StatTile label="Cancelled" value={counts.cancelled} accent="rose" icon={<Ban className="size-4" />} sub="Cancelled e-invoices" />
      </div>

      <div className="rounded-xl border bg-card shadow-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Issued invoices</h2>
          <p className="text-xs text-muted-foreground">Generate an IRN per issued invoice. Showing up to 200 most recent.</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No invoices to report"
            description="Once you have issued (sent/paid) invoices, they will appear here ready for e-invoice generation."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice no.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IRN</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const busy = pendingId === r.invoiceId;
                  const canGenerate = r.status === "PENDING" || r.status === "FAILED";
                  return (
                    <TableRow key={r.invoiceId}>
                      <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
                      <TableCell className="text-muted-foreground numeric">{fmtDate(r.issueDate)}</TableCell>
                      <TableCell className="text-right numeric">{formatINR(r.totalAmount)}</TableCell>
                      <TableCell className="numeric text-[11.5px] text-muted-foreground">{r.gstin ?? "—"}</TableCell>
                      <TableCell>
                        <StatusPill label={meta.label} hue={meta.hue} />
                      </TableCell>
                      <TableCell>{r.irn ? <IrnCell irn={r.irn} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        {!canWrite ? (
                          <span className="text-xs text-muted-foreground">View only</span>
                        ) : canGenerate ? (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleGenerate(r.invoiceId)}>
                            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Generate"}
                          </Button>
                        ) : r.status === "GENERATED" ? (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleCancel(r.invoiceId)} className="text-destructive hover:text-destructive">
                            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Cancel"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Gstr2bReconcileCard />
    </div>
  );
}
