"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, MoreHorizontal, Eye, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  cancelAdvance, closeAdvance, getAdvanceDetail,
  type AdvanceListRow, type AdvanceDetail,
} from "@/actions/hr-advance.actions";

const MONTH_LABEL = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_HUE: Record<string, Hue> = {
  ACTIVE: "emerald",
  CLOSED: "slate",
  CANCELLED: "rose",
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const startLabel = (r: { startMonth: number; startFy: string }) =>
  `${MONTH_LABEL[r.startMonth] ?? r.startMonth} · FY ${r.startFy}`;

export function AdvancesTable({ rows }: { rows: AdvanceListRow[] }) {
  const router = useRouter();

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdvanceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const [cancelTarget, setCancelTarget] = React.useState<AdvanceListRow | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [closeTarget, setCloseTarget] = React.useState<AdvanceListRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    setLoadingDetail(true);
    const d = await getAdvanceDetail(id);
    setDetail(d);
    setLoadingDetail(false);
  }

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    const res = await cancelAdvance(cancelTarget.id, cancelReason.trim() || undefined);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Advance cancelled.");
    setCancelTarget(null);
    setCancelReason("");
    router.refresh();
  }

  async function doClose() {
    if (!closeTarget) return;
    setBusy(true);
    const res = await closeAdvance(closeTarget.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Advance closed.");
    setCloseTarget(null);
    router.refresh();
  }

  function exportCsv() {
    const headers = [
      "Employee", "Emp code", "Amount", "Instalment", "Recovered",
      "Outstanding", "Status", "Starts", "Recoveries",
    ];
    const data = rows.map((r) => [
      r.employeeName, r.empCode, r.amount, r.monthlyInstallment, r.recovered,
      r.outstanding, r.status, startLabel(r), r.recoveryCount,
    ]);
    downloadCSV(`salary-advances-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, data));
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h3 className="text-copy font-semibold">Advances</h3>
          <p className="text-detail text-muted-foreground">
            Outstanding is amount minus what has been recovered so far.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No advances yet. Record one with “New advance”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Instalment</TableHead>
                <TableHead className="text-right">Recovered</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="text-detail text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.monthlyInstallment)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.recovered)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(r.outstanding)}</TableCell>
                  <TableCell>
                    <StatusPill label={r.status} hue={STATUS_HUE[r.status] ?? "slate"} size="xs" />
                  </TableCell>
                  <TableCell className="text-detail text-muted-foreground">{startLabel(r)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(r.id)}>
                          <Eye className="size-4" /> View detail
                        </DropdownMenuItem>
                        {r.status === "ACTIVE" && (
                          <DropdownMenuItem onClick={() => setCancelTarget(r)}>
                            <Ban className="size-4" /> Cancel advance
                          </DropdownMenuItem>
                        )}
                        {r.status === "ACTIVE" && r.outstanding <= 0 && (
                          <DropdownMenuItem onClick={() => setCloseTarget(r)}>
                            <CheckCircle2 className="size-4" /> Close (settled)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Advance detail</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{detail.employeeName}</div>
                  <div className="text-detail text-muted-foreground">{detail.empCode}</div>
                </div>
                <StatusPill label={detail.status} hue={STATUS_HUE[detail.status] ?? "slate"} size="sm" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-body">
                <Field label="Amount" value={inr(detail.amount)} />
                <Field label="Monthly instalment" value={inr(detail.monthlyInstallment)} />
                <Field label="Recovered" value={inr(detail.recovered)} />
                <Field label="Outstanding" value={inr(detail.outstanding)} strong />
                <Field label="Recovery starts" value={startLabel(detail)} />
                <Field label="Recoveries" value={String(detail.recoveryCount)} />
              </div>
              {detail.reason && (
                <div className="text-body">
                  <div className="text-meta uppercase tracking-wide text-muted-foreground">Reason</div>
                  <div>{detail.reason}</div>
                </div>
              )}
              <div>
                <div className="mb-1.5 text-meta uppercase tracking-wide text-muted-foreground">
                  Recovery history
                </div>
                {detail.recoveries.length === 0 ? (
                  <p className="text-detail text-muted-foreground">
                    No instalments recovered yet. Instalments are deducted automatically when
                    payroll is processed.
                  </p>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Run</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.recoveries.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="font-mono text-detail">{rec.runId}</TableCell>
                            <TableCell className="text-right tabular-nums">{inr(rec.amount)}</TableCell>
                            <TableCell className="text-detail text-muted-foreground">
                              {new Date(rec.createdAt).toLocaleDateString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Advance not found.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel dialog (with optional reason) */}
      <Dialog open={cancelTarget !== null} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel advance</DialogTitle>
          </DialogHeader>
          <p className="text-body text-muted-foreground">
            Cancelling stops future recovery of {cancelTarget ? cancelTarget.employeeName : "this employee"}’s
            advance. Instalments already recovered are kept.
          </p>
          <div className="space-y-1.5 py-1">
            <Label className="text-detail">Reason (optional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={busy}>
              Keep advance
            </Button>
            <Button variant="destructive" onClick={doCancel} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Cancel advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close confirm */}
      <AlertDialog open={closeTarget !== null} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this advance?</AlertDialogTitle>
            <AlertDialogDescription>
              The advance is fully recovered. Closing marks it settled and removes it from the
              active outstanding total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep open</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doClose(); }} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />} Close advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-meta uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</div>
    </div>
  );
}
