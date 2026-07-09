"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, BadgeIndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";
import { approveFnf, markFnfPaid, type FnfBreakdown } from "@/actions/hr-fnf.actions";

interface Fnf {
  id: string; employeeId: string; empCode: string; name: string; lastWorkingDay: string; status: string;
  leaveEncashDays: number; leaveEncashAmt: number; gratuityAmt: number; pendingSalaryAmt: number;
  noticeRecovery: number; otherAdditions: number; otherDeductions: number; netPayable: number;
  note: string | null; breakdown: FnfBreakdown | null; createdAt: string; approvedAt: string | null;
}

function Row({ label, value, sub, sign }: { label: string; value: string; sub?: string; sign?: "+" | "−" }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed py-2 last:border-0">
      <div>
        <div className="text-[13.5px]">{label}</div>
        {sub && <div className="text-[11.5px] text-muted-foreground">{sub}</div>}
      </div>
      <div className="whitespace-nowrap text-[13.5px] font-medium tabular-nums">
        {sign && <span className="text-muted-foreground">{sign} </span>}{value}
      </div>
    </div>
  );
}

export function FnfDetail({ fnf }: { fnf: Fnf }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const b = fnf.breakdown;

  async function doApprove() {
    setBusy(true);
    const res = await approveFnf(fnf.id);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Settlement approved.");
    router.refresh();
  }
  async function doPaid() {
    setBusy(true);
    const res = await markFnfPaid(fnf.id);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Marked as paid.");
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Settlement computation</div>
          <Row label="Gratuity" value={formatINR(fnf.gratuityAmt)}
            sub={b ? `${b.gratuityEligibleYears} completed yr(s) · last-drawn basic ${formatINR(b.lastDrawnBasic)}` : undefined} sign="+" />
          <Row label="Leave encashment" value={formatINR(fnf.leaveEncashAmt)}
            sub={`${fnf.leaveEncashDays} paid-leave day(s)${b ? ` × ${formatINR(b.perDayRate)}/day` : ""}`} sign="+" />
          <Row label="Pending salary" value={formatINR(fnf.pendingSalaryAmt)}
            sub={b?.pendingSalaryEstimated ? "Estimated (one month CTC — exit month not yet run)" : "From locked payroll"} sign="+" />
          {fnf.otherAdditions > 0 && <Row label="Other additions" value={formatINR(fnf.otherAdditions)} sign="+" />}
          {fnf.noticeRecovery > 0 && <Row label="Notice recovery" value={formatINR(fnf.noticeRecovery)} sign="−" />}
          {fnf.otherDeductions > 0 && <Row label="Other deductions" value={formatINR(fnf.otherDeductions)} sign="−" />}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
            <span className="text-[14px] font-semibold text-primary">Net payable</span>
            <span className="text-[18px] font-bold tabular-nums text-primary">{formatINR(fnf.netPayable)}</span>
          </div>
        </div>

        {fnf.note && (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note</div>
            <p className="text-[13.5px] whitespace-pre-wrap">{fnf.note}</p>
          </div>
        )}

        {b?.notes && b.notes.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How this was calculated</div>
            <ul className="space-y-1.5 text-[12px] text-muted-foreground">
              {b.notes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Employee</dt><dd className="font-medium">{fnf.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Emp code</dt><dd className="font-medium">{fnf.empCode}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Last working day</dt><dd className="font-medium">{formatDate(fnf.lastWorkingDay)}</dd></div>
            {b?.dateOfJoining && <div className="flex justify-between"><dt className="text-muted-foreground">Joined</dt><dd className="font-medium">{formatDate(b.dateOfJoining)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{formatDate(fnf.createdAt)}</dd></div>
            {fnf.approvedAt && <div className="flex justify-between"><dt className="text-muted-foreground">Approved</dt><dd className="font-medium">{formatDate(fnf.approvedAt)}</dd></div>}
          </dl>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</div>
          {fnf.status === "DRAFT" && (
            <Button onClick={doApprove} disabled={busy} className="w-full gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve settlement
            </Button>
          )}
          {fnf.status === "APPROVED" && (
            <Button onClick={doPaid} disabled={busy} className="w-full gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeIndianRupee className="size-4" />} Mark as paid
            </Button>
          )}
          {fnf.status === "PAID" && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              This settlement has been paid.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
