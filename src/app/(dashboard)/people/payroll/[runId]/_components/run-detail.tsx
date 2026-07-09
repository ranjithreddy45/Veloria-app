"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Lock, CheckCircle2, Loader2, Download, IndianRupee, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/page-header";
import {
  computePayrollRun, lockPayrollRun, markPayrollPaid, postHrPayrollToGL,
} from "@/actions/hr-payroll-run.actions";

export interface PayslipRow {
  id: string;
  employeeId: string;
  empCode: string;
  name: string;
  paidDays: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  net: number;
}

export interface RunView {
  id: string;
  fy: string;
  label: string;
  status: string;
  headcount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  lockedAt: string | null;
  posted: boolean;
  glEntryNo: string | null;
  payslips: PayslipRow[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_HUE: Record<string, Hue> = { DRAFT: "amber", LOCKED: "indigo", PAID: "emerald" };

export function RunDetail({ run }: { run: RunView }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "compute" | "lock" | "paid" | "gl">(null);

  const isDraft = run.status === "DRAFT";
  const isLocked = run.status === "LOCKED";
  const hasPayslips = run.payslips.length > 0;
  const canPostGl = !isDraft && !run.posted && hasPayslips;

  async function onCompute() {
    setBusy("compute");
    const res = await computePayrollRun(run.id);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    const skip = res.data.skipped > 0 ? ` · ${res.data.skipped} skipped (no current structure)` : "";
    toast.success(`Computed ${res.data.headcount} payslip${res.data.headcount === 1 ? "" : "s"}${skip}.`);
    router.refresh();
  }

  async function onLock() {
    setBusy("lock");
    const res = await lockPayrollRun(run.id);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Payroll run locked.");
    router.refresh();
  }

  async function onPaid() {
    setBusy("paid");
    const res = await markPayrollPaid(run.id);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Payroll run marked paid.");
    router.refresh();
  }

  async function onPostGl() {
    setBusy("gl");
    const res = await postHrPayrollToGL(run.id);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`Posted to accounts — journal ${res.data.entryNo}.`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={run.label}
        eyebrow={`FY ${run.fy} payroll`}
        description={isLocked && run.lockedAt ? `Locked ${new Date(run.lockedAt).toLocaleDateString("en-IN")}.` : undefined}
      >
        <StatusPill label={run.status} hue={STATUS_HUE[run.status] ?? "slate"} />
        {isDraft && (
          <Button size="sm" variant="outline" onClick={onCompute} disabled={busy !== null} className="gap-1.5">
            {busy === "compute" ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            {hasPayslips ? "Recompute" : "Compute"}
          </Button>
        )}
        {isDraft && hasPayslips && (
          <ConfirmButton
            label="Lock"
            icon={<Lock className="size-4" />}
            title="Lock this payroll run?"
            description="Locking freezes all payslips — you won’t be able to recompute afterwards. Continue?"
            action="Lock run"
            busy={busy === "lock"}
            disabled={busy !== null}
            onConfirm={onLock}
          />
        )}
        {isLocked && (
          <ConfirmButton
            label="Mark paid"
            icon={<CheckCircle2 className="size-4" />}
            title="Mark this run as paid?"
            description="Confirm that salaries for this run have been disbursed. This finalises the run."
            action="Mark paid"
            busy={busy === "paid"}
            disabled={busy !== null}
            onConfirm={onPaid}
          />
        )}
        {canPostGl && (
          <ConfirmButton
            label="Post to accounts"
            icon={<BookOpen className="size-4" />}
            title="Post this payroll to the General Ledger?"
            description="Books a balanced salary journal (Dr Salaries; Cr Net pay + PF/ESI/PT/TDS) in Finance. Use HR payroll as your single source — don’t also post the separate Finance payroll for this month. To reverse, use Finance."
            action="Post to accounts"
            busy={busy === "gl"}
            disabled={busy !== null}
            onConfirm={onPostGl}
          />
        )}
        {run.posted && (
          <StatusPill label={run.glEntryNo ? `Posted · ${run.glEntryNo}` : "Posted to GL"} hue="emerald" />
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Headcount" value={run.headcount} accent="indigo" icon={<IndianRupee />} />
        <StatTile label="Gross" value={inr(run.totalGross)} accent="blue" />
        <StatTile label="Deductions" value={inr(run.totalDeductions)} accent="rose" />
        <StatTile label="Net payable" value={inr(run.totalNet)} accent="emerald" />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">Payslip register</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Statutory deductions computed from the current salary structure.
          </p>
        </div>
        {!hasPayslips ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {isDraft ? "No payslips yet — run Compute to generate them." : "No payslips in this run."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">ESI</TableHead>
                  <TableHead className="text-right">PT</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Payslip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{p.empCode}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(p.pf)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(p.esi)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(p.pt)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(p.tds)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{inr(p.net)}</TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/hr/payslips/${p.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline"
                      >
                        <Download className="size-3.5" /> PDF
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmButton({
  label, icon, title, description, action, busy, disabled, onConfirm,
}: {
  label: string; icon: React.ReactNode; title: string; description: string;
  action: string; busy: boolean; disabled: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
