"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download, MoreHorizontal, CalendarOff, Power, PowerOff, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  endRecurring, toggleRecurring, deleteRecurring,
  type RecurringListRow,
} from "@/actions/hr-recurring.actions";

const MONTH_LABEL = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS = MONTH_LABEL.slice(1).map((label, i) => ({ v: i + 1, label }));

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const startLabel = (r: { startMonth: number; startFy: string }) =>
  `${MONTH_LABEL[r.startMonth] ?? r.startMonth} · FY ${r.startFy}`;

const endLabel = (r: { endMonth: number | null; endFy: string | null }) =>
  r.endFy && r.endMonth ? `${MONTH_LABEL[r.endMonth] ?? r.endMonth} · FY ${r.endFy}` : "Open-ended";

function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentFyStart = m >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = currentFyStart + 2; s >= currentFyStart - 2; s--) {
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

export function RecurringTable({ rows }: { rows: RecurringListRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const fys = React.useMemo(fyOptions, []);

  const [endTarget, setEndTarget] = React.useState<RecurringListRow | null>(null);
  const [endFy, setEndFy] = React.useState(fys[2] ?? "");
  const [endMonth, setEndMonth] = React.useState("3");

  const [deleteTarget, setDeleteTarget] = React.useState<RecurringListRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  function openEnd(r: RecurringListRow) {
    setEndTarget(r);
    setEndFy(r.endFy ?? fys[2] ?? "");
    setEndMonth(String(r.endMonth ?? 3));
  }

  async function doEnd() {
    if (!endTarget) return;
    setBusy(true);
    const res = await endRecurring(endTarget.id, { endFy, endMonth: Number(endMonth) });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("End date set.");
    setEndTarget(null);
    router.refresh();
  }

  function doToggle(r: RecurringListRow) {
    startTransition(async () => {
      const res = await toggleRecurring(r.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.active ? "Component activated." : "Component paused.");
      router.refresh();
    });
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteRecurring(deleteTarget.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Component deleted.");
    setDeleteTarget(null);
    router.refresh();
  }

  function exportCsv() {
    const headers = [
      "Employee", "Emp code", "Type", "Code", "Name", "Amount", "Taxable",
      "PF", "ESI", "PT", "Starts", "Ends", "Active",
    ];
    const data = rows.map((r) => [
      r.employeeName, r.empCode, r.kind, r.code, r.name, r.amount,
      r.taxable ? "Yes" : "No", r.pfApplicable ? "Yes" : "No",
      r.esiApplicable ? "Yes" : "No", r.ptApplicable ? "Yes" : "No",
      startLabel(r), endLabel(r), r.active ? "Active" : "Paused",
    ]);
    downloadCSV(`recurring-pay-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, data));
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h3 className="text-[14px] font-semibold">Recurring components</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Earnings add to salary; deductions subtract. Paused components are skipped by payroll.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No recurring pay yet. Add one with “New recurring”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.active ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="text-[12px] text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-[12px] text-muted-foreground">{r.code}</div>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={r.kind === "EARNING" ? "Earning" : "Deduction"}
                      hue={r.kind === "EARNING" ? "emerald" : "rose"}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(r.amount)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.taxable && <Tag label="Taxable" hue="amber" />}
                      {r.pfApplicable && <Tag label="PF" hue="indigo" />}
                      {r.esiApplicable && <Tag label="ESI" hue="sky" />}
                      {r.ptApplicable && <Tag label="PT" hue="violet" />}
                      {!r.taxable && !r.pfApplicable && !r.esiApplicable && !r.ptApplicable && (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    <div>{startLabel(r)}</div>
                    <div>→ {endLabel(r)}</div>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={r.active ? "Active" : "Paused"}
                      hue={r.active ? "emerald" : "slate"}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => doToggle(r)} disabled={isPending}>
                          {r.active ? (
                            <>
                              <PowerOff className="size-4" /> Pause
                            </>
                          ) : (
                            <>
                              <Power className="size-4" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEnd(r)}>
                          <CalendarOff className="size-4" /> Set end date
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* End-date dialog */}
      <Dialog open={endTarget !== null} onOpenChange={(o) => !o && setEndTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set end date</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            {endTarget ? `${endTarget.name} · ${endTarget.employeeName}` : ""} stops applying after
            this month. It still applies up to and including it.
          </p>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">FY</Label>
              <Select value={endFy} onValueChange={setEndFy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fys.map((f) => (
                    <SelectItem key={f} value={f}>
                      FY {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Month</Label>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.v} value={String(m.v)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doEnd} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Set end date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this component?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” for ${deleteTarget.employeeName} will be removed permanently. Past payroll runs are unaffected. To simply stop it going forward, pause it or set an end date instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tag({ label, hue }: { label: string; hue: Hue }) {
  return <StatusPill label={label} hue={hue} size="xs" />;
}
