// ============================================================
// Finance — Payables sub-ledger bridge. Connects the Vendor / Owner-payout
// department (event-side Payout) to the General Ledger, and provides the
// duplicate-payment control (Rule 4 — money safety is a system).
//
// Same discipline as the receivables bridge: idempotent (one JE per payout)
// and resilient (no-op if Finance isn't set up / period closed; never throws
// into the host flow).
//
// Posting model: until a vendor-bill / owner-statement sub-ledger accrues the
// liability (later waves), a paid payout settles a balance-sheet payable —
// Dr payable / Cr Bank — so cash movement never mis-hits the P&L. The expense
// side is recognised by the accrual when that wave lands.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { postWithinTx, type JournalLineInput } from "./ledger";
import { FIN_ACCOUNT_CODES } from "./coa-seed";

export type BridgeResult =
  | { posted: true; entryId: string; entryNo: string }
  | { posted: false; reason: string };

type Tx = Prisma.TransactionClient;

// Which account each payout debits on disbursement.
function payableCodeFor(type: string, isAdvance = false): string {
  // A vendor ADVANCE is a prepayment: it debits the Advances-to-Vendors ASSET
  // (1300), not a payable — the asset later nets against the accrued VendorBill.
  if (isAdvance) return FIN_ACCOUNT_CODES.advancesToVendors; // 1300
  switch (type) {
    case "OWNER_PAYOUT":
      return FIN_ACCOUNT_CODES.ownerPayouts; // 2400
    case "VENDOR_PAYMENT":
    case "COMMISSION":
    default:
      return FIN_ACCOUNT_CODES.creditors; // 2010
  }
}

async function accountId(tx: Tx, code: string): Promise<string | null> {
  const a = await tx.finAccount.findUnique({ where: { code }, select: { id: true } });
  return a?.id ?? null;
}

async function alreadyPosted(tx: Tx, sourceRefId: string): Promise<boolean> {
  const e = await tx.finJournalEntry.findFirst({
    where: { sourceModule: "PAYABLE", sourceRefId },
    select: { id: true },
  });
  return !!e;
}

/**
 * Post cash disbursement for a paid payout:
 *   Dr <payable account for the payout type> (amount)
 *     Cr Bank (amount)
 * Keyed on the payout id; safe to call repeatedly.
 */
export async function postPayoutPaid(payoutId: string, byId?: string): Promise<BridgeResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const accountCount = await tx.finAccount.count();
      if (accountCount === 0) return { posted: false, reason: "not-seeded" } as BridgeResult;
      if (await alreadyPosted(tx, payoutId)) return { posted: false, reason: "already-posted" };

      const payout = await tx.payout.findUnique({ where: { id: payoutId }, include: { vendor: { select: { name: true } } } });
      if (!payout) return { posted: false, reason: "payout-not-found" };
      const amount = Number(payout.amount);
      if (amount <= 0) return { posted: false, reason: "non-positive-amount" };

      const [payableId, bankId] = await Promise.all([
        accountId(tx, payableCodeFor(payout.type, payout.isAdvance)),
        accountId(tx, FIN_ACCOUNT_CODES.bank),
      ]);
      if (!payableId || !bankId) return { posted: false, reason: "accounts-missing" };

      const ref = payout.referenceNumber ?? payout.id;
      const payee = payout.vendor?.name ?? payout.type.replace(/_/g, " ").toLowerCase();
      const debitLabel = payout.isAdvance ? `Advance to ${payee} — ${ref}` : `${payee} — ${ref}`;
      const lines: JournalLineInput[] = [
        { accountId: payableId, debit: amount, narration: debitLabel },
        { accountId: bankId, credit: amount, narration: `Payout ${ref}` },
      ];

      const res = await postWithinTx(tx, {
        date: payout.paidAt ?? new Date(),
        narration: `Payout — ${payee} (${ref})`,
        sourceModule: "PAYABLE", sourceRefId: payout.id, createdById: byId ?? null, lines,
      });
      return { posted: true, entryId: res.id, entryNo: res.entryNo };
    });
  } catch (e) {
    return { posted: false, reason: e instanceof Error ? e.message : "post-failed" };
  }
}

// ------------------------------------------------------------
// Duplicate-payment control (Rule 4). Flags a near-identical recent payout —
// same vendor + same amount + same type within a short window — so the maker
// is warned before creating a likely double payment. Returns the matching
// payout(s); an empty array means no suspected duplicate.
// ------------------------------------------------------------
export async function findDuplicatePayouts(args: {
  vendorId?: string | null;
  amount: number;
  type: string;
  withinDays?: number;
  excludePayoutId?: string;
}): Promise<{ id: string; referenceNumber: string | null; createdAt: Date; status: string }[]> {
  if (!args.vendorId) return []; // can only correlate vendor payments
  const days = args.withinDays ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const matches = await prisma.payout.findMany({
    where: {
      vendorId: args.vendorId,
      type: args.type as Prisma.PayoutWhereInput["type"],
      amount: new Prisma.Decimal(args.amount.toFixed(2)),
      status: { not: "CANCELLED" },
      createdAt: { gte: since },
      ...(args.excludePayoutId ? { id: { not: args.excludePayoutId } } : {}),
    },
    select: { id: true, referenceNumber: true, createdAt: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return matches;
}
