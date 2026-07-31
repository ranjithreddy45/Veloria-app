"use client";

// ============================================================
// Finance — Payroll workspace (client). Two tabs:
//   • Employees   — KPIs + roster table + "Add employee" dialog.
//   • Payroll runs — runs table with status pill; "New run" computes a
//     DRAFT run, and each DRAFT can be posted to the GL as a balanced
//     salary journal entry (with confirm).
// API: finance-payroll.actions.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Wallet, Gauge, UserPlus, CalendarPlus, Send, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { formatINR } from "@/lib/utils";
import { createEmployee, createPayrollRun, postPayrollRun } from "@/actions/finance-payroll.actions";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

interface Employee {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  ctcMonthly: number;
  basicPct: number;
  pan: string | null;
  bankLast4: string | null;
  isActive: boolean;
}
interface Run {
  id: string;
  fy: string;
  period: number;
  label: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  journalEntryId: string | null;
  payslipCount: number;
}

const STATUS_HUE: Record<string, Hue> = { DRAFT: "amber", POSTED: "emerald" };

export function PayrollWorkspace({
  canWrite,
  employees,
  runs,
}: {
  canWrite: boolean;
  employees: Employee[];
  runs: Run[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run<T>(
    key: string,
    fn: () => Promise<{ success: boolean; error?: string; data?: T }>,
    ok: (d?: T) => string,
    after?: () => void,
  ): Promise<boolean> {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error);
        return false;
      }
      toast.success(ok(res.data));
      after?.();
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const active = employees.filter((e) => e.isActive);
  const headcount = active.length;
  const monthlyPayroll = active.reduce((s, e) => s + e.ctcMonthly, 0);
  const avgCtc = headcount > 0 ? Math.round(monthlyPayroll / headcount) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        accent="gold"
        eyebrow="Finance · Payroll"
        title="Payroll"
        description="Maintain the salaried roster, run monthly payroll, and post a balanced salary journal to the ledger."
      />

      <Tabs defaultValue="employees" className="space-y-5">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="runs">Payroll runs</TabsTrigger>
        </TabsList>

        {/* ---------------- Employees ---------------- */}
        <TabsContent value="employees" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Headcount" value={headcount} accent="indigo" icon={<Users className="size-4" />} sub="Active employees" />
            <StatTile label="Monthly payroll" value={formatINR(monthlyPayroll)} accent="emerald" icon={<Wallet className="size-4" />} sub="Sum of active CTC" />
            <StatTile label="Average CTC" value={formatINR(avgCtc)} accent="gold" icon={<Gauge className="size-4" />} sub="Per active employee / month" />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Roster</h2>
            {canWrite && (
              <AddEmployeeDialog
                busy={busy === "add-emp"}
                onSubmit={(d, close) =>
                  run("add-emp", () => createEmployee(d), () => "Employee added.", close)
                }
              />
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            {employees.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No employees yet"
                description="Add your salaried staff to start running payroll."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Monthly CTC</TableHead>
                    <TableHead className="text-right">Basic %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.designation ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.department ?? "—"}</TableCell>
                      <TableCell className="text-right numeric">{formatINR(e.ctcMonthly)}</TableCell>
                      <TableCell className="text-right numeric">{e.basicPct}%</TableCell>
                      <TableCell>
                        <StatusPill label={e.isActive ? "Active" : "Inactive"} hue={e.isActive ? "emerald" : "slate"} size="xs" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ---------------- Payroll runs ---------------- */}
        <TabsContent value="runs" className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Runs</h2>
            {canWrite && (
              <NewRunDialog
                busy={busy === "new-run"}
                onSubmit={(d, close) =>
                  run("new-run", () => createPayrollRun(d), () => "Payroll run created (DRAFT).", close)
                }
              />
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            {runs.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-5" />}
                title="No payroll runs yet"
                description="Create a run to compute salaries for the active roster, then post it to the ledger."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.fy} · P{r.period} · {r.payslipCount} payslip{r.payslipCount === 1 ? "" : "s"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right numeric">{formatINR(r.totalGross)}</TableCell>
                      <TableCell className="text-right numeric">{formatINR(r.totalDeductions)}</TableCell>
                      <TableCell className="text-right font-medium numeric">{formatINR(r.totalNet)}</TableCell>
                      <TableCell>
                        <StatusPill label={r.status} hue={STATUS_HUE[r.status] ?? "slate"} size="xs" />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "DRAFT" && canWrite ? (
                          <PostRunButton
                            run={r}
                            busy={busy === `post-${r.id}`}
                            onPost={() =>
                              run(
                                `post-${r.id}`,
                                () => postPayrollRun(r.id),
                                (d) => `Posted to ledger — ${d?.entryNo ?? "JE"}.`,
                              )
                            }
                          />
                        ) : r.journalEntryId ? (
                          <span className="text-[11px] text-muted-foreground">Posted</span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------
// Add employee dialog
// ------------------------------------------------------------
function AddEmployeeDialog({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (
    d: { name: string; designation?: string; department?: string; ctcMonthly: number; basicPct?: number; pan?: string; bankLast4?: string },
    close: () => void,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [ctc, setCtc] = React.useState("");
  const [basicPct, setBasicPct] = React.useState("50");
  const [pan, setPan] = React.useState("");
  const [bankLast4, setBankLast4] = React.useState("");

  function reset() {
    setName("");
    setDesignation("");
    setDepartment("");
    setCtc("");
    setBasicPct("50");
    setPan("");
    setBankLast4("");
  }

  async function submit() {
    const ctcMonthly = Number(ctc);
    if (!name.trim()) return toast.error("Name is required.");
    if (!Number.isFinite(ctcMonthly) || ctcMonthly <= 0) return toast.error("Enter a valid monthly CTC.");
    await onSubmit(
      {
        name,
        designation: designation || undefined,
        department: department || undefined,
        ctcMonthly,
        basicPct: basicPct ? Number(basicPct) : undefined,
        pan: pan || undefined,
        bankLast4: bankLast4 || undefined,
      },
      () => {
        reset();
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>Salaried staff included in monthly payroll runs.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha Menon" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="emp-desig">Designation</Label>
              <Input id="emp-desig" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Event Manager" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="emp-dept">Department</Label>
              <Input id="emp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Operations" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="emp-ctc">Monthly CTC (₹)</Label>
              <Input id="emp-ctc" type="number" inputMode="decimal" value={ctc} onChange={(e) => setCtc(e.target.value)} placeholder="60000" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="emp-basic">Basic %</Label>
              <Input id="emp-basic" type="number" inputMode="numeric" value={basicPct} onChange={(e) => setBasicPct(e.target.value)} placeholder="50" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="emp-pan">PAN</Label>
              <Input id="emp-pan" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="emp-bank">Bank (last 4)</Label>
              <Input id="emp-bank" value={bankLast4} onChange={(e) => setBankLast4(e.target.value)} placeholder="4321" maxLength={4} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Add employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// New run dialog
// ------------------------------------------------------------
function NewRunDialog({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (d: { fy: string; period: number; label: string }, close: () => void) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [fy, setFy] = React.useState("");
  const [period, setPeriod] = React.useState("");
  const [label, setLabel] = React.useState("");

  function reset() {
    setFy("");
    setPeriod("");
    setLabel("");
  }

  async function submit() {
    const p = Number(period);
    if (!fy.trim()) return toast.error("Financial year is required (e.g. 2026-27).");
    if (!Number.isFinite(p) || p < 1 || p > 12) return toast.error("Period must be 1–12 (Apr=1).");
    if (!label.trim()) return toast.error("Label is required (e.g. Apr 2026).");
    await onSubmit({ fy: fy.trim(), period: p, label: label.trim() }, () => {
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="size-4" /> New run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>
            Computes gross, PF, ESI, PT and net for every active employee. The run is saved as a DRAFT — post it to the ledger when ready.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="run-fy">Financial year</Label>
              <Input id="run-fy" value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2026-27" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="run-period">Period (Apr=1)</Label>
              <Input id="run-period" type="number" inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="1" min={1} max={12} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="run-label">Label</Label>
            <Input id="run-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apr 2026" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Create run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Post-to-ledger button (with confirm)
// ------------------------------------------------------------
function PostRunButton({
  run,
  busy,
  onPost,
}: {
  run: Run;
  busy: boolean;
  onPost: () => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);

  async function confirm() {
    const ok = await onPost();
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="size-4" /> Post to ledger
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post {run.label} to the ledger?</DialogTitle>
          <DialogDescription>
            This posts a balanced salary journal entry: salaries expense {formatINR(run.totalGross)} debited; net pay {formatINR(run.totalNet)} and statutory deductions {formatINR(run.totalDeductions)} credited. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Post to ledger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
