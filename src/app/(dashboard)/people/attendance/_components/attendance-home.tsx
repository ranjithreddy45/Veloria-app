"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, LogIn, LogOut, Loader2, Clock, CalendarPlus, UserCog, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { FileUpload } from "@/components/ui/file-upload";
import { formatDate } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_HUE } from "@/lib/hr/constants";
import { checkIn, checkOut, requestRegularization, markAttendanceManually } from "@/actions/hr-attendance.actions";

interface Rec {
  id: string; date: string; checkInAt: string | null; checkOutAt: string | null;
  status: string; workedMinutes: number; isRegularized: boolean;
}
interface Stats { presentDays: number; halfDays: number; totalHours: number }
interface EmployeeOption { id: string; firstName: string; lastName: string; empCode: string }
type VisitType = "OFFICE" | "FIELD" | "CLIENT";
const VISIT_TYPE_LABELS: Record<VisitType, string> = { OFFICE: "Office visit", FIELD: "Field visit", CLIENT: "Client visit" };

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function fmtDur(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h ${m}m`;
}

export function AttendanceHome({
  today, records, stats, canMarkManually = false, employees = [],
}: {
  today: Rec | null; records: Rec[]; stats: Stats;
  canMarkManually?: boolean; employees?: EmployeeOption[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <CheckInCard today={today} />
        {/* Three stat tiles stay side-by-side even at 375px — they are short
         * numbers, and stacking them would push the month table below the fold
         * on the screen staff open most. The tiles shrink their padding instead. */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Present (mo.)" value={stats.presentDays} />
          <Stat label="Half days" value={stats.halfDays} />
          <Stat label="Hours logged" value={`${stats.totalHours}h`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {/* "Mark manually" + "Regularize" together are wider than 375px minus the
         * title, so the action pair drops to its own line on a phone. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
          <span className="text-[13px] font-semibold">This month</span>
          <div className="flex items-center gap-2">
            {canMarkManually && <MarkManuallyDialog employees={employees} />}
            <RegularizeDialog />
          </div>
        </div>
        {records.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="Nothing recorded this month"
            description="Your check-ins and check-outs will appear here as soon as you punch in."
          />
        ) : (
          /* Five columns will not fit 375px. Cells tighten to px-2.5 on a phone
           * so the whole row fits without the container's scroll kicking in for
           * a typical record; desktop keeps the roomier px-4. */
          <Table className="[&_td]:px-2.5 [&_th]:px-2.5 sm:[&_td]:px-4 sm:[&_th]:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Worked</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:py-3.5">
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="numeric text-[12.5px] whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell className="numeric text-[12.5px]">{fmtTime(r.checkInAt)}</TableCell>
                  <TableCell className="numeric text-[12.5px]">{fmtTime(r.checkOutAt)}</TableCell>
                  <TableCell className="numeric text-right text-[12.5px] font-medium">{fmtDur(r.workedMinutes)}</TableCell>
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
    <div className="rounded-2xl border bg-card p-3 shadow-card sm:p-5">
      <div className="text-[10.5px] uppercase leading-tight tracking-wide text-muted-foreground sm:text-[11px]">{label}</div>
      <div className="numeric mt-2 text-[20px] font-semibold leading-none sm:mt-2.5 sm:text-[26px]">{value}</div>
    </div>
  );
}

// Browser fix worse than this (in metres) will be flagged by the server; we use
// it purely to pre-warn the user. The 100 m rule itself is enforced server-side.
const POOR_FIX_M = 100;

interface Pos { lat?: number; lng?: number; accuracyM?: number }

function CheckInCard({ today }: { today: Rec | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [visitType, setVisitType] = React.useState<VisitType>("OFFICE");
  const [pos, setPos] = React.useState<Pos | null>(null);
  const [selfieUrl, setSelfieUrl] = React.useState<string | null>(null);

  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;
  const needsGps = visitType !== "CLIENT";
  const done = checkedIn && checkedOut;
  const poorFix = pos?.accuracyM != null && pos.accuracyM > POOR_FIX_M;

  function getPosition(): Promise<Pos> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          // Required for a verified punch — a missing/poor fix gets flagged server-side.
          accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : undefined,
        }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Acquire a fix ahead of the punch so we can show live accuracy and pre-warn
  // on a poor fix. Only while there's still a punch to make, and only when a
  // geo-tag is expected (Office/Field). Never blocks the UI — a denial resolves
  // to no coords and the punch degrades to an unverified/flagged one server-side.
  React.useEffect(() => {
    if (done || !needsGps) { setPos(null); return; }
    let active = true;
    getPosition().then((p) => { if (active && (p.lat != null || p.lng != null)) setPos(p); });
    return () => { active = false; };
  }, [needsGps, done]);

  async function doCheckIn() {
    setBusy(true); setMsg(null);
    // Client visits need no geo-tag; Office/Field capture GPS for verification.
    // Reuse the pre-acquired fix if we have one, else grab a fresh one.
    const p = needsGps ? (pos ?? await getPosition()) : {};
    const res = await checkIn({
      lat: p.lat, lng: p.lng, accuracyM: p.accuracyM,
      selfieUrl: selfieUrl ?? undefined,
      visitType,
    });
    setBusy(false);
    if (res.success) {
      const d = res.data;
      const detail = d.visitType === "CLIENT"
        ? " (client visit)"
        : d.flagged
          ? " — location not verified, flagged for review"
          : d.locationVerified
            ? ` — location match verified${d.siteName ? ` at ${d.siteName}` : ""}`
            : "";
      setMsg(`Checked in${detail}.`);
      setSelfieUrl(null);
      router.refresh();
    } else setMsg(res.error);
  }
  async function doCheckOut() {
    setBusy(true); setMsg(null);
    // Check-out is geo-verified too now. Attempt a fix (optional) — a denial or
    // timeout still lets the punch through; the server flags it if unverified.
    const p = pos ?? await getPosition();
    const res = await checkOut({ lat: p.lat, lng: p.lng, accuracyM: p.accuracyM });
    setBusy(false);
    if (res.success) {
      const d = res.data;
      const hrs = Math.round(d.workedMinutes / 60 * 10) / 10;
      const detail = d.flagged
        ? " — location not verified, flagged for review"
        : d.locationVerified
          ? " — location verified"
          : "";
      setMsg(`Checked out — ${hrs}h logged${detail}.`);
      router.refresh();
    } else setMsg(res.error);
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Clock className="size-3.5" /> Today
      </div>
      {/* Wraps at 375px: in-time + out-time + the status pill overflow a phone
       * row, and an un-wrapped flex would push the pill off the card edge. */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Check-in</div>
          <div className="numeric mt-1 text-[19px] font-semibold leading-none">{fmtTime(today?.checkInAt ?? null)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Check-out</div>
          <div className="numeric mt-1 text-[19px] font-semibold leading-none">{fmtTime(today?.checkOutAt ?? null)}</div>
        </div>
        {today && (
          <div className="ml-auto">
            <StatusPill label={ATTENDANCE_STATUS_LABELS[today.status]} hue={ATTENDANCE_STATUS_HUE[today.status] as never} size="sm" />
          </div>
        )}
      </div>
      {!checkedIn && (
        <div className="mt-4 space-y-1.5">
          <Label className="text-[11.5px] text-muted-foreground">Visit type</Label>
          <Select value={visitType} onValueChange={(v) => setVisitType(v as VisitType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(VISIT_TYPE_LABELS) as VisitType[]).map((t) => (
                <SelectItem key={t} value={t}>{VISIT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 pt-1">
            <FileUpload
              accept="image/*"
              maxMB={1}
              label={selfieUrl ? "Retake selfie" : "Add selfie"}
              onUploaded={(dataUrl) => setSelfieUrl(dataUrl)}
            />
            {selfieUrl
              ? <span className="text-[11px] font-medium text-success">Selfie attached ✓</span>
              : <span className="text-[11px] text-muted-foreground">Optional</span>}
          </div>
        </div>
      )}
      <div className="mt-4">
        {/* The punch button is the single reason most staff open this app on a
         * phone, so it gets more than the 44px tap floor: a 52px hero target at
         * phone width, reverting to normal button density from sm: up. */}
        {!checkedIn ? (
          <Button onClick={doCheckIn} disabled={busy} className="h-13 w-full gap-1.5 text-[15px] sm:h-9 sm:text-[13px]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Check in
          </Button>
        ) : !checkedOut ? (
          <Button onClick={doCheckOut} disabled={busy} variant="outline" className="h-13 w-full gap-1.5 text-[15px] sm:h-9 sm:text-[13px]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Check out
          </Button>
        ) : (
          <div className="rounded-lg bg-success/10 py-2 text-center text-[13px] font-medium text-success">
            All done for today ✓
          </div>
        )}
      </div>
      {needsGps ? (
        <p className="mt-2 flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <MapPin className="size-3" /> Location is captured to verify on-site attendance.
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <MapPin className="size-3" /> Client visit — no location tag required.
        </p>
      )}
      {needsGps && !done && pos?.accuracyM != null && (
        <p className={`mt-1 text-[11.5px] ${poorFix ? "text-warning" : "text-muted-foreground"}`}>
          Location accuracy: ±{Math.round(pos.accuracyM)}m
          {poorFix && ` — this punch will be flagged for review.`}
        </p>
      )}
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
        {error && <p className="text-sm text-destructive">{error}</p>}
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

// HR-only: enter/override a day's attendance from the backend.
const MANUAL_STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "WFH", "ON_LEAVE", "HOLIDAY"];

function MarkManuallyDialog({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [status, setStatus] = React.useState("PRESENT");
  const [note, setNote] = React.useState("");

  async function submit() {
    setError(null);
    if (!employeeId) { setError("Pick an employee."); return; }
    if (!date) { setError("Pick the date."); return; }
    setSaving(true);
    const res = await markAttendanceManually({ employeeId, date, status, note: note || undefined });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setEmployeeId(""); setDate(""); setStatus("PRESENT"); setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><UserCog className="size-3.5" /> Mark manually</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark attendance manually</DialogTitle>
          <DialogDescription>HR entry — set or override a day's attendance. Clears any auto-flag on that day.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANUAL_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Manual entry reason…" /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
