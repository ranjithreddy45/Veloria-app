"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CalendarOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { LEAVE_STATUS_HUE, LEAVE_STATUS_LABELS } from "@/lib/hr/constants";
import { applyLeave, cancelLeave } from "@/actions/hr-leave.actions";

interface LeaveType { id: string; name: string; code: string; color: string; allowHalfDay: boolean }
interface Balance {
  id: string; entitled: number; carriedForward: number; used: number; pending: number;
  leaveType: { id: string; name: string; code: string; color: string };
}
interface RequestRow {
  id: string; startDate: string; endDate: string; days: number; status: string; reason: string | null;
  leaveType: { name: string; code: string; color: string };
  approver: { firstName: string; lastName: string } | null;
}

export function LeaveHome({
  balances, requests, types,
}: {
  balances: Balance[]; requests: RequestRow[]; types: LeaveType[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {balances.map((b) => {
            const available = b.entitled + b.carriedForward - b.used - b.pending;
            return (
              <div key={b.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted-foreground">{b.leaveType.name}</span>
                  <StatusPill label={b.leaveType.code} hue={b.leaveType.color as never} size="xs" />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{available}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  available · {b.used} used{b.pending > 0 ? ` · ${b.pending} pending` : ""}
                </div>
              </div>
            );
          })}
        </div>
        <ApplyLeaveDialog types={types} />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-[13px] font-semibold">My leave requests</div>
        {requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <CalendarOff className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-2">No leave requests yet. Apply for your first leave above.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusPill label={r.leaveType.code} hue={r.leaveType.color as never} size="xs" /></TableCell>
                  <TableCell className="text-[13px]">
                    {formatDate(r.startDate)}{r.endDate !== r.startDate ? ` → ${formatDate(r.endDate)}` : ""}
                    {r.reason && <div className="text-[12px] text-muted-foreground">{r.reason}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : "HR"}
                  </TableCell>
                  <TableCell><StatusPill label={LEAVE_STATUS_LABELS[r.status]} hue={LEAVE_STATUS_HUE[r.status] as never} size="xs" /></TableCell>
                  <TableCell>
                    {(r.status === "PENDING" || r.status === "APPROVED") && <CancelButton id={r.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-red-600"
      disabled={busy}
      onClick={async () => { setBusy(true); await cancelLeave(id); setBusy(false); router.refresh(); }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Cancel
    </Button>
  );
}

function ApplyLeaveDialog({ types }: { types: LeaveType[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [leaveTypeId, setLeaveTypeId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [startPart, setStartPart] = React.useState("FULL");
  const [endPart, setEndPart] = React.useState("FULL");
  const [reason, setReason] = React.useState("");

  const selected = types.find((t) => t.id === leaveTypeId);
  const singleDay = startDate && startDate === endDate;

  async function submit() {
    setError(null);
    if (!leaveTypeId) { setError("Pick a leave type."); return; }
    if (!startDate || !endDate) { setError("Pick the dates."); return; }
    setSaving(true);
    const res = await applyLeave({
      leaveTypeId, startDate, endDate,
      startPart: startPart as never, endPart: singleDay ? (startPart as never) : (endPart as never),
      reason: reason || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    setLeaveTypeId(""); setStartDate(""); setEndDate(""); setStartPart("FULL"); setEndPart("FULL"); setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="size-4" /> Apply for leave</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>Weekends and holidays are excluded automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Leave type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">From</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">To</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          {selected?.allowHalfDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">{singleDay ? "Day" : "First day"}</Label>
                <Select value={startPart} onValueChange={setStartPart}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full day</SelectItem>
                    <SelectItem value="SECOND_HALF">{singleDay ? "Second half" : "Second half only"}</SelectItem>
                    {singleDay && <SelectItem value="FIRST_HALF">First half</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {!singleDay && (
                <div className="space-y-1.5">
                  <Label className="text-[12.5px]">Last day</Label>
                  <Select value={endPart} onValueChange={setEndPart}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">Full day</SelectItem>
                      <SelectItem value="FIRST_HALF">First half only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Family function, travel…" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
