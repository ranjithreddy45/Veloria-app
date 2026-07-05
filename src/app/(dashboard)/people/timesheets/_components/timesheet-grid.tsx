"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Save, Send, Check, X, Clock3, BadgeCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile, type Accent } from "@/components/ui/stat-tile";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  getMyTimesheet,
  saveTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  type TimesheetDTO,
  type PendingTimesheetDTO,
} from "@/actions/timesheet.actions";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Status = TimesheetDTO["status"];

function statusBadge(status: Status) {
  switch (status) {
    case "SUBMITTED":
      return <Badge className="border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Submitted</Badge>;
    case "APPROVED":
      return <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Approved</Badge>;
    case "REJECTED":
      return <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Rejected</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

const STATUS_TILE: Record<string, { label: string; accent: Accent }> = {
  DRAFT: { label: "Draft", accent: "amber" },
  SUBMITTED: { label: "Submitted", accent: "blue" },
  APPROVED: { label: "Approved", accent: "emerald" },
  REJECTED: { label: "Rejected", accent: "rose" },
};

/** Add `days` to an ISO date (yyyy-mm-dd), returning ISO date. */
function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function thisMondayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  const dow = ist.getUTCDay();
  const diff = (dow + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - diff))
    .toISOString()
    .slice(0, 10);
}

type Row = { date: string; hours: string; project: string; notes: string };

function toRows(ts: TimesheetDTO): Row[] {
  return ts.entries.map((e) => ({
    date: e.date,
    hours: e.hours ? String(e.hours) : "",
    project: e.project ?? "",
    notes: e.notes ?? "",
  }));
}

export function TimesheetGrid({
  initial,
  initialApprovals,
  canApprove,
}: {
  initial: TimesheetDTO;
  initialApprovals: PendingTimesheetDTO[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = React.useState(initial.weekStart);
  const [ts, setTs] = React.useState<TimesheetDTO>(initial);
  const [rows, setRows] = React.useState<Row[]>(() => toRows(initial));
  const [note, setNote] = React.useState(initial.note ?? "");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<"save" | "submit" | null>(null);

  const editable = ts.editable;

  const total = React.useMemo(
    () => Math.round(rows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0) * 100) / 100,
    [rows]
  );

  // Goal-gradient: days with hours logged this week (derived from local state).
  const filledDays = React.useMemo(
    () => rows.filter((r) => (parseFloat(r.hours) || 0) > 0).length,
    [rows]
  );

  async function loadWeek(iso: string) {
    setLoading(true);
    const data = await getMyTimesheet(iso);
    setLoading(false);
    if (!data) {
      toast.error("Couldn't load that week.");
      return;
    }
    setWeekStart(data.weekStart);
    setTs(data);
    setRows(toRows(data));
    setNote(data.note ?? "");
  }

  function nav(days: number) {
    void loadWeek(shiftISO(weekStart, days));
  }
  function goThisWeek() {
    void loadWeek(thisMondayISO());
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function payload() {
    return rows.map((r) => ({
      date: r.date,
      hours: parseFloat(r.hours) || 0,
      project: r.project || null,
      notes: r.notes || null,
    }));
  }

  async function doSave(): Promise<boolean> {
    setBusy("save");
    const res = await saveTimesheet(weekStart, payload(), note || undefined);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error);
      return false;
    }
    toast.success("Draft saved.");
    await loadWeek(weekStart);
    return true;
  }

  async function doSubmit() {
    setBusy("submit");
    const saved = await saveTimesheet(weekStart, payload(), note || undefined);
    if (!saved.success) {
      setBusy(null);
      toast.error(saved.error);
      return;
    }
    const res = await submitTimesheet(weekStart);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Timesheet submitted for approval.");
    await loadWeek(weekStart);
    router.refresh();
  }

  const weekEnd = shiftISO(weekStart, 6);
  const statusTile = STATUS_TILE[ts.status] ?? STATUS_TILE.DRAFT;

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className={`grid grid-cols-2 gap-3 ${canApprove ? "sm:grid-cols-3" : ""}`}>
        <StatTile
          label="Total hours"
          value={total.toFixed(2)}
          accent="indigo"
          icon={<Clock3 className="size-4" />}
          sub="logged this week"
        />
        <StatTile
          label="Week status"
          value={statusTile.label}
          accent={statusTile.accent}
          icon={<BadgeCheck className="size-4" />}
          sub={`${formatDate(weekStart)} → ${formatDate(weekEnd)}`}
        />
        {canApprove && (
          <StatTile
            label="Pending approvals"
            value={initialApprovals.length}
            accent="amber"
            icon={<Inbox className="size-4" />}
            sub="timesheets waiting on you"
            className="col-span-2 sm:col-span-1"
          />
        )}
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                <CalendarDays className="size-4 text-muted-foreground" />
                {formatDate(weekStart)} <span className="text-muted-foreground">→</span> {formatDate(weekEnd)}
              </h2>
              {statusBadge(ts.status)}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => nav(-7)} disabled={loading} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goThisWeek} disabled={loading}>
                This week
              </Button>
              <Button variant="outline" size="icon" onClick={() => nav(7)} disabled={loading} aria-label="Next week">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          {ts.status === "REJECTED" && ts.note && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              This timesheet was rejected. Update it and resubmit.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-32 py-2 pr-3 font-medium">Day</th>
                  <th className="w-28 py-2 pr-3 font-medium">Hours</th>
                  <th className="w-48 py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.date} className="border-b last:border-0">
                    <td className="py-2 pr-3 align-middle">
                      <div className="font-medium">{DOW[i]}</div>
                      <div className="text-[12px] text-muted-foreground tabular-nums">{formatDate(r.date)}</div>
                    </td>
                    <td className="py-2 pr-3 align-middle">
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        inputMode="decimal"
                        className="h-9 w-24 text-right tabular-nums"
                        value={r.hours}
                        disabled={!editable}
                        placeholder="0"
                        onChange={(e) => updateRow(i, { hours: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3 align-middle">
                      <Input
                        className="h-9"
                        value={r.project}
                        disabled={!editable}
                        placeholder="Optional"
                        onChange={(e) => updateRow(i, { project: e.target.value })}
                      />
                    </td>
                    <td className="py-2 align-middle">
                      <Input
                        className="h-9"
                        value={r.notes}
                        disabled={!editable}
                        placeholder="Optional"
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-2 pr-3 text-[13px] font-semibold">Total</td>
                  <td className="py-2 pr-3 text-right text-[15px] font-semibold tabular-nums">{total.toFixed(2)}</td>
                  <td colSpan={2} className="py-2 text-[12px] text-muted-foreground">hours this week</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Week note</label>
            <Input
              value={note}
              disabled={!editable}
              placeholder="Optional summary for your manager"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {ts.status === "DRAFT" && filledDays > 0 ? (
              <p
                className={`text-[12px] ${
                  filledDays >= 6
                    ? "font-medium text-emerald-600"
                    : "text-muted-foreground"
                }`}
              >
                {filledDays >= 6
                  ? "Almost done — submit your week"
                  : `${filledDays} of 7 days filled — submit when ready`}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {editable
                  ? "Draft — edit freely, then submit for approval."
                  : ts.status === "SUBMITTED"
                    ? "Submitted — waiting on manager approval."
                    : ts.status === "APPROVED"
                      ? "Approved and locked."
                      : ""}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={doSave} disabled={!editable || busy !== null || loading} className="gap-1.5">
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
              </Button>
              <Button onClick={doSubmit} disabled={!editable || busy !== null || loading} className="gap-1.5">
                {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {canApprove && <PendingApprovals initial={initialApprovals} />}
    </div>
  );
}

function PendingApprovals({ initial }: { initial: PendingTimesheetDTO[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);

  React.useEffect(() => setRows(initial), [initial]);

  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 px-5 py-5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          <Inbox className="size-4 text-muted-foreground" /> Pending approvals
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
            No timesheets waiting on you.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <ApprovalRow key={r.id} row={r} onDone={() => { remove(r.id); router.refresh(); }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalRow({ row, onDone }: { row: PendingTimesheetDTO; onDone: () => void }) {
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = React.useState("");
  const weekEnd = shiftISO(row.weekStart, 6);

  async function decide(kind: "APPROVED" | "REJECTED") {
    setBusy(kind);
    const res = kind === "APPROVED" ? await approveTimesheet(row.id) : await rejectTimesheet(row.id, reason || undefined);
    if (!res.success) {
      toast.error(res.error);
      setBusy(null);
      return;
    }
    toast.success(kind === "APPROVED" ? "Approved." : "Rejected.");
    onDone();
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{row.ownerName}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>
              {formatDate(row.weekStart)} → {formatDate(weekEnd)}
            </span>
            <span className="font-semibold tabular-nums text-foreground">· {row.totalHours.toFixed(2)} h</span>
          </div>
          {row.note && <p className="mt-1 text-[12.5px] text-muted-foreground">“{row.note}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reject reason (optional)"
            className="h-8 w-48 text-[12.5px]"
          />
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("REJECTED")}>
            {busy === "REJECTED" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Reject
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("APPROVED")}>
            {busy === "APPROVED" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
          </Button>
        </div>
      </div>

      {row.entries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.entries.map((e) => (
            <span
              key={e.date}
              className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11.5px] tabular-nums text-muted-foreground"
            >
              {formatDate(e.date)}: {e.hours}h{e.project ? ` · ${e.project}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
