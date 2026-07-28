"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CalendarOff, X, CalendarDays, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, cn } from "@/lib/utils";
import { LEAVE_STATUS_HUE, LEAVE_STATUS_LABELS } from "@/lib/hr/constants";
import { applyLeave, cancelLeave } from "@/actions/hr-leave.actions";
import { LeaveApplyCalendar } from "./leave-apply-calendar";

interface LeaveType { id: string; name: string; code: string; color: string; allowHalfDay: boolean }
interface Balance {
  id: string; entitled: number; carriedForward: number; used: number; pending: number;
  leaveType: { id: string; name: string; code: string; color: string };
}
interface RequestRow {
  id: string; startDate: string; endDate: string; days: number; status: string; reason: string | null;
  appliedOnTime: boolean | null;
  leaveType: { name: string; code: string; color: string };
  approver: { firstName: string; lastName: string } | null;
}

// 25th-cutoff punctuality badge: green "On time", red "Late", nothing for legacy (null).
function PunctualityBadge({ onTime }: { onTime: boolean | null }) {
  if (onTime == null) return null;
  return onTime ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">On time</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">Late</span>
  );
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

  // Controlled apply dialog so the calendar can open it prefilled with a range.
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [seed, setSeed] = React.useState<{ start?: string; end?: string }>({});

  function openApply(start?: string, end?: string) {
    setSeed({ start, end });
    setApplyOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Summary line + apply */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="text-muted-foreground">Booked this year <span className="numeric font-semibold text-foreground">{bookedThisYear}</span></span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">Pending <span className="numeric font-semibold text-foreground">{pendingTotal}</span></span>
        </div>
        <Button className="gap-1.5" onClick={() => openApply()}><Plus className="size-4" /> Apply for leave</Button>
      </div>

      {/* Leave-type balance cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {balances.map((b) => {
          const total = b.entitled + b.carriedForward;
          const available = total - b.used - b.pending;
          return (
            <div key={b.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <span className={cn("flex size-9 items-center justify-center rounded-lg", CHIP[b.leaveType.color] ?? CHIP.slate)}>
                  <CalendarDays className="size-4" />
                </span>
                <StatusPill label={b.leaveType.code} hue={b.leaveType.color as never} size="xs" />
              </div>
              <div className="mt-2.5 truncate text-[12.5px] font-medium" title={b.leaveType.name}>{b.leaveType.name}</div>
              <div className="mt-1.5">
                <div className="flex items-baseline gap-1">
                  <span className="numeric text-[26px] font-semibold leading-none">{available}</span>
                  <span className="text-[12.5px] text-muted-foreground">of {total} days left</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{b.used} booked</span>
                  {b.pending > 0 && <span className="text-amber-600 dark:text-amber-400">· {b.pending} pending</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Click-to-apply calendar + upcoming holidays */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaveApplyCalendar onSelectRange={(start, end) => openApply(start, end)} />
        </div>

        {holidays.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
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
      </div>

      <ApplyLeaveDialog
        types={types}
        open={applyOpen}
        onOpenChange={setApplyOpen}
        initialStart={seed.start}
        initialEnd={seed.end}
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b px-4 py-3 text-[13px] font-semibold">My leave requests</div>
        {requests.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="size-5" />}
            title="No leave requests yet"
            description="Apply for your first leave above — weekends and public holidays are excluded automatically."
          />
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
            <TableBody className="[&_td]:py-3.5">
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusPill label={r.leaveType.code} hue={r.leaveType.color as never} size="xs" /></TableCell>
                  <TableCell className="text-[13px]">
                    <span className="numeric text-[12.5px]">{formatDate(r.startDate)}</span>{r.endDate !== r.startDate ? ` → ${formatDate(r.endDate)}` : ""}
                    {r.reason && <div className="text-[12px] text-muted-foreground">{r.reason}</div>}
                  </TableCell>
                  <TableCell className="numeric text-right font-medium">{r.days}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : "HR"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusPill label={LEAVE_STATUS_LABELS[r.status]} hue={LEAVE_STATUS_HUE[r.status] as never} size="xs" />
                      <PunctualityBadge onTime={r.appliedOnTime} />
                    </div>
                  </TableCell>
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

function ApplyLeaveDialog({
  types, open, onOpenChange, initialStart, initialEnd,
}: {
  types: LeaveType[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialStart?: string;
  initialEnd?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [leaveTypeId, setLeaveTypeId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [startPart, setStartPart] = React.useState("FULL");
  const [endPart, setEndPart] = React.useState("FULL");
  const [reason, setReason] = React.useState("");

  // Seed / reset the form each time the dialog opens (dates come from the
  // calendar selection when present, otherwise a blank form).
  React.useEffect(() => {
    if (open) {
      setStartDate(initialStart ?? "");
      setEndDate(initialEnd ?? initialStart ?? "");
      setStartPart("FULL");
      setEndPart("FULL");
      setError(null);
    }
  }, [open, initialStart, initialEnd]);

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
    onOpenChange(false);
    setLeaveTypeId(""); setStartDate(""); setEndDate(""); setStartPart("FULL"); setEndPart("FULL"); setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
