"use server";

// ============================================================
// Finance — Command Center (owner cockpit). READ-ONLY / derived.
// Nothing here posts, mutates, or revalidates. It only reads POSTED
// journal lines (plus a DRAFT approvals inbox) and rolls them up into
// the headline numbers an owner glances at: cash on hand, what came in
// and went out this month + this financial year, what's waiting for a
// sign-off, and where the money is going.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { fyForDate, periodForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

// ---- shapes returned to the page (all money already Number, dates ISO) ----

export interface CockpitTotals {
  revenue: number;
  expense: number;
  net: number;
}

export interface ApprovalRow {
  id: string;
  entryNo: string | null;
  date: string; // ISO
  narration: string | null;
  total: number; // sum of line debits (rupees)
  href: string;
}

export interface TopAccountRow {
  code: string;
  name: string;
  amount: number;
  pct: number; // 0–100, share of the largest in the list (for bar width)
}

export interface CommandCenterData {
  authorized: boolean;
  fy: string;
  period: number; // 1–12, Apr=1
  cashPosition: number;
  mtd: CockpitTotals;
  fyTotals: CockpitTotals;
  approvals: ApprovalRow[];
  approvalsCount: number;
  topExpenses: TopAccountRow[];
}

const n = (d: unknown): number => Number(d ?? 0);

function emptyData(): CommandCenterData {
  const now = new Date();
  return {
    authorized: false,
    fy: fyForDate(now),
    period: periodForDate(now),
    cashPosition: 0,
    mtd: { revenue: 0, expense: 0, net: 0 },
    fyTotals: { revenue: 0, expense: 0, net: 0 },
    approvals: [],
    approvalsCount: 0,
    topExpenses: [],
  };
}

export async function getCommandCenter(): Promise<CommandCenterData> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) return emptyData();

  const now = new Date();
  const fy = fyForDate(now);
  const period = periodForDate(now);

  // Account dictionary (id ⇄ code/type) — one read, reused everywhere below.
  const accounts = await prisma.finAccount.findMany({
    select: { id: true, code: true, name: true, type: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const bankId = accounts.find((a) => a.code === FIN_ACCOUNT_CODES.bank)?.id ?? null;

  // ---- Cash position: net of debits−credits on the bank account (1020), posted ----
  let cashPosition = 0;
  if (bankId) {
    const bankAgg = await prisma.finJournalLine.aggregate({
      _sum: { debit: true, credit: true },
      where: { accountId: bankId, entry: { status: "POSTED" } },
    });
    cashPosition = n(bankAgg._sum.debit) - n(bankAgg._sum.credit);
  }

  // ---- All posted lines for the current FY, joined to their entry date/period ----
  // One pass computes both the FY rollup and the MTD (current period) slice.
  const fyLines = await prisma.finJournalLine.findMany({
    where: { entry: { status: "POSTED", fy } },
    select: {
      accountId: true,
      debit: true,
      credit: true,
      entry: { select: { date: true } },
    },
  });

  const mtd: CockpitTotals = { revenue: 0, expense: 0, net: 0 };
  const fyTotals: CockpitTotals = { revenue: 0, expense: 0, net: 0 };
  const fyExpenseByAcct = new Map<string, number>();

  for (const l of fyLines) {
    const acct = byId.get(l.accountId);
    if (!acct) continue;
    const debit = n(l.debit);
    const credit = n(l.credit);
    const inPeriod = periodForDate(l.entry.date) === period;

    if (acct.type === "INCOME") {
      const v = credit - debit; // income is naturally a credit balance
      fyTotals.revenue += v;
      if (inPeriod) mtd.revenue += v;
    } else if (acct.type === "EXPENSE") {
      const v = debit - credit; // expense is naturally a debit balance
      fyTotals.expense += v;
      if (inPeriod) mtd.expense += v;
      fyExpenseByAcct.set(l.accountId, (fyExpenseByAcct.get(l.accountId) ?? 0) + v);
    }
  }
  mtd.net = mtd.revenue - mtd.expense;
  fyTotals.net = fyTotals.revenue - fyTotals.expense;

  // ---- Top 5 expense accounts this FY ----
  const ranked = [...fyExpenseByAcct.entries()]
    .map(([id, amount]) => {
      const a = byId.get(id);
      return { code: a?.code ?? "—", name: a?.name ?? "Unknown", amount };
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const topMax = ranked[0]?.amount ?? 0;
  const topExpenses: TopAccountRow[] = ranked.map((r) => ({
    ...r,
    pct: topMax > 0 ? Math.round((r.amount / topMax) * 100) : 0,
  }));

  // ---- Approvals inbox: DRAFT (unposted) entries ----
  const drafts = await prisma.finJournalEntry.findMany({
    where: { status: "DRAFT" },
    orderBy: { date: "desc" },
    select: {
      id: true,
      entryNo: true,
      date: true,
      narration: true,
      lines: { select: { debit: true } },
    },
    take: 50,
  });
  const approvals: ApprovalRow[] = drafts.map((e) => ({
    id: e.id,
    entryNo: e.entryNo || null,
    date: e.date.toISOString(),
    narration: e.narration,
    total: e.lines.reduce((s, ln) => s + n(ln.debit), 0),
    href: "/finance",
  }));
  // The list above is capped at 50 for display; the badge must reflect the TRUE
  // backlog, so count separately rather than reporting the truncated array length.
  const approvalsCount = await prisma.finJournalEntry.count({ where: { status: "DRAFT" } });

  return {
    authorized: true,
    fy,
    period,
    cashPosition,
    mtd,
    fyTotals,
    approvals,
    approvalsCount,
    topExpenses,
  };
}
