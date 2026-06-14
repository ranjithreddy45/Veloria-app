// ============================================================
// Finance — the journal engine. The ONE place posted entries are
// created. Enforces the balance invariant (Σdebits = Σcredits) in
// integer paise (never float), allocates a gapless entry number per
// FY, and blocks posting into a closed/locked period. Sub-ledgers
// (AR/AP/bank/payroll/revenue/tax) all post through here.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface JournalLineInput {
  accountId: string;
  debit?: number; // rupees
  credit?: number; // rupees
  venueId?: string | null;
  eventId?: string | null;
  costCenter?: string | null;
  taxCode?: string | null;
  narration?: string | null;
}

export interface PostInput {
  date: Date;
  narration?: string | null;
  sourceModule?: "MANUAL" | "RECEIVABLE" | "PAYABLE" | "BANK" | "PAYROLL" | "REVENUE" | "TAX";
  sourceRefId?: string | null;
  createdById?: string | null;
  lines: JournalLineInput[];
}

const paise = (n: number | undefined) => Math.round((n ?? 0) * 100);
// Build a Decimal from the SAME paise integer that validateBalanced sums, so a
// validated entry can never disagree with what's persisted (and the DB balance
// trigger). Never construct money Decimals straight from toFixed (different rounding).
const decimalFromPaise = (n: number | undefined) => new Prisma.Decimal(paise(n)).div(100);

// Pure validation — used by the engine and unit-tested independently.
export function validateBalanced(lines: JournalLineInput[]): { ok: boolean; error?: string } {
  if (!lines || lines.length < 2) return { ok: false, error: "A journal entry needs at least two lines." };
  let dr = 0, cr = 0;
  for (const l of lines) {
    const d = paise(l.debit), c = paise(l.credit);
    if (d < 0 || c < 0) return { ok: false, error: "Amounts cannot be negative." };
    if (d > 0 && c > 0) return { ok: false, error: "A line is either a debit or a credit, not both." };
    if (d === 0 && c === 0) return { ok: false, error: "Every line must have a debit or a credit." };
    if (!l.accountId) return { ok: false, error: "Every line needs an account." };
    dr += d; cr += c;
  }
  if (dr !== cr) return { ok: false, error: `Entry is unbalanced: debits ₹${(dr / 100).toFixed(2)} ≠ credits ₹${(cr / 100).toFixed(2)}.` };
  return { ok: true };
}

// Indian financial year (Apr–Mar). 2026-04-01 → "2026-27"; 2026-02-01 → "2025-26".
export function fyForDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0=Jan
  const startYear = m >= 3 ? y : y - 1; // Apr (3) starts the FY
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Period number 1..12 with Apr=1 (Indian FY).
export function periodForDate(d: Date): number {
  const m = d.getUTCMonth(); // 0=Jan
  return ((m - 3 + 12) % 12) + 1;
}

async function allocateEntryNo(tx: Tx, entityId: string, fy: string): Promise<string> {
  // Gapless per (entity, series=JE, fy) — atomic upsert+increment inside the txn.
  const existing = await tx.finSequence.findUnique({ where: { entityId_series_fy: { entityId, series: "JE", fy } } });
  let n: number;
  if (!existing) {
    await tx.finSequence.create({ data: { entityId, series: "JE", fy, nextNum: 2 } });
    n = 1;
  } else {
    await tx.finSequence.update({ where: { id: existing.id }, data: { nextNum: { increment: 1 } } });
    n = existing.nextNum;
  }
  return `JE/${fy}/${String(n).padStart(5, "0")}`;
}

// Core poster — runs inside a caller-provided transaction so sub-ledgers can post
// their own records + the journal atomically.
export async function postWithinTx(tx: Tx, input: PostInput): Promise<{ id: string; entryNo: string }> {
  const check = validateBalanced(input.lines);
  if (!check.ok) throw new Error(check.error);

  const entityId = "BILLION";
  const fy = fyForDate(input.date);
  const periodNo = periodForDate(input.date);

  // Period must exist and be OPEN to post into.
  let period = await tx.finPeriod.findUnique({ where: { fy_period: { fy, period: periodNo } } });
  if (!period) period = await tx.finPeriod.create({ data: { fy, period: periodNo, status: "OPEN" } });
  if (period.status !== "OPEN") throw new Error(`Period ${fy} P${periodNo} is ${period.status.toLowerCase()} — posting blocked.`);

  const entryNo = await allocateEntryNo(tx, entityId, fy);
  const entry = await tx.finJournalEntry.create({
    data: {
      entityId, entryNo, fy, date: input.date, narration: input.narration ?? null,
      sourceModule: (input.sourceModule ?? "MANUAL") as Prisma.FinJournalEntryCreateInput["sourceModule"],
      sourceRefId: input.sourceRefId ?? null, status: "POSTED",
      periodId: period.id, postedById: input.createdById ?? null, postedAt: new Date(), createdById: input.createdById ?? null,
      lines: {
        create: input.lines.map((l, i) => ({
          accountId: l.accountId,
          debit: decimalFromPaise(l.debit),
          credit: decimalFromPaise(l.credit),
          venueId: l.venueId ?? null, eventId: l.eventId ?? null,
          costCenter: l.costCenter ?? null, taxCode: l.taxCode ?? null,
          narration: l.narration ?? null, lineOrder: i,
        })),
      },
    },
  });
  return { id: entry.id, entryNo };
}

// Convenience wrapper that opens its own transaction (for standalone posts).
export async function postJournalEntry(input: PostInput): Promise<{ id: string; entryNo: string }> {
  return prisma.$transaction((tx) => postWithinTx(tx, input));
}

// Reverse a posted entry: a new balanced entry with debits/credits swapped,
// dated today (current open period), cross-linked. The original is never edited
// except to record reversedById.
export async function reverseJournalEntry(entryId: string, reason: string, byId?: string): Promise<{ id: string; entryNo: string }> {
  return prisma.$transaction(async (tx) => {
    const orig = await tx.finJournalEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
    if (!orig) throw new Error("Entry not found.");
    if (orig.status !== "POSTED") throw new Error("Only a posted entry can be reversed.");
    if (orig.reversedById) throw new Error("Entry is already reversed.");

    const lines: JournalLineInput[] = orig.lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.credit), // swap
      credit: Number(l.debit),
      venueId: l.venueId, eventId: l.eventId, costCenter: l.costCenter, taxCode: l.taxCode,
      narration: `Reversal: ${l.narration ?? ""}`.trim(),
    }));
    const rev = await postWithinTx(tx, {
      date: new Date(), narration: `Reversal of ${orig.entryNo} — ${reason}`,
      sourceModule: orig.sourceModule as PostInput["sourceModule"], sourceRefId: orig.sourceRefId, createdById: byId, lines,
    });
    await tx.finJournalEntry.update({ where: { id: orig.id }, data: { status: "REVERSED", reversedById: rev.id } });
    await tx.finJournalEntry.update({ where: { id: rev.id }, data: { reversalOfId: orig.id } });
    return rev;
  });
}
