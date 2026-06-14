import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import {
  getBudgets, getAccountsForBudget, getBudgetVariance,
} from "@/actions/finance-budget.actions";
import { BudgetsWorkspace } from "../_components/budgets-workspace";

export const metadata = { title: "Budgets · Veloria Grand" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");
  const canManage = ["SUPER_ADMIN", "ADMIN", "FINANCE"].includes(role);

  const { budget: budgetParam } = await searchParams;
  const [budgets, accounts] = await Promise.all([getBudgets(), getAccountsForBudget()]);
  const active = budgets.find((b) => b.id === budgetParam) ?? budgets[0] ?? null;
  const variance = active
    ? await getBudgetVariance(active.id)
    : { rows: [], totals: { budget: 0, actual: 0, variance: 0, pct: 0 } };

  return (
    <div className="space-y-6 p-6">
      <BudgetsWorkspace
        canManage={canManage}
        budgets={budgets.map((b) => ({ id: b.id, fy: b.fy, name: b.name, status: b.status, lineCount: b.lineCount, total: b.total }))}
        activeId={active?.id ?? null}
        activeLines={active?.lines ?? []}
        accounts={accounts}
        variance={variance}
      />
    </div>
  );
}
