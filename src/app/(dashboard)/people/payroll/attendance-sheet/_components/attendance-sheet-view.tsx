"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, Lock, Unlock, CalendarDays, Users, CircleSlash, Save, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  generateAttendanceSheet, getAttendanceSheet, updateAttendanceSheetRow,
  finalizeAttendanceSheet, reopenAttendanceSheet,
  type AttendanceSheet, type AttendanceSheetRow,
} from "@/actions/hr-attendance-sheet.actions";

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const currentFyStart = now.getMonth() + 1 >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = currentFyStart + 1; s >= currentFyStart - 2; s--) {
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface Draft {
  present: string;
  leave: string;
  lop: string;
  note: string;
  dirty: boolean;
  saving: boolean;
}

function toDraft(r: AttendanceSheetRow): Draft {
  return {
    present: String(r.presentDays),
    leave: String(r.leaveDays),
    lop: String(r.lopDays),
    note: r.note ?? "",
    dirty: false,
    saving: false,
  };
}

export function AttendanceSheetView({
  initialFy, initialMonth, initial,
}: {
  initialFy: string;
  initialMonth: number;
  initial: AttendanceSheet | null;
}) {
  const fys = React.useMemo(fyOptions, []);
  const [fy, setFy] = React.useState(initialFy);
  const [month, setMonth] = React.useState(String(initialMonth));
  const [sheet, setSheet] = React.useState<AttendanceSheet | null>(initial);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "generate" | "force" | "finalize" | "reopen">(null);
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(
    () => Object.fromEntries((initial?.rows ?? []).map((r) => [r.id, toDraft(r)])),
  );

  const allFinal = sheet?.allFinal ?? false;
  const anyFinal = sheet?.anyFinal ?? false;
  const hasRows = (sheet?.rows.length ?? 0) > 0;

  const reload = React.useCallback(async (f: string, m: number) => {
    setLoading(true);
    const data = await getAttendanceSheet({ fy: f, month: m });
    setLoading(false);
    setSheet(data);
    setDrafts(Object.fromEntries((data?.rows ?? []).map((r) => [r.id, toDraft(r)])));
  }, []);

  function onFy(v: string) { setFy(v); reload(v, Number(month)); }
  function onMonth(v: string) { setMonth(v); reload(fy, Number(v)); }

  async function onGenerate(force: boolean) {
    setBusy(force ? "force" : "generate");
    const res = await generateAttendanceSheet({ fy, month: Number(month), force });
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    const { generated, refreshed, kept } = res.data;
    toast.success(
      `Sheet built · ${generated} new, ${refreshed} refreshed` + (kept > 0 ? `, ${kept} kept (edited/final)` : "") + ".",
    );
    await reload(fy, Number(month));
  }

  async function onFinalize() {
    setBusy("finalize");
    const res = await finalizeAttendanceSheet({ fy, month: Number(month) });
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`Finalised ${res.data.count} row${res.data.count === 1 ? "" : "s"}. LOP now feeds payroll.`);
    await reload(fy, Number(month));
  }

  async function onReopen() {
    setBusy("reopen");
    const res = await reopenAttendanceSheet({ fy, month: Number(month) });
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`Reopened ${res.data.count} row${res.data.count === 1 ? "" : "s"} to draft.`);
    await reload(fy, Number(month));
  }

  function editField(row: AttendanceSheetRow, field: "present" | "leave" | "lop" | "note", value: string) {
    setDrafts((prev) => {
      const cur = prev[row.id] ?? toDraft(row);
      const next: Draft = { ...cur, [field]: value, dirty: true };
      // Live-recompute LOP when present/leave change (unless LOP was the edited field).
      if (field === "present" || field === "leave") {
        const p = Number(field === "present" ? value : next.present);
        const l = Number(field === "leave" ? value : next.leave);
        if (Number.isFinite(p) && Number.isFinite(l)) {
          next.lop = String(round2(Math.max(0, row.workingDays - p - l)));
        }
      }
      return { ...prev, [row.id]: next };
    });
  }

  async function saveRow(row: AttendanceSheetRow) {
    const d = drafts[row.id];
    if (!d) return;
    const present = Number(d.present);
    const leave = Number(d.leave);
    const lop = Number(d.lop);
    if (![present, leave, lop].every(Number.isFinite)) { toast.error("Days must be numbers."); return; }
    setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], saving: true } }));
    const res = await updateAttendanceSheetRow(row.id, {
      presentDays: present, leaveDays: leave, lopDays: lop, note: d.note,
    });
    if (!res.success) {
      setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], saving: false } }));
      toast.error(res.error);
      return;
    }
    toast.success(`${row.name} updated.`);
    await reload(fy, Number(month));
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Financial year</label>
          <Select value={fy} onValueChange={onFy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Month</label>
          <Select value={month} onValueChange={onMonth}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m) => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {allFinal ? <StatusPill label="FINAL" hue="emerald" size="sm" /> : anyFinal ? <StatusPill label="PARTIAL" hue="amber" size="sm" /> : hasRows ? <StatusPill label="DRAFT" hue="slate" size="sm" /> : null}

          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null || loading} onClick={() => onGenerate(false)}>
            {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {hasRows ? "Refresh from attendance" : "Generate"}
          </Button>

          {hasRows && !allFinal && (
            <Confirm
              trigger={<Button size="sm" variant="ghost" className="gap-1.5" disabled={busy !== null || loading}>Force refresh</Button>}
              title="Force refresh all rows?"
              description="This overwrites manual corrections on every DRAFT row with freshly-computed figures. Finalised rows are left untouched. Continue?"
              action="Force refresh"
              onConfirm={() => onGenerate(true)}
            />
          )}

          {hasRows && !allFinal && (
            <Confirm
              trigger={
                <Button size="sm" className="gap-1.5" disabled={busy !== null || loading}>
                  {busy === "finalize" ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Finalise
                </Button>
              }
              title="Finalise this attendance sheet?"
              description="Finalising locks these rows and feeds their loss-of-pay days into the salary sheet / payroll run for this month. You can reopen to edit again."
              action="Finalise"
              onConfirm={onFinalize}
            />
          )}

          {anyFinal && (
            <Confirm
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null || loading}>
                  {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />} Reopen
                </Button>
              }
              title="Reopen finalised rows?"
              description="Reopening sets finalised rows back to draft so you can correct them. Re-finalise before running payroll so the updated LOP is picked up."
              action="Reopen"
              onConfirm={onReopen}
            />
          )}
        </div>
      </div>

      {/* Payroll hint */}
      <div className="flex items-start gap-2 rounded-lg border border-indigo-200/60 bg-indigo-50/60 px-3.5 py-2.5 text-detail text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>LOP days feed payroll.</strong> When you finalise, each employee&apos;s loss-of-pay days flow straight
          into the salary sheet for this month — a payroll run for FY {fy} reads only <strong>FINAL</strong> rows. Correct the
          figures here before finalising.
        </span>
      </div>

      {/* Totals */}
      {sheet && hasRows && (
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile label="Employees" value={sheet.totals.headcount} accent="indigo" icon={<Users />} />
          <StatTile label="Present days" value={sheet.totals.presentDays} accent="emerald" icon={<CalendarDays />} />
          <StatTile label="Paid leave days" value={sheet.totals.leaveDays} accent="blue" />
          <StatTile label="LOP days" value={sheet.totals.lopDays} accent="rose" icon={<CircleSlash />} sub="→ salary sheet" />
        </div>
      )}

      {/* Table */}
      {!hasRows ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No attendance sheet for this month yet. Click <strong>Generate</strong> to build it from attendance, approved leave, weekends and holidays.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Working</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Paid leave</TableHead>
                <TableHead className="text-right">LOP</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">—</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet!.rows.map((r) => {
                const d = drafts[r.id] ?? toDraft(r);
                const isFinal = r.status === "FINAL";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="font-mono text-meta text-muted-foreground">{r.empCode}</div>
                        </div>
                        {r.edited && <StatusPill label="edited" hue="amber" size="xs" />}
                        {isFinal && <StatusPill label="final" hue="emerald" size="xs" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.workingDays}</TableCell>
                    <TableCell className="text-right">
                      <NumCell value={d.present} disabled={isFinal || d.saving} onChange={(v) => editField(r, "present", v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <NumCell value={d.leave} disabled={isFinal || d.saving} onChange={(v) => editField(r, "leave", v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <NumCell value={d.lop} disabled={isFinal || d.saving} strong onChange={(v) => editField(r, "lop", v)} />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={d.note}
                        disabled={isFinal || d.saving}
                        placeholder="—"
                        onChange={(e) => editField(r, "note", e.target.value)}
                        className="h-8 min-w-[9rem] text-detail"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!isFinal && d.dirty && (
                        <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={d.saving} onClick={() => saveRow(r)}>
                          {d.saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Totals ({sheet!.totals.headcount})</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{sheet!.totals.workingDays}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{sheet!.totals.presentDays}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{sheet!.totals.leaveDays}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{sheet!.totals.lopDays}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}

function NumCell({
  value, disabled, strong, onChange,
}: {
  value: string; disabled?: boolean; strong?: boolean; onChange: (v: string) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.5"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 w-20 text-right tabular-nums ${strong ? "font-semibold" : ""}`}
    />
  );
}

function Confirm({
  trigger, title, description, action, onConfirm,
}: {
  trigger: React.ReactNode; title: string; description: string; action: string; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
