"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, LogIn, LogOut, Loader2, Clock, CalendarPlus } from "lucide-react";
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
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_HUE } from "@/lib/hr/constants";
import { checkIn, checkOut, requestRegularization } from "@/actions/hr-attendance.actions";

interface Rec {
  id: string; date: string; checkInAt: string | null; checkOutAt: string | null;
  status: string; workedMinutes: number; isRegularized: boolean;
}
interface Stats { presentDays: number; halfDays: number; totalHours: number }

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function fmtDur(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h ${m}m`;
}

export function AttendanceHome({ today, records, stats }: { today: Rec | null; records: Rec[]; stats: Stats }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <CheckInCard today={today} />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Present (mo.)" value={stats.presentDays} />
          <Stat label="Half days" value={stats.halfDays} />
          <Stat label="Hours logged" value={`${stats.totalHours}h`} />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-[13px] font-semibold">This month</span>
          <RegularizeDialog />
        </div>
        {records.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No attendance recorded this month yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Worked</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-[13px]">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-[13px] tabular-nums">{fmtTime(r.checkInAt)}</TableCell>
                  <TableCell className="text-[13px] tabular-nums">{fmtTime(r.checkOutAt)}</TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">{fmtDur(r.workedMinutes)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusPill label={ATTENDANCE_STATUS_LABELS[r.status]} hue={ATTENDANCE_STATUS_HUE[r.status] as never} size="xs" />
                      {r.isRegularized && <span className="text-[10px] text-muted-foreground">(regularized)</span>}
                    </div>
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CheckInCard({ today }: { today: Rec | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;

  function getPosition(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function doCheckIn() {
    setBusy(true); setMsg(null);
    const pos = await getPosition();
    const res = await checkIn(pos);
    setBusy(false);
    if (res.success) { setMsg(`Checked in${res.data.siteName ? ` at ${res.data.siteName}` : res.data.status === "WFH" ? " (work from home)" : ""}.`); router.refresh(); }
    else setMsg(res.error);
  }
  async function doCheckOut() {
    setBusy(true); setMsg(null);
    const res = await checkOut();
    setBusy(false);
    if (res.success) { setMsg(`Checked out — ${Math.round(res.data.workedMinutes / 60 * 10) / 10}h logged.`); router.refresh(); }
    else setMsg(res.error);
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <Clock className="size-4" /> Today
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <div>
          <div className="text-[11px] text-muted-foreground">Check-in</div>
          <div className="text-lg font-semibold tabular-nums">{fmtTime(today?.checkInAt ?? null)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Check-out</div>
          <div className="text-lg font-semibold tabular-nums">{fmtTime(today?.checkOutAt ?? null)}</div>
        </div>
        {today && (
          <div className="ml-auto">
            <StatusPill label={ATTENDANCE_STATUS_LABELS[today.status]} hue={ATTENDANCE_STATUS_HUE[today.status] as never} size="sm" />
          </div>
        )}
      </div>
      <div className="mt-4">
        {!checkedIn ? (
          <Button onClick={doCheckIn} disabled={busy} className="w-full gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Check in
          </Button>
        ) : !checkedOut ? (
          <Button onClick={doCheckOut} disabled={busy} variant="outline" className="w-full gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Check out
          </Button>
        ) : (
          <div className="rounded-lg bg-emerald-50 py-2 text-center text-[13px] font-medium text-emerald-700">
            All done for today ✓
          </div>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <MapPin className="size-3" /> Location is captured to verify on-site attendance.
      </p>
      {msg && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{msg}</p>}
    </div>
  );
}

function RegularizeDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [date, setDate] = React.useState("");
  const [status, setStatus] = React.useState("PRESENT");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function submit() {
    setError(null);
    if (!date) { setError("Pick the date."); return; }
    if (!reason.trim()) { setError("Give a reason."); return; }
    setSaving(true);
    const res = await requestRegularization({ date, requestedStatus: status, reason, checkIn: checkIn || undefined, checkOut: checkOut || undefined });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setDate(""); setReason(""); setCheckIn(""); setCheckOut("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><CalendarPlus className="size-3.5" /> Regularize</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regularize attendance</DialogTitle>
          <DialogDescription>Forgot to check in, or worked off-system? Request a correction — your manager approves it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Mark as</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["PRESENT", "WFH", "HALF_DAY"].map((s) => <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">In (optional)</Label>
              <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">Out (optional)</Label>
              <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Client visit, system down…" /></div>
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
