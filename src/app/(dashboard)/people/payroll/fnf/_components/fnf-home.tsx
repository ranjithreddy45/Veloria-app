"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus, Loader2, Calculator, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatDate } from "@/lib/utils";
import { computeFnfPreview, saveFnf, type FnfBreakdown } from "@/actions/hr-fnf.actions";

interface EmpLite {
  id: string; empCode: string; firstName: string; lastName: string;
  status: string; dateOfJoining: string | null; dateOfExit: string | null;
}
interface FnfRow {
  id: string; empCode: string; name: string; lastWorkingDay: string; status: string;
  gratuityAmt: number; leaveEncashAmt: number; pendingSalaryAmt: number; netPayable: number; createdAt: string;
}

const STATUS_HUE: Record<string, "slate" | "amber" | "emerald"> = {
  DRAFT: "slate", APPROVED: "amber", PAID: "emerald",
};

export function FnfHome({ settlements, employees, initialEmployeeId }: { settlements: FnfRow[]; employees: EmpLite[]; initialEmployeeId?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewSettlementDialog employees={employees} initialEmployeeId={initialEmployeeId} />
      </div>
      {settlements.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No settlements yet. Start one when an employee is on their way out.
        </div>
      ) : (
        <div className="space-y-2.5">
          {settlements.map((s) => (
            <Link key={s.id} href={`/people/payroll/fnf/${s.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="text-[12px] text-muted-foreground">{s.empCode}</span>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Last day {formatDate(s.lastWorkingDay)} · Gratuity {formatINR(s.gratuityAmt)} · Leave {formatINR(s.leaveEncashAmt)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{formatINR(s.netPayable)}</div>
                <div className="text-[11px] text-muted-foreground">net payable</div>
              </div>
              <StatusPill label={s.status[0] + s.status.slice(1).toLowerCase()} hue={STATUS_HUE[s.status] ?? "slate"} size="xs" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewSettlementDialog({ employees, initialEmployeeId }: { employees: EmpLite[]; initialEmployeeId?: string }) {
  const router = useRouter();
  // Pre-select only if the handed-off employee is actually in the picker.
  const prefill = initialEmployeeId && employees.some((e) => e.id === initialEmployeeId) ? initialEmployeeId : "";
  const [open, setOpen] = React.useState(Boolean(prefill));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [employeeId, setEmployeeId] = React.useState(prefill);
  const [lastWorkingDay, setLastWorkingDay] = React.useState("");
  const [noticeRecovery, setNoticeRecovery] = React.useState("");
  const [otherAdditions, setOtherAdditions] = React.useState("");
  const [otherDeductions, setOtherDeductions] = React.useState("");
  const [note, setNote] = React.useState("");
  const [preview, setPreview] = React.useState<FnfBreakdown | null>(null);

  function reset() {
    setEmployeeId(""); setLastWorkingDay(""); setNoticeRecovery("");
    setOtherAdditions(""); setOtherDeductions(""); setNote(""); setPreview(null); setError(null);
  }

  const inputPayload = () => ({
    lastWorkingDay,
    noticeRecovery: noticeRecovery ? Number(noticeRecovery) : undefined,
    otherAdditions: otherAdditions ? Number(otherAdditions) : undefined,
    otherDeductions: otherDeductions ? Number(otherDeductions) : undefined,
  });

  async function runPreview() {
    setError(null);
    if (!employeeId) { setError("Pick an employee."); return; }
    if (!lastWorkingDay) { setError("Set the last working day."); return; }
    setBusy(true);
    const res = await computeFnfPreview(employeeId, inputPayload());
    setBusy(false);
    if (!res.success) { setError(res.error); setPreview(null); return; }
    setPreview(res.data);
  }

  async function save() {
    setError(null);
    if (!preview) { await runPreview(); return; }
    setBusy(true);
    const res = await saveFnf(employeeId, { ...inputPayload(), note });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    toast.success("Draft settlement saved.");
    setOpen(false);
    reset();
    router.push(`/people/payroll/fnf/${res.data.id}`);
    router.refresh();
  }

  const selected = employees.find((e) => e.id === employeeId);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><UserMinus className="size-4" /> New settlement</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New full & final settlement</DialogTitle>
          <DialogDescription>Preview the computation, then save it as a draft for approval.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[12.5px]">Employee</Label>
            <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} · {e.empCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.dateOfExit && (
              <p className="text-[11.5px] text-muted-foreground">Recorded exit date: {formatDate(selected.dateOfExit)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Last working day</Label>
            <Input type="date" value={lastWorkingDay}
              onChange={(e) => { setLastWorkingDay(e.target.value); setPreview(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Notice recovery (₹)</Label>
            <Input type="number" min={0} value={noticeRecovery}
              onChange={(e) => { setNoticeRecovery(e.target.value); setPreview(null); }} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Other additions (₹)</Label>
            <Input type="number" min={0} value={otherAdditions}
              onChange={(e) => { setOtherAdditions(e.target.value); setPreview(null); }} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Other deductions (₹)</Label>
            <Input type="number" min={0} value={otherDeductions}
              onChange={(e) => { setOtherDeductions(e.target.value); setPreview(null); }} placeholder="0" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[12.5px]">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to record about this settlement…" />
          </div>
        </div>

        {preview && <PreviewCard b={preview} />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={runPreview} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />} Preview
          </Button>
          <Button onClick={save} disabled={busy || !preview} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PreviewCard({ b }: { b: FnfBreakdown }) {
  const line = (label: string, value: string, sub?: string, sign?: "+" | "−") => (
    <div className="flex items-start justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
      <div>
        <div className="text-[13px]">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className="whitespace-nowrap text-[13px] font-medium tabular-nums">
        {sign && <span className="text-muted-foreground">{sign} </span>}{value}
      </div>
    </div>
  );
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Computation</div>
      {line("Gratuity", formatINR(b.gratuityAmt),
        `${b.gratuityEligibleYears} completed yr(s) · last-drawn basic ${formatINR(b.lastDrawnBasic)}`, "+")}
      {line("Leave encashment", formatINR(b.leaveEncashAmt),
        `${b.leaveEncashDays} paid-leave day(s) × ${formatINR(b.perDayRate)}/day`, "+")}
      {line("Pending salary", formatINR(b.pendingSalaryAmt),
        b.pendingSalaryEstimated ? "Estimated (one month CTC — exit month not yet run)" : "From locked payroll", "+")}
      {b.otherAdditions > 0 && line("Other additions", formatINR(b.otherAdditions), undefined, "+")}
      {b.noticeRecovery > 0 && line("Notice recovery", formatINR(b.noticeRecovery), undefined, "−")}
      {b.otherDeductions > 0 && line("Other deductions", formatINR(b.otherDeductions), undefined, "−")}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="text-[13px] font-semibold text-primary">Net payable</span>
        <span className="text-[15px] font-bold tabular-nums text-primary">{formatINR(b.netPayable)}</span>
      </div>
      {b.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {b.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  );
}
