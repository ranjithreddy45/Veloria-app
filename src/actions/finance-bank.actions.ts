"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { postWithinTx } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";
import {
  parseBankCsv, dedupeKey, suggestMatches, applyRules, ruleTokenFor,
  type BankRow, type MatchCandidate, type ReconRule,
} from "@/lib/finance/reconcile";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canFinance = (r?: string) => !!r && FINANCE_ROLES.includes(r);
const canAdmin = (r?: string) => r === "SUPER_ADMIN" || r === "ADMIN";

// ------------------------------------------------------------
// Bank accounts
// ------------------------------------------------------------
export async function getBankAccounts() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  return prisma.finBankAccount.findMany({
    where: { isActive: true },
    include: { glAccount: { select: { code: true, name: true } }, _count: { select: { txns: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createBankAccount(input: { name: string; bankName?: string; accountNo?: string; glAccountCode?: string; openingBalance?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canAdmin(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Name is required." };
  const gl = await prisma.finAccount.findUnique({ where: { code: input.glAccountCode || FIN_ACCOUNT_CODES.bank } });
  if (!gl) return { success: false, error: "Bank GL account not found — seed the chart of accounts first." };
  const created = await prisma.finBankAccount.create({
    data: {
      name: input.name.trim(), bankName: input.bankName?.trim() || null, accountNo: input.accountNo?.trim() || null,
      glAccountId: gl.id, openingBalance: new Prisma.Decimal((input.openingBalance ?? 0).toFixed(2)),
    },
  });
  revalidatePath("/finance/bank");
  return { success: true, data: { id: created.id } };
}

// ------------------------------------------------------------
// Import — parse CSV, skip duplicates (unique on dedupeHash).
// ------------------------------------------------------------
export async function importBankCsv(bankAccountId: string, csvText: string): Promise<Result<{ imported: number; skipped: number; duplicates: number }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  const acct = await prisma.finBankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct) return { success: false, error: "Bank account not found." };

  const { rows, skipped } = parseBankCsv(csvText || "");
  if (rows.length === 0) return { success: false, error: "No valid rows found — check the CSV has Date and Debit/Credit (or Amount) columns." };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const batch = `${acct.id.slice(0, 6)}-${rows.length}-${rows[0].date.toISOString().slice(0, 10)}`;
  let imported = 0, duplicates = 0;
  for (const row of rows) {
    const hash = dedupeKey(row);
    try {
      await prisma.finBankTxn.create({
        data: {
          bankAccountId: acct.id, date: row.date, description: row.description, reference: row.reference,
          debit: new Prisma.Decimal(row.debit.toFixed(2)), credit: new Prisma.Decimal(row.credit.toFixed(2)),
          dedupeHash: hash, importBatch: batch,
        },
      });
      imported++;
    } catch {
      duplicates++; // unique (bankAccountId, dedupeHash) violation = already imported
    }
  }
  revalidatePath("/finance/bank");
  return { success: true, data: { imported, skipped, duplicates } };
}

export async function getBankTxns(bankAccountId: string) {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  const txns = await prisma.finBankTxn.findMany({
    where: { bankAccountId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300,
  });
  return txns.map((t) => ({
    id: t.id, date: t.date, description: t.description, reference: t.reference,
    debit: Number(t.debit), credit: Number(t.credit), status: t.status, matchedEntryId: t.matchedEntryId,
  }));
}

// ------------------------------------------------------------
// Auto-match — link UNMATCHED txns to posted bank-account JEs by amount+date.
// ------------------------------------------------------------
export async function autoMatchBank(bankAccountId: string): Promise<Result<{ matched: number }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  const acct = await prisma.finBankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct) return { success: false, error: "Bank account not found." };

  const unmatched = await prisma.finBankTxn.findMany({ where: { bankAccountId, status: "UNMATCHED" }, orderBy: { date: "asc" } });
  if (unmatched.length === 0) return { success: true, data: { matched: 0 } };

  // Candidate GL entries: posted, with a line on this bank's GL account, not
  // already linked to another txn.
  const linked = await prisma.finBankTxn.findMany({ where: { bankAccountId, matchedEntryId: { not: null } }, select: { matchedEntryId: true } });
  const usedEntryIds = new Set(linked.map((l) => l.matchedEntryId!));
  const lines = await prisma.finJournalLine.findMany({
    where: { accountId: acct.glAccountId, entry: { status: "POSTED" } },
    include: { entry: { select: { id: true, date: true } } },
  });
  const candByEntry = new Map<string, MatchCandidate>();
  for (const l of lines) {
    if (usedEntryIds.has(l.entry.id)) continue;
    const c = candByEntry.get(l.entry.id) ?? { entryId: l.entry.id, date: l.entry.date, bankDebit: 0, bankCredit: 0 };
    c.bankDebit += Number(l.debit); c.bankCredit += Number(l.credit);
    candByEntry.set(l.entry.id, c);
  }
  const candidates = [...candByEntry.values()];

  const rows: BankRow[] = unmatched.map((t) => ({ date: t.date, description: t.description, reference: t.reference, debit: Number(t.debit), credit: Number(t.credit) }));
  const matches = suggestMatches(rows, candidates);

  let matched = 0;
  for (const [i, m] of matches) {
    await prisma.finBankTxn.update({ where: { id: unmatched[i].id }, data: { status: "MATCHED", matchedEntryId: m.entryId } });
    matched++;
  }
  revalidatePath("/finance/bank");
  return { success: true, data: { matched } };
}

export async function setBankTxnStatus(txnId: string, status: "RECONCILED" | "UNMATCHED" | "IGNORED"): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  const data: Prisma.FinBankTxnUpdateInput = { status };
  if (status === "UNMATCHED") data.matchedEntryId = null;
  await prisma.finBankTxn.update({ where: { id: txnId }, data });
  revalidatePath("/finance/bank");
  return { success: true, data: { ok: true } };
}

// ------------------------------------------------------------
// Categorize — for an UNMATCHED txn with no GL entry: post a balanced JE
// (Bank vs the chosen account) and learn a rule from the description.
// ------------------------------------------------------------
export async function categorizeBankTxn(txnId: string, accountCode: string): Promise<Result<{ entryNo: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  const txn = await prisma.finBankTxn.findUnique({ where: { id: txnId }, include: { bankAccount: true } });
  if (!txn) return { success: false, error: "Transaction not found." };
  if (txn.status === "RECONCILED" || txn.matchedEntryId) return { success: false, error: "Already reconciled." };

  const other = await prisma.finAccount.findUnique({ where: { code: accountCode } });
  const bankGlId = txn.bankAccount.glAccountId;
  if (!other) return { success: false, error: "Account not found." };

  const amount = Number(txn.credit) > 0 ? Number(txn.credit) : Number(txn.debit);
  const moneyIn = Number(txn.credit) > 0;
  // money in → Dr Bank / Cr other ; money out → Dr other / Cr Bank
  const lines = moneyIn
    ? [{ accountId: bankGlId, debit: amount }, { accountId: other.id, credit: amount }]
    : [{ accountId: other.id, debit: amount }, { accountId: bankGlId, credit: amount }];

  try {
    // Post the JE and mark the txn RECONCILED atomically. If these ran as two
    // separate writes and the txn update failed, the txn stayed UNMATCHED with a
    // BANK JE already posted — and a re-run would post a DUPLICATE JE (the BANK
    // source has no idempotency guard). Re-check inside the txn that nothing
    // reconciled it in the meantime.
    const res = await prisma.$transaction(async (tx) => {
      const fresh = await tx.finBankTxn.findUnique({ where: { id: txn.id }, select: { status: true, matchedEntryId: true } });
      if (!fresh || fresh.status === "RECONCILED" || fresh.matchedEntryId) throw new Error("Already reconciled.");
      const entry = await postWithinTx(tx, {
        date: txn.date, narration: `Bank: ${txn.description}`.slice(0, 180),
        sourceModule: "BANK", sourceRefId: txn.id, createdById: u!.id, lines,
      });
      await tx.finBankTxn.update({ where: { id: txn.id }, data: { status: "RECONCILED", matchedEntryId: entry.id } });
      return entry;
    });

    // Learn a rule from the description token → this account + direction.
    const token = ruleTokenFor(txn.description);
    const direction = moneyIn ? "CREDIT" : "DEBIT";
    if (token.length >= 3) {
      const existing = await prisma.finReconRule.findFirst({ where: { match: token, accountId: other.id, direction } });
      if (existing) await prisma.finReconRule.update({ where: { id: existing.id }, data: { hits: { increment: 1 } } });
      else await prisma.finReconRule.create({ data: { match: token, accountId: other.id, direction, createdById: u!.id } });
    }
    revalidatePath("/finance/bank");
    return { success: true, data: { entryNo: res.entryNo } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not categorize." };
  }
}

// Suggested account (from learned rules) for each unmatched txn — drives the UI hint.
export async function getCategorySuggestions(bankAccountId: string): Promise<Record<string, { code: string; name: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return {};
  const [txns, rules, accounts] = await Promise.all([
    prisma.finBankTxn.findMany({ where: { bankAccountId, status: "UNMATCHED" } }),
    prisma.finReconRule.findMany({}),
    prisma.finAccount.findMany({ select: { id: true, code: true, name: true } }),
  ]);
  const ruleList: ReconRule[] = rules.map((r) => ({ id: r.id, match: r.match, accountId: r.accountId, direction: r.direction, hits: r.hits }));
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const out: Record<string, { code: string; name: string }> = {};
  for (const t of txns) {
    const direction = Number(t.credit) > 0 ? "CREDIT" : "DEBIT";
    const rule = applyRules(t.description, direction, ruleList);
    if (rule) { const a = acctById.get(rule.accountId); if (a) out[t.id] = { code: a.code, name: a.name }; }
  }
  return out;
}

export async function getReconSummary(bankAccountId: string): Promise<{ unmatched: number; matched: number; reconciled: number; ignored: number; statementBalance: number; glBalance: number }> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { unmatched: 0, matched: 0, reconciled: 0, ignored: 0, statementBalance: 0, glBalance: 0 };
  const acct = await prisma.finBankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct) return { unmatched: 0, matched: 0, reconciled: 0, ignored: 0, statementBalance: 0, glBalance: 0 };

  const grouped = await prisma.finBankTxn.groupBy({ by: ["status"], where: { bankAccountId }, _count: true });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count;

  const sums = await prisma.finBankTxn.aggregate({ where: { bankAccountId }, _sum: { debit: true, credit: true } });
  const statementBalance = Number(acct.openingBalance) + Number(sums._sum.credit ?? 0) - Number(sums._sum.debit ?? 0);

  const glAgg = await prisma.finJournalLine.aggregate({ where: { accountId: acct.glAccountId, entry: { status: "POSTED" } }, _sum: { debit: true, credit: true } });
  const glBalance = Number(acct.openingBalance) + Number(glAgg._sum.debit ?? 0) - Number(glAgg._sum.credit ?? 0);

  return {
    unmatched: counts.UNMATCHED ?? 0, matched: counts.MATCHED ?? 0, reconciled: counts.RECONCILED ?? 0, ignored: counts.IGNORED ?? 0,
    statementBalance, glBalance,
  };
}
