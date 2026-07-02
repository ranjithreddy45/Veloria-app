"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Loader2, Wallet, TrendingUp, Scale, Target, Trash2, PiggyBank,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Donut } from "@/components/ui/donut";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { formatINR, cn } from "@/lib/utils";
import { createBudget, addBudgetLine, deleteBudgetLine } from "@/actions/finance-budget.actions";

interface BudgetSummary { id: string; fy: string; name: string; status: string; lineCount: number; total: number }
interface BudgetLine { id: string; accountCode: string; period: number; amount: number }
interface AccountOption { code: string; name: string; type: string }
interface VarianceRow {
  accountCode: string; accountName: string; type: string;
  budget: number; actual: number; variance: number; pct: number;
}
interface Variance {
  rows: VarianceRow[];
  totals: { budget: number; actual: number; variance: number; pct: number };
}

const PERIOD_LABELS = [
  "Annual", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

// Favorable: income above plan, or expense below plan.
function isFavorable(type: string, variance: number): boolean {
  if (variance === 0) return true;
  return type === "INCOME" ? variance > 0 : variance < 0;
}

export function BudgetsWorkspace({
  canManage, budgets, activeId, activeLines, accounts, variance,
}: {
  canManage: boolean;
  budgets: BudgetSummary[];
  activeId: string | null;
  activeLines: BudgetLine[];
  accounts: AccountOption[];
  variance: Variance;
}) {
  const router = useRouter();
  const active = budgets.find((b) => b.id === activeId) ?? null;
  const accountName = React.useMemo(
    () => new Map(accounts.map((a) => [a.code, a.name])),
    [accounts],
  );

  const header = (
    <PageHeader eyebrow="Finance · Budgets" title="Budgets" help={<PageHelp id="budget" />} description="Plan figures by account and track budget-vs-actual variance for the year.">
      {canManage && <NewBudgetDialog onDone={() => router.refresh()} />}
    </PageHeader>
  );

  if (budgets.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="border-0 shadow-card">
          <EmptyState
            icon={<PiggyBank className="size-5" />}
            title="No budgets yet"
            description={canManage ? "Create a budget for a financial year, then add lines per account." : "Ask a finance admin to create a budget."}
            action={canManage ? <NewBudgetDialog onDone={() => router.refresh()} /> : undefined}
          />
        </Card>
      </div>
    );
  }

  const { totals } = variance;
  const pctUsed = Math.round(totals.pct);
  const totalFavorable = isFavorable("EXPENSE", totals.variance) ? totals.variance <= 0 : false;

  return (
    <div className="space-y-6">
      {header}

      {/* Budget selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Budget</span>
          <Select
            value={activeId ?? undefined}
            onValueChange={(v) => router.push(`/finance/budgets?budget=${v}`)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a budget" />
            </SelectTrigger>
            <SelectContent>
              {budgets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} · FY {b.fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {active && (
            <StatusPill
              label={active.status === "ACTIVE" ? "Active" : "Archived"}
              hue={active.status === "ACTIVE" ? "emerald" : "neutral"}
              size="xs"
            />
          )}
        </div>
        {canManage && active && (
          <AddLineDialog budgetId={active.id} accounts={accounts} onDone={() => router.refresh()} />
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total budgeted" accent="indigo" icon={<Wallet className="size-4" />} value={formatINR(totals.budget)} />
        <StatTile label="Total actual" accent="blue" icon={<TrendingUp className="size-4" />} value={formatINR(totals.actual)} />
        <StatTile
          label="Variance"
          accent={totalFavorable ? "emerald" : "rose"}
          icon={<Scale className="size-4" />}
          value={<span className={cn(totalFavorable ? "text-emerald-600" : "text-rose-600")}>{totals.variance > 0 ? "+" : ""}{formatINR(totals.variance)}</span>}
          sub={totalFavorable ? "Under / over plan favorably" : "Over plan"}
        />
        <StatTile
          label="% used"
          accent="violet"
          icon={<Target className="size-4" />}
          value={`${pctUsed}%`}
          pct={Math.max(0, Math.min(100, pctUsed))}
        />
      </div>

      {/* Variance table */}
      <Card className="overflow-hidden border-0 shadow-card">
        {variance.rows.length === 0 ? (
          <EmptyState
            icon={<Plus className="size-5" />}
            title="No budget lines yet"
            description={canManage ? "Add a line to plan a figure for an account." : "This budget has no lines."}
            action={canManage && active ? <AddLineDialog budgetId={active.id} accounts={accounts} onDone={() => router.refresh()} /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="w-[140px]">Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variance.rows.map((r) => {
                const fav = isFavorable(r.type, r.variance);
                const barPct = Math.max(0, Math.min(100, Math.round(r.pct)));
                return (
                  <TableRow key={r.accountCode}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-muted-foreground">{r.accountCode}</span>
                        <span>{r.accountName}</span>
                        <StatusPill label={r.type === "INCOME" ? "Income" : "Expense"} hue={r.type === "INCOME" ? "emerald" : "amber"} size="xs" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.budget)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.actual)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums font-medium", fav ? "text-emerald-600" : "text-rose-600")}>
                      {r.variance > 0 ? "+" : ""}{formatINR(r.variance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span
                            aria-hidden
                            className={cn("block h-full rounded-full", fav ? "bg-emerald-500" : "bg-rose-500")}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{barPct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatINR(totals.budget)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatINR(totals.actual)}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums", totalFavorable ? "text-emerald-600" : "text-rose-600")}>
                  {totals.variance > 0 ? "+" : ""}{formatINR(totals.variance)}
                </td>
                <td className="px-4 py-2">
                  <Donut value={Math.max(0, Math.min(100, pctUsed))} size={36} thickness={4} colorClass="text-violet-500" />
                </td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {/* Budget lines (with delete) */}
      {canManage && activeLines.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-card">
          <div className="border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">Budget lines</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-[12px] text-muted-foreground">{l.accountCode}</span>
                    <span className="ml-2">{accountName.get(l.accountCode) ?? ""}</span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{PERIOD_LABELS[l.period] ?? `P${l.period}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(l.amount)}</TableCell>
                  <TableCell>
                    <DeleteLineButton id={l.id} onDone={() => router.refresh()} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// New budget dialog
// ------------------------------------------------------------
function NewBudgetDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [fy, setFy] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createBudget({ fy, name });
      if (res.success) {
        toast.success("Budget created.");
        setOpen(false);
        setFy(""); setName("");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" /> New budget</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>Create a budget for a financial year. Add account lines after.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="budget-fy">Financial year</Label>
            <Input id="budget-fy" placeholder="2026-27" value={fy} onChange={(e) => setFy(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-name">Name</Label>
            <Input id="budget-name" placeholder="Operating budget" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !fy.trim() || !name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Add line dialog
// ------------------------------------------------------------
function AddLineDialog({ budgetId, accounts, onDone }: { budgetId: string; accounts: AccountOption[]; onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [accountCode, setAccountCode] = React.useState("");
  const [period, setPeriod] = React.useState("0");
  const [amount, setAmount] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const res = await addBudgetLine({
        budgetId,
        accountCode,
        period: Number(period),
        amount: Number(amount),
      });
      if (res.success) {
        toast.success("Line added.");
        setOpen(false);
        setAccountCode(""); setPeriod("0"); setAmount("");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="size-4" /> Add line</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget line</DialogTitle>
          <DialogDescription>Plan an amount for an account and period.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountCode} onValueChange={setAccountCode}>
              <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.code} value={a.code}>
                    <span className="font-mono text-[12px] text-muted-foreground">{a.code}</span> {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_LABELS.map((lbl, i) => (
                    <SelectItem key={i} value={String(i)}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-amount">Amount (₹)</Label>
              <Input id="line-amount" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !accountCode || !amount || Number(amount) <= 0}>
            {pending && <Loader2 className="size-4 animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Delete line
// ------------------------------------------------------------
function DeleteLineButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, startTransition] = React.useTransition();
  function remove() {
    startTransition(async () => {
      const res = await deleteBudgetLine(id);
      if (res.success) {
        toast.success("Line removed.");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }
  return (
    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-600" onClick={remove} disabled={pending} aria-label="Delete line">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
