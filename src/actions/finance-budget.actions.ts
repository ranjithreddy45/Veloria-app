"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// ============================================================
// Finance — Budgets. Budgeting + budget-vs-actual variance. No GL posting:
// budgets are plan figures kept in FinBudget/FinBudgetLine; "actuals" are read
// from posted journal lines for the same FY, grouped by account, using each
// account's natural balance (INCOME = credit−debit, EXPENSE = debit−credit).
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canFinance = (r?: string) => !!r && FINANCE_ROLES.includes(r);

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getBudgets() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  const budgets = await prisma.finBudget.findMany({
    include: { lines: { select: { id: true, accountCode: true, period: true, amount: true } } },
    orderBy: [{ fy: "desc" }, { createdAt: "desc" }],
  });
  return budgets.map((b) => ({
    id: b.id,
    fy: b.fy,
    name: b.name,
    status: b.status,
    lineCount: b.lines.length,
    total: b.lines.reduce((s, l) => s + Number(l.amount), 0),
    lines: b.lines.map((l) => ({
      id: l.id,
      accountCode: l.accountCode,
      period: l.period,
      amount: Number(l.amount),
    })),
  }));
}

// Income + expense accounts only — the ones you budget against.
export async function getAccountsForBudget() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  const accounts = await prisma.finAccount.findMany({
    where: { isActive: true, type: { in: ["INCOME", "EXPENSE"] } },
    select: { code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return accounts.map((a) => ({ code: a.code, name: a.name, type: String(a.type) }));
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------
export async function createBudget(input: { fy: string; name: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  const fy = input.fy?.trim();
  const name = input.name?.trim();
  if (!fy) return { success: false, error: "Financial year is required." };
  if (!name) return { success: false, error: "Name is required." };
  const created = await prisma.finBudget.create({
    data: { fy, name, createdById: u!.id },
  });
  revalidatePath("/finance/budgets");
  return { success: true, data: { id: created.id } };
}

export async function addBudgetLine(input: {
  budgetId: string;
  accountCode: string;
  period: number;
  amount: number;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.budgetId) return { success: false, error: "Budget is required." };
  if (!input.accountCode) return { success: false, error: "Account is required." };
  const period = Number.isFinite(input.period) ? Math.trunc(input.period) : 0;
  if (period < 0 || period > 12) return { success: false, error: "Period must be 0 (annual) or 1–12." };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter an amount greater than zero." };

  const budget = await prisma.finBudget.findUnique({ where: { id: input.budgetId } });
  if (!budget) return { success: false, error: "Budget not found." };
  const account = await prisma.finAccount.findUnique({ where: { code: input.accountCode } });
  if (!account) return { success: false, error: "Account not found." };

  const created = await prisma.finBudgetLine.create({
    data: {
      budgetId: budget.id,
      accountCode: account.code,
      period,
      amount: new Prisma.Decimal(amount.toFixed(2)),
    },
  });
  revalidatePath("/finance/budgets");
  return { success: true, data: { id: created.id } };
}

export async function deleteBudgetLine(id: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  if (!id) return { success: false, error: "Line is required." };
  try {
    await prisma.finBudgetLine.delete({ where: { id } });
  } catch {
    return { success: false, error: "Line not found." };
  }
  revalidatePath("/finance/budgets");
  return { success: true, data: { ok: true } };
}

// ------------------------------------------------------------
// Budget-vs-actual variance. Budget per account = Σ of its lines (any period).
// Actual per account = posted journal lines in the budget's FY, natural balance.
// variance = actual − budget; favorable depends on type (income over = good,
// expense under = good). pct = actual / budget (% of budget consumed/earned).
// ------------------------------------------------------------
export interface VarianceRow {
  accountCode: string;
  accountName: string;
  type: string;
  budget: number;
  actual: number;
  variance: number;
  pct: number;
}

export async function getBudgetVariance(budgetId: string): Promise<{
  rows: VarianceRow[];
  totals: { budget: number; actual: number; variance: number; pct: number };
}> {
  const empty = { rows: [], totals: { budget: 0, actual: 0, variance: 0, pct: 0 } };
  const u = await requireUser();
  if (!canFinance(u?.role)) return empty;
  if (!budgetId) return empty;

  const budget = await prisma.finBudget.findUnique({
    where: { id: budgetId },
    include: { lines: { select: { accountCode: true, amount: true } } },
  });
  if (!budget) return empty;

  // Budget per account (sum across all periods).
  const budgetByCode = new Map<string, number>();
  for (const l of budget.lines) {
    budgetByCode.set(l.accountCode, (budgetByCode.get(l.accountCode) ?? 0) + Number(l.amount));
  }

  // Accounts referenced (by budget lines) — fetch names + types.
  const codes = [...budgetByCode.keys()];
  const accounts = codes.length
    ? await prisma.finAccount.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true, name: true, type: true },
      })
    : [];
  const acctByCode = new Map(accounts.map((a) => [a.code, a]));
  const acctById = new Map(accounts.map((a) => [a.id, a]));

  // Actuals: posted journal lines for these accounts in the budget's FY.
  const actualByCode = new Map<string, number>();
  if (accounts.length) {
    const grouped = await prisma.finJournalLine.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        entry: { status: "POSTED", fy: budget.fy },
      },
      _sum: { debit: true, credit: true },
    });
    for (const g of grouped) {
      const acct = acctById.get(g.accountId);
      if (!acct) continue;
      const debit = Number(g._sum.debit ?? 0);
      const credit = Number(g._sum.credit ?? 0);
      const actual = String(acct.type) === "INCOME" ? credit - debit : debit - credit;
      actualByCode.set(acct.code, actual);
    }
  }

  const rows: VarianceRow[] = codes
    .map((code) => {
      const acct = acctByCode.get(code);
      const budgetAmt = budgetByCode.get(code) ?? 0;
      const actual = actualByCode.get(code) ?? 0;
      return {
        accountCode: code,
        accountName: acct?.name ?? code,
        type: acct ? String(acct.type) : "EXPENSE",
        budget: budgetAmt,
        actual,
        variance: actual - budgetAmt,
        pct: budgetAmt !== 0 ? (actual / budgetAmt) * 100 : 0,
      };
    })
    .sort((a, b) => (a.type === b.type ? a.accountCode.localeCompare(b.accountCode) : a.type.localeCompare(b.type)));

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  return {
    rows,
    totals: {
      budget: totalBudget,
      actual: totalActual,
      variance: totalActual - totalBudget,
      pct: totalBudget !== 0 ? (totalActual / totalBudget) * 100 : 0,
    },
  };
}
