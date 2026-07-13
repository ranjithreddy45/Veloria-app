"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Star, Power, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  upsertPolicy, setDefaultPolicy, togglePolicy, deletePolicy,
  type AttendancePolicyDto,
} from "@/actions/hr-attendance-policy.actions";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function WeeklyOffChips({ offs }: { offs: number[] }) {
  if (!offs || offs.length === 0) return <span className="text-[12px] text-muted-foreground">None</span>;
  const set = new Set(offs);
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.filter((d) => set.has(d.value)).map((d) => (
        <span
          key={d.value}
          className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

export function PolicyAdmin({ policies }: { policies: AttendancePolicyDto[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function onSetDefault(id: string) {
    setPending(id);
    const res = await setDefaultPolicy(id);
    setPending(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Default policy updated.");
    router.refresh();
  }

  async function onToggle(id: string) {
    setPending(id);
    const res = await togglePolicy(id);
    setPending(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.active ? "Policy activated." : "Policy deactivated.");
    router.refresh();
  }

  async function onDelete(id: string) {
    setPending(id);
    const res = await deletePolicy(id);
    setPending(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Policy deleted.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold">Policies</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Rules that govern how check-in times translate to attendance status.
          </p>
        </div>
        <PolicyDialog />
      </div>

      {policies.length === 0 ? (
        <div className="rounded-lg border border-dashed m-5 p-8 text-center text-sm text-muted-foreground">
          No policies yet. Add your first attendance policy and mark it as the default.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead className="text-right">Grace</TableHead>
                <TableHead className="text-right">Half-day after</TableHead>
                <TableHead className="text-right">Full day</TableHead>
                <TableHead className="text-right">Late→LOP</TableHead>
                <TableHead>Weekly offs</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => {
                const busy = pending === p.id;
                return (
                  <TableRow key={p.id} className={cn(!p.active && "opacity-60")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.isDefault && <StatusPill label="Default" hue="amber" size="xs" />}
                        {!p.active && <StatusPill label="Inactive" hue="slate" size="xs" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.graceMinutes}m</TableCell>
                    <TableCell className="text-right tabular-nums">{p.halfDayAfterMinutes}m</TableCell>
                    <TableCell className="text-right tabular-nums">{p.fullDayMinutes}m</TableCell>
                    <TableCell className="text-right tabular-nums">{p.lateMarksToLop}</TableCell>
                    <TableCell><WeeklyOffChips offs={p.weeklyOffs} /></TableCell>
                    <TableCell>
                      {p.otEnabled
                        ? <span className="text-[12.5px]">×{p.otMultiplier}</span>
                        : <span className="text-[12px] text-muted-foreground">Off</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {!p.isDefault && (
                          <Button
                            variant="ghost" size="icon" className="size-8 text-muted-foreground"
                            title="Set as default" disabled={busy}
                            onClick={() => onSetDefault(p.id)}
                          >
                            <Star className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="size-8 text-muted-foreground"
                          title={p.active ? "Deactivate" : "Activate"} disabled={busy}
                          onClick={() => onToggle(p.id)}
                        >
                          {busy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                        </Button>
                        <PolicyDialog existing={p} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="size-8 text-muted-foreground hover:text-red-600"
                              title="Delete" disabled={busy || p.isDefault}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete “{p.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the policy permanently. This can’t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(p.id)}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PolicyDialog({ existing }: { existing?: AttendancePolicyDto }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const [name, setName] = React.useState(existing?.name ?? "");
  const [grace, setGrace] = React.useState(String(existing?.graceMinutes ?? 10));
  const [halfDay, setHalfDay] = React.useState(String(existing?.halfDayAfterMinutes ?? 240));
  const [fullDay, setFullDay] = React.useState(String(existing?.fullDayMinutes ?? 480));
  const [lateToLop, setLateToLop] = React.useState(String(existing?.lateMarksToLop ?? 3));
  const [maxRegn, setMaxRegn] = React.useState(String(existing?.maxRegularizationsPerMonth ?? 3));
  const [weeklyOffs, setWeeklyOffs] = React.useState<number[]>(existing?.weeklyOffs ?? [0]);
  const [otEnabled, setOtEnabled] = React.useState(existing?.otEnabled ?? false);
  const [otMultiplier, setOtMultiplier] = React.useState(String(existing?.otMultiplier ?? 1));
  const [isDefault, setIsDefault] = React.useState(existing?.isDefault ?? false);

  // Reset local state whenever the dialog is (re)opened.
  React.useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setGrace(String(existing?.graceMinutes ?? 10));
    setHalfDay(String(existing?.halfDayAfterMinutes ?? 240));
    setFullDay(String(existing?.fullDayMinutes ?? 480));
    setLateToLop(String(existing?.lateMarksToLop ?? 3));
    setMaxRegn(String(existing?.maxRegularizationsPerMonth ?? 3));
    setWeeklyOffs(existing?.weeklyOffs ?? [0]);
    setOtEnabled(existing?.otEnabled ?? false);
    setOtMultiplier(String(existing?.otMultiplier ?? 1));
    setIsDefault(existing?.isDefault ?? false);
  }, [open, existing]);

  function toggleDay(d: number) {
    setWeeklyOffs((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function save() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    startSaving(async () => {
      const res = await upsertPolicy({
        id: existing?.id,
        name,
        graceMinutes: Number(grace),
        halfDayAfterMinutes: Number(halfDay),
        fullDayMinutes: Number(fullDay),
        lateMarksToLop: Number(lateToLop),
        maxRegularizationsPerMonth: Number(maxRegn),
        weeklyOffs,
        otEnabled,
        otMultiplier: Number(otMultiplier),
        isDefault,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(existing ? "Policy updated." : "Policy created.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing
          ? <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Edit"><Pencil className="size-4" /></Button>
          : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add policy</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-amber-600" />
            {existing ? "Edit policy" : "New attendance policy"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2 pr-1">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard office policy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Grace period (minutes)</Label>
              <Input type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Late marks → 1 LOP</Label>
              <Input type="number" min={0} value={lateToLop} onChange={(e) => setLateToLop(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Half-day after (minutes)</Label>
              <Input type="number" min={0} value={halfDay} onChange={(e) => setHalfDay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Full-day worked (minutes)</Label>
              <Input type="number" min={0} value={fullDay} onChange={(e) => setFullDay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Max regularizations / month</Label>
              <Input type="number" min={0} value={maxRegn} onChange={(e) => setMaxRegn(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px]">Weekly offs</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = weeklyOffs.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                      on
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">Overtime enabled</span>
              <Switch checked={otEnabled} onCheckedChange={setOtEnabled} />
            </label>
            {otEnabled && (
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">OT multiplier</Label>
                <Input
                  type="number" min={0} step="0.25"
                  value={otMultiplier}
                  onChange={(e) => setOtMultiplier(e.target.value)}
                  className="w-32"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4"
            />
            <span className="text-[13px]">
              Set as the organisation default
              <span className="block text-[12px] text-muted-foreground">
                Only one policy can be the default; the current one is replaced.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
