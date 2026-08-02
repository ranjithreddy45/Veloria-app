"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote, Download, Loader2, PauseCircle, PlayCircle, Info, Wallet, Ban,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { holdSalary, releaseSalary, type DisbursementView as DisbData } from "@/actions/hr-salary-hold.actions";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_HUE: Record<string, Hue> = { DRAFT: "amber", LOCKED: "indigo", PAID: "emerald" };

interface RunOption { fy: string; month: number; label: string; status: string }

export function DisbursementView({
  data,
  runs,
  selectedFy,
  selectedMonth,
}: {
  data: DisbData | null;
  runs: RunOption[];
  selectedFy: string;
  selectedMonth: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [holdTarget, setHoldTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = React.useState("");

  const selectValue = selectedFy && selectedMonth ? `${selectedFy}|${selectedMonth}` : "";

  function onSelectRun(value: string) {
    const [fy, month] = value.split("|");
    router.push(`/people/payroll/disbursement?fy=${encodeURIComponent(fy)}&month=${month}`);
  }

  async function submitHold() {
    if (!holdTarget) return;
    if (!reason.trim()) { toast.error("A reason is required to hold this salary."); return; }
    setBusyId(holdTarget.id);
    const res = await holdSalary(holdTarget.id, reason);
    setBusyId(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Salary held — excluded from the bank advice.");
    setHoldTarget(null);
    setReason("");
    router.refresh();
  }

  async function onRelease(id: string) {
    setBusyId(id);
    const res = await releaseSalary(id);
    setBusyId(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Salary released — now payable.");
    router.refresh();
  }

  function exportBankAdvice() {
    if (!data) return;
    // Bank advice: ONLY payable (non-held) rows go to the bank.
    const payable = data.rows.filter((r) => !r.onHold);
    if (payable.length === 0) { toast.error("No payable salaries to export."); return; }
    const headers = ["Emp Code", "Name", "Bank A/C", "IFSC", "Amount"];
    const rows = payable.map((r) => [
      r.empCode,
      r.name,
      r.bankAccountMasked ?? "",
      r.bankIfsc ?? "",
      r.net,
    ]);
    const csv = toCSV(headers, rows);
    downloadCSV(`bank-advice-${data.fy}-${String(data.month).padStart(2, "0")}.csv`, csv);
    toast.success(`Exported ${payable.length} payable row${payable.length === 1 ? "" : "s"}.`);
  }

  const runStatus = data?.runStatus ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Banknote}
        accent="emerald"
        title="Disbursement"
        description="Bank advice for a payroll run. Held salaries stay computed and visible but are excluded from the bank advice until released."
      >
        <div className="w-[220px]">
          <Select value={selectValue} onValueChange={onSelectRun}>
            <SelectTrigger>
              <SelectValue placeholder="Select a payroll run" />
            </SelectTrigger>
            <SelectContent>
              {runs.length === 0 ? (
                <SelectItem value="none" disabled>No payroll runs</SelectItem>
              ) : (
                runs.map((r) => (
                  <SelectItem key={`${r.fy}|${r.month}`} value={`${r.fy}|${r.month}`}>
                    {r.label} · FY {r.fy}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {!data || !data.runExists ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          {runs.length === 0
            ? "No payroll runs yet. Create and compute a run first."
            : "Select a payroll run to view its bank advice."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Payable"
              value={inr(data.payableTotal)}
              accent="emerald"
              icon={<Wallet />}
              sub={`${data.payableCount} employee${data.payableCount === 1 ? "" : "s"} · excludes held`}
            />
            <StatTile
              label="On hold"
              value={inr(data.heldTotal)}
              accent="amber"
              icon={<Ban />}
              sub={`${data.heldCount} held · not disbursed`}
            />
            <StatTile
              label="Run status"
              value={runStatus ?? "—"}
              accent={runStatus === "PAID" ? "emerald" : runStatus === "LOCKED" ? "indigo" : "amber"}
              icon={<Banknote />}
              sub={data.runLabel ?? undefined}
            />
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-copy font-semibold">Bank advice</h3>
                <p className="text-detail text-muted-foreground">
                  Net pay per employee. Hold a salary to remove it from the disbursement.
                </p>
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportBankAdvice}>
                  <Download className="size-4" /> Export bank advice (CSV)
                </Button>
                <p className="inline-flex items-center gap-1 text-meta text-warning">
                  <Info className="size-3" /> Held salaries are excluded from the bank advice.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Bank A/C</TableHead>
                    <TableHead>IFSC</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.payslipId} className={r.onHold ? "bg-warning/5" : undefined}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-meta text-muted-foreground">{r.empCode}</div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.bankAccountMasked ?? <span className="text-destructive">No bank a/c</span>}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.bankIfsc ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{inr(r.net)}</TableCell>
                      <TableCell>
                        {r.onHold ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><StatusPill label="On hold" hue="amber" /></span>
                              </TooltipTrigger>
                              <TooltipContent>{r.holdReason || "On hold"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <StatusPill label="Payable" hue="emerald" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.onHold ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={busyId === r.payslipId}
                            onClick={() => onRelease(r.payslipId)}
                          >
                            {busyId === r.payslipId ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
                            Release
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-warning hover:text-warning/80"
                            disabled={busyId === r.payslipId || runStatus === "PAID"}
                            onClick={() => { setHoldTarget({ id: r.payslipId, name: r.name }); setReason(""); }}
                          >
                            <PauseCircle className="size-4" /> Hold
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!holdTarget} onOpenChange={(o) => { if (!o) { setHoldTarget(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold salary</DialogTitle>
            <DialogDescription>
              {holdTarget ? `Hold ${holdTarget.name}’s salary — it stays computed and visible but is excluded from the bank advice until released.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hold-reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="hold-reason"
              placeholder="e.g. Pending exit clearance, disputed attendance, bank details missing…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHoldTarget(null); setReason(""); }}>Cancel</Button>
            <Button
              onClick={submitHold}
              disabled={!reason.trim() || busyId === holdTarget?.id}
              className="gap-1.5"
            >
              {busyId === holdTarget?.id ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}
              Hold salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
