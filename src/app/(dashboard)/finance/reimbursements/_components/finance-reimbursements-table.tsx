"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, BadgeCheck, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { ClaimTrailDialog } from "@/components/hr/claim-trail-dialog";
import { CLAIM_STATUS_HUE, CLAIM_STATUS_LABEL } from "@/lib/hr/claim-labels";
import {
  markReimbursementPaid,
  scheduleReimbursementPayment,
  type listFinanceReimbursements,
} from "@/actions/hr-reimbursement.actions";

type Row = Awaited<ReturnType<typeof listFinanceReimbursements>>[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

function fyOptions(): string[] {
  const now = new Date();
  const start = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const out: string[] = [];
  for (let s = start + 1; s >= start - 1; s--) out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  return out;
}

export function FinanceReimbursementsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"APPROVED" | "PAID" | "ALL">("APPROVED");
  const [trailId, setTrailId] = React.useState<string | null>(null);
  const [schedule, setSchedule] = React.useState<Row | null>(null);
  const [pay, setPay] = React.useState<Row | null>(null);
  const [busy, setBusy] = React.useState(false);

  const fys = React.useMemo(() => fyOptions(), []);
  const [fy, setFy] = React.useState(fys[1] ?? fys[0]);
  const [month, setMonth] = React.useState(String(new Date().getMonth() + 1));
  const [taxable, setTaxable] = React.useState(false);
  const [paidOn, setPaidOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = React.useState("");

  const visible = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);

  async function doSchedule() {
    if (!schedule) return;
    setBusy(true);
    const res = await scheduleReimbursementPayment(schedule.id, { payFy: fy, payMonth: Number(month), taxable });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`Scheduled on the ${MONTHS[Number(month)]} · FY ${fy} pay run.`);
    setSchedule(null);
    router.refresh();
  }
  async function doPay() {
    if (!pay) return;
    setBusy(true);
    const res = await markReimbursementPaid(pay.id, { paidOn, reference });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Marked as paid — the employee has been notified.");
    setPay(null);
    setReference("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h3 className="text-copy font-semibold">Approved claims</h3>
          <p className="text-detail text-muted-foreground">Every claim here carries both approvals — open History to see who signed off and when.</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[160px]" size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="APPROVED">Ready to pay</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          {filter === "APPROVED" ? "Nothing waiting for payment." : "No claims match this filter."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-detail text-muted-foreground">{r.empCode}{r.department ? ` · ${r.department}` : ""}</div>
                  </TableCell>
                  <TableCell className="max-w-[240px] whitespace-normal">
                    <div className="text-body">{r.title}</div>
                    <div className="text-detail text-muted-foreground">{r.category} · {new Date(r.claimDate).toLocaleDateString("en-IN")}</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {inr(r.amount)}
                    {r.taxable && <div className="text-meta font-medium text-warning">Taxable</div>}
                  </TableCell>
                  <TableCell className="text-detail">
                    <div>1st: {r.level1By ?? "—"}{r.level1At ? ` · ${when(r.level1At)}` : ""}</div>
                    <div className="text-muted-foreground">2nd: {r.level2By ?? "not required"}{r.level2At ? ` · ${when(r.level2At)}` : ""}</div>
                  </TableCell>
                  <TableCell className="text-detail text-muted-foreground">
                    {r.status === "PAID"
                      ? `Paid ${when(r.paidAt) ?? ""}${r.paymentRef ? ` · ${r.paymentRef}` : r.runId ? " · payroll" : ""}`
                      : r.payFy && r.payMonth
                        ? `Pay run ${MONTHS[r.payMonth]} · FY ${r.payFy}`
                        : "Not scheduled"}
                  </TableCell>
                  <TableCell>
                    <StatusPill label={CLAIM_STATUS_LABEL[r.status] ?? r.status} hue={CLAIM_STATUS_HUE[r.status] ?? "slate"} size="xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {r.status === "APPROVED" && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setTaxable(r.taxable); setSchedule(r); }}>
                            <CalendarClock className="size-4" /> {r.payFy ? "Reschedule" : "Pay run"}
                          </Button>
                          <Button size="sm" className="h-8 gap-1" onClick={() => setPay(r)}>
                            <BadgeCheck className="size-4" /> Mark paid
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => setTrailId(r.id)}>
                        <History className="size-4" /> History
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Schedule on a pay run */}
      <Dialog open={schedule !== null} onOpenChange={(o) => { if (!o && !busy) setSchedule(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule on a pay run</DialogTitle>
            <DialogDescription>Payroll disburses the claim with that month&apos;s salary and marks it paid automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Financial year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{fys.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.slice(1).map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5">
            <Checkbox checked={taxable} onCheckedChange={(v) => setTaxable(v === true)} className="mt-0.5" />
            <span>
              <span className="block text-body font-medium">Taxable reimbursement</span>
              <span className="block text-detail text-muted-foreground">Leave off for a standard non-taxable expense claim.</span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedule(null)} disabled={busy}>Cancel</Button>
            <Button onClick={doSchedule} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct payment */}
      <Dialog open={pay !== null} onOpenChange={(o) => { if (!o && !busy) setPay(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>For a claim paid directly (bank transfer, UPI, cash) rather than through payroll.</DialogDescription>
          </DialogHeader>
          {pay && (
            <div className="rounded-lg border bg-muted/40 px-3.5 py-2.5 text-body">
              <span className="font-medium">{pay.name}</span> · {pay.title} · <span className="font-semibold tabular-nums">{inr(pay.amount)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Reference (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPay(null)} disabled={busy}>Cancel</Button>
            <Button onClick={doPay} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClaimTrailDialog claimId={trailId} open={trailId !== null} onOpenChange={(o) => { if (!o) setTrailId(null); }} />
    </div>
  );
}
