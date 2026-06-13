"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Clock, CalendarRange, ArrowLeftRight, Settings2, Check, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  upsertShift, assignShift, removeAssignment, requestShiftSwap, decideShiftSwap,
} from "@/actions/hr-shifts.actions";

interface Shift { id: string; name: string; startTime: string; endTime: string; color: string; isActive: boolean }
interface Emp { id: string; firstName: string; lastName: string; empCode: string; department?: { name: string } | null }
interface Assignment { id: string; employeeId: string; dateKey: string; shiftId: string; shift: { name: string; color: string; startTime: string; endTime: string } }
interface MyShift { id: string; date: string; shift: Shift }
interface SwapRow { id: string; reason: string | null; dateKey: string; shiftName: string; requester: { firstName: string; lastName: string; empCode: string } }

const HUE_DOT: Record<string, string> = { blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", violet: "bg-violet-500", rose: "bg-rose-500", slate: "bg-slate-500", cyan: "bg-cyan-500" };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ShiftsHome({
  weekStart, weekDays, employees, assignments, shifts, myShifts, colleagues, swaps, canWrite, canAdmin,
}: {
  weekStart: string; weekDays: string[]; employees: Emp[]; assignments: Assignment[]; shifts: Shift[];
  myShifts: MyShift[]; colleagues: { id: string; firstName: string; lastName: string; empCode: string }[];
  swaps: SwapRow[]; canWrite: boolean; canAdmin: boolean;
}) {
  return (
    <Tabs defaultValue="mine">
      <TabsList>
        <TabsTrigger value="mine" className="gap-1.5"><Clock className="size-3.5" /> My shifts</TabsTrigger>
        <TabsTrigger value="roster" className="gap-1.5"><CalendarRange className="size-3.5" /> Roster</TabsTrigger>
        <TabsTrigger value="swaps" className="gap-1.5"><ArrowLeftRight className="size-3.5" /> Swaps{swaps.length ? ` (${swaps.length})` : ""}</TabsTrigger>
        {canAdmin && <TabsTrigger value="types" className="gap-1.5"><Settings2 className="size-3.5" /> Shift types</TabsTrigger>}
      </TabsList>

      {/* MY SHIFTS */}
      <TabsContent value="mine" className="space-y-3">
        {myShifts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No upcoming shifts assigned.</div>
        ) : (
          <div className="space-y-2.5">
            {myShifts.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("size-2.5 rounded-full", HUE_DOT[s.shift.color] ?? "bg-zinc-500")} />
                  <div>
                    <div className="font-medium">{s.shift.name} <span className="text-[12px] font-normal text-muted-foreground">{s.shift.startTime}–{s.shift.endTime}</span></div>
                    <div className="text-[12.5px] text-muted-foreground">{formatDate(s.date)}</div>
                  </div>
                </div>
                <SwapDialog assignmentId={s.id} colleagues={colleagues} />
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ROSTER */}
      <TabsContent value="roster" className="space-y-3">
        <RosterGrid weekStart={weekStart} weekDays={weekDays} employees={employees} assignments={assignments} shifts={shifts} canWrite={canWrite} />
      </TabsContent>

      {/* SWAPS */}
      <TabsContent value="swaps" className="space-y-3">
        {swaps.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No pending swap requests.</div>
        ) : (
          swaps.map((s) => <SwapRowCard key={s.id} row={s} />)
        )}
      </TabsContent>

      {/* SHIFT TYPES */}
      {canAdmin && (
        <TabsContent value="types" className="space-y-3">
          <div className="flex justify-end"><ShiftTypeDialog /></div>
          {shifts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No shift types yet. Add Morning, General, Night…</div>
          ) : (
            <div className="space-y-2.5">
              {shifts.map((sh) => (
                <div key={sh.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("size-2.5 rounded-full", HUE_DOT[sh.color] ?? "bg-zinc-500")} />
                    <span className="font-medium">{sh.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">{sh.startTime}–{sh.endTime}</span>
                  </div>
                  <ShiftTypeDialog existing={sh} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}

function RosterGrid({
  weekStart, weekDays, employees, assignments, shifts, canWrite,
}: {
  weekStart: string; weekDays: string[]; employees: Emp[]; assignments: Assignment[]; shifts: Shift[]; canWrite: boolean;
}) {
  const router = useRouter();
  const byCell = new Map<string, Assignment>();
  assignments.forEach((a) => byCell.set(`${a.employeeId}|${a.dateKey}`, a));

  function shiftWeek(delta: number) {
    const d = new Date(weekStart + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + delta * 7);
    router.replace(`/people/shifts?week=${d.toISOString().slice(0, 10)}`);
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-[13px] font-semibold">Week of {formatDate(weekStart)}</span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="size-8" onClick={() => shiftWeek(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => shiftWeek(1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 bg-muted/40 px-3 py-2 text-left font-medium">Employee</th>
              {weekDays.map((d, i) => (
                <th key={d} className="px-2 py-2 text-center font-medium">
                  {DOW[i]}<div className="text-[10.5px] font-normal text-muted-foreground">{d.slice(8)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="sticky left-0 bg-card px-3 py-1.5">
                  <div className="font-medium">{e.firstName} {e.lastName}</div>
                  <div className="text-[10.5px] text-muted-foreground">{e.empCode}</div>
                </td>
                {weekDays.map((d) => {
                  const a = byCell.get(`${e.id}|${d}`);
                  return (
                    <td key={d} className="px-1.5 py-1.5 text-center">
                      <RosterCell employeeId={e.id} date={d} assignment={a} shifts={shifts} canWrite={canWrite} onChange={() => router.refresh()} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterCell({
  employeeId, date, assignment, shifts, canWrite, onChange,
}: {
  employeeId: string; date: string; assignment?: Assignment; shifts: Shift[]; canWrite: boolean; onChange: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function set(shiftId: string) {
    setBusy(true);
    if (shiftId === "__clear__") await removeAssignment(employeeId, date);
    else await assignShift(employeeId, shiftId, date);
    setBusy(false); onChange();
  }

  if (!canWrite) {
    return assignment
      ? <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]", HUE_DOT[assignment.shift.color] ? "" : "")}>
          <span className={cn("size-1.5 rounded-full", HUE_DOT[assignment.shift.color] ?? "bg-zinc-500")} />{assignment.shift.name}
        </span>
      : <span className="text-muted-foreground/30">—</span>;
  }

  return (
    <Select value={assignment?.shiftId ?? ""} onValueChange={set} disabled={busy}>
      <SelectTrigger className={cn("h-7 w-full justify-center gap-1 border-dashed px-1.5 text-[11px]", assignment && "border-solid")}>
        {busy ? <Loader2 className="size-3 animate-spin" /> : assignment
          ? <span className="flex items-center gap-1 truncate"><span className={cn("size-1.5 rounded-full", HUE_DOT[assignment.shift.color] ?? "bg-zinc-500")} />{assignment.shift.name}</span>
          : <span className="text-muted-foreground">+</span>}
      </SelectTrigger>
      <SelectContent>
        {shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>)}
        {assignment && <SelectItem value="__clear__">Clear</SelectItem>}
      </SelectContent>
    </Select>
  );
}

function SwapDialog({ assignmentId, colleagues }: { assignmentId: string; colleagues: { id: string; firstName: string; lastName: string; empCode: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!target) { setError("Pick a colleague."); return; }
    setBusy(true);
    const res = await requestShiftSwap(assignmentId, target, reason || undefined);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTarget(""); setReason(""); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1.5"><ArrowLeftRight className="size-3.5" /> Swap</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Request shift swap</DialogTitle><DialogDescription>Your colleague approves the swap.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Swap with</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Colleague" /></SelectTrigger>
              <SelectContent>{colleagues.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.empCode}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwapRowCard({ row }: { row: SwapRow }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  async function decide(d: "APPROVED" | "REJECTED") {
    setBusy(d); setError(null);
    const res = await decideShiftSwap(row.id, d);
    setBusy(null);
    if (!res.success) { setError(res.error); return; }
    router.refresh();
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{row.requester.firstName} {row.requester.lastName} <span className="text-[12px] font-normal text-muted-foreground">wants to swap</span></div>
          <div className="text-[12.5px] text-muted-foreground">{row.shiftName} · {formatDate(row.dateKey)}{row.reason ? ` · “${row.reason}”` : ""}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("REJECTED")}>{busy === "REJECTED" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Decline</Button>
          <Button size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("APPROVED")}>{busy === "APPROVED" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Accept</Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ShiftTypeDialog({ existing }: { existing?: Shift }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [startTime, setStartTime] = React.useState(existing?.startTime ?? "09:00");
  const [endTime, setEndTime] = React.useState(existing?.endTime ?? "18:00");
  const [color, setColor] = React.useState(existing?.color ?? "blue");

  async function save() {
    setError(null); setBusy(true);
    const res = await upsertShift({ id: existing?.id, name, startTime, endTime, color });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{existing ? <Button variant="outline" size="sm">Edit</Button> : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add shift</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit shift" : "New shift"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Start</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">End</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Colour</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["blue", "emerald", "amber", "violet", "rose", "cyan", "slate"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
