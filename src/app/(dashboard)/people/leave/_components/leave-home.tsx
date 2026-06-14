"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CalendarOff, X, CalendarDays, PartyPopper } from "lucide-react";
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
import { formatDate, cn } from "@/lib/utils";
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
interface HolidayItem { id: string; name: string; date: string }

// Colored icon-chip per leave type (static classes for Tailwind).
const CHIP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300",
  cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function LeaveHome({
  balances, requests, types, holidays = [],
}: {
  balances: Balance[]; requests: RequestRow[]; types: LeaveType[]; holidays?: HolidayItem[];
}) {
  const bookedThisYear = balances.reduce((s, b) => s + b.used, 0);
  const pendingTotal = balances.reduce((s, b) => s + b.pending, 0);

  return (
    <div className="space-y-5">
      {/* Summary line + apply */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="text-muted-foreground">Booked this year <span className="font-semibold tabular-nums text-foreground">{bookedThisYear}</span></span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">Pending <span className="font-semibold tabular-nums text-foreground">{pendingTotal}</span></span>
        </div>
        <ApplyLeaveDialog types={types} />
      </div>

      {/* Leave-type balance cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {balances.map((b) => {
          const available = b.entitled + b.carriedForward - b.used - b.pending;
          return (
            <div key={b.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <span className={cn("flex size-9 items-center justify-center rounded-lg", CHIP[b.leaveType.color] ?? CHIP.slate)}>
                  <CalendarDays className="size-4" />
                </span>
                <StatusPill label={b.leaveType.code} hue={b.leaveType.color as never} size="xs" />
              </div>
              <div className="mt-2.5 truncate text-[12.5px] font-medium" title={b.leaveType.name}>{b.leaveType.name}</div>
              <div className="mt-1.5 flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold leading-none tabular-nums">{available}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Available</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold leading-none tabular-nums text-muted-foreground">{b.used}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Booked</div>
                </div>
              </div>
              {b.pending > 0 && <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">{b.pending} pending approval</div>}
            </div>
          );
        })}
      </div>

      {/* Upcoming holidays */}
      {holidays.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card shadow-card">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold">
            <PartyPopper className="size-4 text-[#C9A96E]" /> Upcoming holidays
          </div>
          <ul className="divide-y">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex items-center gap-2.5 text-[13px] font-medium">
                  <CalendarDays className="size-3.5 text-muted-foreground" /> {h.name}
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  {new Date(h.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
