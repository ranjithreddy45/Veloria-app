"use server";

// ============================================================
// Finance · Cash Flow — a 13-week rolling forecast + runway.
//
// READ-ONLY / derived. Nothing here writes to the ledger. The numbers are a
// best-effort projection assembled from existing data:
//   • Cash now    = bank GL balance (posted debits − credits on account 1020,
//                   plus any FinBankAccount openingBalance mapped to it).
//   • Inflows     = open receivables (Invoice.balanceDue), bucketed by dueDate
//                   into the next 13 weekly buckets. Stress mode slips each
//                   collection 2 weeks later.
//   • Outflows    = a flat weekly run-rate = avg weekly EXPENSE over the last
//                   8 weeks (honestly an estimate, not a scheduled bill list).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

const WEEKS = 13;
const RUN_RATE_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface CashWeekRow {
  /** ISO date (yyyy-mm-dd) of the Monday that starts this bucket. */
  weekStart: string;
  inflow: number;
  outflow: number;
  net: number;
  runningBalance: number;
}

export interface CashForecast {
  hasData: boolean;
  stress: boolean;
  cashNow: number;
  weeklyBurn: number;
  projectedEnd: number;
  /** Index 0-based of the first week the running balance goes negative, or -1. */
  runwayWeekIndex: number;
  /** Human label: "healthy" | "13+ weeks" | "Week N (<date>)". */
  runwayLabel: string;
  openReceivables: number;
  rows: CashWeekRow[];
}

async function requireFinanceUser() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) return null;
  return role;
}

/** Monday 00:00 (local) of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getCashForecast(stress = false): Promise<CashForecast> {
  const role = await requireFinanceUser();

  const empty: CashForecast = {
    hasData: false, stress, cashNow: 0, weeklyBurn: 0, projectedEnd: 0,
    runwayWeekIndex: -1, runwayLabel: "healthy", openReceivables: 0, rows: [],
  };
  if (!role) return empty;

  // --- Resolve the bank GL account (1020) -------------------------------
  const bankAcct = await prisma.finAccount.findUnique({
    where: { code: FIN_ACCOUNT_CODES.bank },
    select: { id: true },
  });

  // --- Cash now = bank GL balance --------------------------------------
  let cashNow = 0;
  let hasLedger = false;
  if (bankAcct) {
    const agg = await prisma.finJournalLine.aggregate({
      where: { accountId: bankAcct.id, entry: { status: "POSTED" } },
      _sum: { debit: true, credit: true },
    });
    const debit = Number(agg._sum.debit ?? 0);
    const credit = Number(agg._sum.credit ?? 0);
    cashNow += debit - credit;
    hasLedger = (agg._sum.debit !== null || agg._sum.credit !== null);

    // Add any opening balance on bank accounts mapped to this GL account.
    const banks = await prisma.finBankAccount.findMany({
      where: { glAccountId: bankAcct.id },
      select: { openingBalance: true },
    });
    for (const b of banks) cashNow += Number(b.openingBalance);
    if (banks.length > 0) hasLedger = true;
  }

  // --- Week buckets -----------------------------------------------------
  const now = new Date();
  const week0 = startOfWeek(now);
  const weekStarts: Date[] = Array.from(
    { length: WEEKS },
    (_, i) => new Date(week0.getTime() + i * WEEK_MS),
  );
  const inflows = new Array<number>(WEEKS).fill(0);

  // --- Inflows = open receivables, bucketed by dueDate ------------------
  const openInvoices = await prisma.invoice.findMany({
    where: {
      balanceDue: { gt: 0 },
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { balanceDue: true, dueDate: true },
  });

  let openReceivables = 0;
  const slip = stress ? 2 : 0; // collections slip N weeks in stress mode
  for (const inv of openInvoices) {
    const amt = Number(inv.balanceDue);
    if (amt <= 0) continue;
    openReceivables += amt;

    // Which bucket does the due date fall in? Overdue / this week → week 1 (idx 0).
    const dueWeek = startOfWeek(new Date(inv.dueDate));
    let idx = Math.round((dueWeek.getTime() - week0.getTime()) / WEEK_MS);
    if (idx < 0) idx = 0;
    idx += slip;
    if (idx >= WEEKS) continue; // collected beyond the 13-week horizon
    inflows[idx] += amt;
  }
  if (openInvoices.length > 0) hasLedger = true;

  // --- Outflows = flat weekly run-rate from last 8 weeks of EXPENSE -----
  const since = new Date(now.getTime() - RUN_RATE_WEEKS * WEEK_MS);
  const expenseDebits = await prisma.finJournalLine.aggregate({
    where: {
      account: { type: "EXPENSE" },
      entry: { status: "POSTED", date: { gte: since } },
    },
    _sum: { debit: true, credit: true },
  });
  const totalExpense = Number(expenseDebits._sum.debit ?? 0) - Number(expenseDebits._sum.credit ?? 0);
  const weeklyBurn = Math.max(0, totalExpense / RUN_RATE_WEEKS);
  if (expenseDebits._sum.debit !== null) hasLedger = true;

  // --- Build the 13 rows ------------------------------------------------
  const rows: CashWeekRow[] = [];
  let running = cashNow;
  let runwayWeekIndex = -1;
  for (let i = 0; i < WEEKS; i++) {
    const inflow = Math.round(inflows[i] * 100) / 100;
    const outflow = Math.round(weeklyBurn * 100) / 100;
    const net = inflow - outflow;
    running = Math.round((running + net) * 100) / 100;
    if (runwayWeekIndex === -1 && running < 0) runwayWeekIndex = i;
    rows.push({ weekStart: toISODate(weekStarts[i]), inflow, outflow, net, runningBalance: running });
  }

  // --- Runway label -----------------------------------------------------
  let runwayLabel: string;
  if (runwayWeekIndex === -1) {
    runwayLabel = weeklyBurn === 0 ? "healthy" : "13+ weeks";
  } else {
    runwayLabel = `Week ${runwayWeekIndex + 1} · ${rows[runwayWeekIndex].weekStart}`;
  }

  return {
    hasData: hasLedger,
    stress,
    cashNow: Math.round(cashNow * 100) / 100,
    weeklyBurn: Math.round(weeklyBurn * 100) / 100,
    projectedEnd: rows.length ? rows[rows.length - 1].runningBalance : cashNow,
    runwayWeekIndex,
    runwayLabel,
    openReceivables: Math.round(openReceivables * 100) / 100,
    rows,
  };
}
