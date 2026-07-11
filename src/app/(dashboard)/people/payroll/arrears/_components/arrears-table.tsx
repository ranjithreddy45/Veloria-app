"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, MoreHorizontal, Pencil, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
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
  cancelArrear, updateArrear,
  type ArrearListRow, type ArrearEmployeeOption,
} from "@/actions/hr-arrear.actions";
import { ArrearFormFields, type ArrearFormState } from "./arrear-form";

const MONTH_LABEL = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_HUE: Record<string, Hue> = {
  PENDING: "amber",
  PAID: "emerald",
  CANCELLED: "slate",
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const periodLabel = (month: number | null, fy: string | null): string => {
  if (!fy && !month) return "—";
  const m = month ? MONTH_LABEL[month] ?? month : null;
  if (m && fy) return `${m} · FY ${fy}`;
  if (fy) return `FY ${fy}`;
  return String(m);
};

function rowToForm(r: ArrearListRow): ArrearFormState {
  return {
    employeeId: r.employeeId,
    name: r.name,
    amount: String(r.amount),
    forFy: r.forFy ?? "",
    forMonth: r.forMonth ? String(r.forMonth) : "",
    payFy: r.payFy,
    payMonth: String(r.payMonth),
    taxable: r.taxable,
    pfApplicable: r.pfApplicable,
    esiApplicable: r.esiApplicable,
    ptApplicable: r.ptApplicable,
    reason: r.reason ?? "",
  };
}

export function ArrearsTable({
  rows,
  employees,
}: {
  rows: ArrearListRow[];
  employees: ArrearEmployeeOption[];
}) {
  const router = useRouter();

  const [editTarget, setEditTarget] = React.useState<ArrearListRow | null>(null);
  const [form, setForm] = React.useState<ArrearFormState | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<ArrearListRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  function openEdit(r: ArrearListRow) {
    setEditTarget(r);
    setForm(rowToForm(r));
  }

  function set<K extends keyof ArrearFormState>(key: K, value: ArrearFormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function doUpdate() {
    if (!editTarget || !form) return;
    if (!form.employeeId) {
      toast.error("Select an employee.");
      return;
    }
    setBusy(true);
    const res = await updateArrear(editTarget.id, {
      employeeId: form.employeeId,
      name: form.name.trim(),
      amount: Number(form.amount),
      forFy: form.forFy || undefined,
      forMonth: form.forMonth ? Number(form.forMonth) : undefined,
      payFy: form.payFy,
      payMonth: Number(form.payMonth),
      taxable: form.taxable,
      pfApplicable: form.pfApplicable,
      esiApplicable: form.esiApplicable,
      ptApplicable: form.ptApplicable,
      reason: form.reason.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Arrear updated.");
    setEditTarget(null);
    setForm(null);
    router.refresh();
  }

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    const res = await cancelArrear(cancelTarget.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Arrear cancelled.");
    setCancelTarget(null);
    router.refresh();
  }

  function exportCsv() {
    const headers = [
      "Employee", "Emp code", "Arrear", "Amount", "For period", "Pay period",
      "Taxable", "PF", "ESI", "PT", "Status", "Run",
    ];
    const data = rows.map((r) => [
      r.employeeName, r.empCode, r.name, r.amount,
      periodLabel(r.forMonth, r.forFy), periodLabel(r.payMonth, r.payFy),
      r.taxable ? "Yes" : "No", r.pfApplicable ? "Yes" : "No",
      r.esiApplicable ? "Yes" : "No", r.ptApplicable ? "Yes" : "No",
      r.status, r.runId ?? "",
    ]);
    downloadCSV(`salary-arrears-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, data));
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h3 className="text-[14px] font-semibold">Arrears</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Pending arrears are paid by the payroll run for their pay month. Paid arrears are locked.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No arrears yet. Record one with “New arrear”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Arrear</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Pay in</TableHead>
                <TableHead>Statutory</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="text-[12px] text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <div className="truncate">{r.name}</div>
                    {r.taxable ? null : (
                      <div className="text-[11px] text-muted-foreground">Non-taxable</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(r.amount)}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {periodLabel(r.forMonth, r.forFy)}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {periodLabel(r.payMonth, r.payFy)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.pfApplicable && <StatusPill label="PF" hue="indigo" size="xs" noDot />}
                      {r.esiApplicable && <StatusPill label="ESI" hue="cyan" size="xs" noDot />}
                      {r.ptApplicable && <StatusPill label="PT" hue="violet" size="xs" noDot />}
                      {!r.pfApplicable && !r.esiApplicable && !r.ptApplicable && (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill label={r.status} hue={STATUS_HUE[r.status] ?? "slate"} size="xs" />
                  </TableCell>
                  <TableCell>
                    {r.status === "PENDING" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCancelTarget(r)}>
                            <Ban className="size-4" /> Cancel arrear
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="pl-2 text-[11px] text-muted-foreground">Locked</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog (PENDING only) */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) { setEditTarget(null); setForm(null); } }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit arrear</DialogTitle>
          </DialogHeader>
          {form && (
            <ArrearFormFields state={form} set={set} employees={employees} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doUpdate} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm (PENDING only) */}
      <AlertDialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this arrear?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `${cancelTarget.name} (${inr(cancelTarget.amount)}) for ${cancelTarget.employeeName} will be marked cancelled and will not be paid by any payroll run.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep arrear</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doCancel(); }} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />} Cancel arrear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
