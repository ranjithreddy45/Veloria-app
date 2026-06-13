// ============================================================
// Finance — financial-statement helpers (W5). Pure classification + math used
// by the P&L and Balance Sheet builders. Money in rupees; callers feed summed
// posted-ledger figures. The accounting identity (Assets = Liabilities + Equity
// + Retained earnings) must hold when the ledger is balanced.
// ============================================================

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

// Which side increases each account type.
export function normalBalance(type: AccountType): "debit" | "credit" {
  return type === "ASSET" || type === "EXPENSE" ? "debit" : "credit";
}

// The account's natural positive balance from summed debits/credits.
export function accountNet(type: AccountType, debit: number, credit: number): number {
  return normalBalance(type) === "debit" ? debit - credit : credit - debit;
}

export interface StatementLine { code: string; name: string; amount: number }

export interface ProfitAndLoss {
  income: StatementLine[];
  expense: StatementLine[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number; // includes retained earnings
  retainedEarnings: number;
  balanced: boolean;
}

interface AccountSum { code: string; name: string; type: AccountType; debit: number; credit: number }

const r2 = (n: number) => Math.round(n * 100) / 100;
const eq = (a: number, b: number) => Math.round((a - b) * 100) === 0;

// Build a P&L from per-account summed posted lines.
export function buildProfitAndLoss(rows: AccountSum[]): ProfitAndLoss {
  const income: StatementLine[] = [];
  const expense: StatementLine[] = [];
  for (const a of rows) {
    const net = accountNet(a.type, a.debit, a.credit);
    if (a.type === "INCOME" && net !== 0) income.push({ code: a.code, name: a.name, amount: r2(net) });
    else if (a.type === "EXPENSE" && net !== 0) expense.push({ code: a.code, name: a.name, amount: r2(net) });
  }
  income.sort((x, y) => x.code.localeCompare(y.code));
  expense.sort((x, y) => x.code.localeCompare(y.code));
  const totalIncome = r2(income.reduce((s, l) => s + l.amount, 0));
  const totalExpense = r2(expense.reduce((s, l) => s + l.amount, 0));
  return { income, expense, totalIncome, totalExpense, netProfit: r2(totalIncome - totalExpense) };
}

// Build a Balance Sheet. `retainedEarnings` is the cumulative net profit (from
// income/expense) carried into equity, so the identity balances.
export function buildBalanceSheet(rows: AccountSum[], retainedEarnings: number): BalanceSheet {
  const assets: StatementLine[] = [];
  const liabilities: StatementLine[] = [];
  const equity: StatementLine[] = [];
  for (const a of rows) {
    const net = accountNet(a.type, a.debit, a.credit);
    if (net === 0) continue;
    const line = { code: a.code, name: a.name, amount: r2(net) };
    if (a.type === "ASSET") assets.push(line);
    else if (a.type === "LIABILITY") liabilities.push(line);
    else if (a.type === "EQUITY") equity.push(line);
  }
  for (const arr of [assets, liabilities, equity]) arr.sort((x, y) => x.code.localeCompare(y.code));
  // Retained earnings folds into equity.
  const re = r2(retainedEarnings);
  if (re !== 0) equity.push({ code: "3100", name: "Retained Earnings (current)", amount: re });
  const totalAssets = r2(assets.reduce((s, l) => s + l.amount, 0));
  const totalLiabilities = r2(liabilities.reduce((s, l) => s + l.amount, 0));
  const totalEquity = r2(equity.reduce((s, l) => s + l.amount, 0));
  return {
    assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, retainedEarnings: re,
    balanced: eq(totalAssets, totalLiabilities + totalEquity),
  };
}
