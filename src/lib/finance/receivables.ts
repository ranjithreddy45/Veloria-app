// ============================================================
// Finance — Receivables sub-ledger bridge. Connects the Sales department
// (event-side Invoice / Payment) to the General Ledger by posting balanced
// journal entries when revenue is recognised and cash is received.
//
// Design rules:
//  - Idempotent: one JE per source document (keyed on sourceRefId). Re-running
//    is a no-op.
//  - Resilient: if Finance isn't set up yet (no CoA) or the period is closed,
//    the bridge returns {posted:false, reason} and NEVER throws — so it can be
//    called best-effort from invoice/payment flows without risking those flows.
//  - All posting goes through the one journal engine (Rule 1).
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { postWithinTx, reverseJournalEntry, type JournalLineInput } from "./ledger";
import { FIN_ACCOUNT_CODES } from "./coa-seed";

export type BridgeResult =
  | { posted: true; entryId: string; entryNo: string }
  | { posted: false; reason: string };

type Tx = Prisma.TransactionClient;

async function accountId(tx: Tx, code: string): Promise<string | null> {
  const a = await tx.finAccount.findUnique({ where: { code }, select: { id: true } });
  return a?.id ?? null;
}

// Has a (non-superseded) entry already been posted for this source document?
async function alreadyPosted(tx: Tx, sourceModule: string, sourceRefId: string): Promise<boolean> {
  const e = await tx.finJournalEntry.findFirst({
    where: { sourceModule: sourceModule as Prisma.FinJournalEntryWhereInput["sourceModule"], sourceRefId },
    select: { id: true },
  });
  return !!e;
}

/**
 * Post revenue recognition for an issued invoice:
 *   Dr Accounts Receivable (total)
 *     Cr Revenue (subtotal − discount)
 *     Cr GST Output Payable (cgst + sgst + igst)
 * Keyed on the invoice id; safe to call repeatedly.
 */
export async function postInvoiceIssued(invoiceId: string, byId?: string): Promise<BridgeResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const accountCount = await tx.finAccount.count();
      if (accountCount === 0) return { posted: false, reason: "not-seeded" } as BridgeResult;
      if (await alreadyPosted(tx, "RECEIVABLE", invoiceId)) return { posted: false, reason: "already-posted" };

      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return { posted: false, reason: "invoice-not-found" };

      const total = Number(inv.totalAmount);
      const gst = Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);
      const discount = Number(inv.discountAmount ?? 0);
      const revenue = Number(inv.subtotal) - discount; // net taxable revenue
      // Guard the arithmetic: revenue + gst must equal the invoice total.
      if (Math.round((revenue + gst) * 100) !== Math.round(total * 100)) {
        return { posted: false, reason: "invoice-amounts-inconsistent" };
      }

      const [arId, revId, gstId, advId] = await Promise.all([
        accountId(tx, FIN_ACCOUNT_CODES.debtors),
        accountId(tx, FIN_ACCOUNT_CODES.venueRental),
        accountId(tx, FIN_ACCOUNT_CODES.gstOutput),
        accountId(tx, FIN_ACCOUNT_CODES.customerAdvances),
      ]);
      if (!arId || !revId || !gstId) return { posted: false, reason: "accounts-missing" };

      // Payments recorded BEFORE this invoice's revenue was recognised credited
      // Customer Advances (a liability) rather than clearing AR. Net those out now
      // so AR isn't overstated: reclassify the advance against this invoice.
      //   Dr Customer Advances (advance)   ← clears the liability
      //   Dr Accounts Receivable (total − advance)
      //     Cr Revenue / Cr GST
      // The reclass is bounded by the invoice total and stays balanced.
      let advance = 0;
      if (advId) {
        const payments = await tx.payment.findMany({ where: { invoiceId: inv.id }, select: { id: true } });
        const payIds = payments.map((p) => p.id);
        if (payIds.length > 0) {
          const advLines = await tx.finJournalLine.findMany({
            where: {
              accountId: advId,
              entry: { status: "POSTED", sourceModule: "RECEIVABLE", sourceRefId: { in: payIds } },
            },
            select: { credit: true, debit: true },
          });
          // Net credit (advances booked) minus any prior debit (already reclassified).
          const net = advLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
          advance = Math.min(Math.max(net, 0), total);
          advance = Math.round(advance * 100) / 100;
        }
      }

      // A zero-total invoice (e.g. fully discounted) has nothing to recognise —
      // no-op cleanly rather than building a single zero-value line that the
      // balance validator would reject as "unbalanced".
      if (Math.round(total * 100) === 0) return { posted: false, reason: "zero-total" };

      const arDebit = Math.round((total - advance) * 100) / 100;
      const lines: JournalLineInput[] = [];
      if (advance > 0 && advId) lines.push({ accountId: advId, debit: advance, narration: "Apply advance" });
      if (arDebit > 0) lines.push({ accountId: arId, debit: arDebit, narration: `Invoice ${inv.invoiceNumber}` });
      if (revenue > 0) lines.push({ accountId: revId, credit: revenue, narration: "Event revenue" });
      if (gst > 0) lines.push({ accountId: gstId, credit: gst, narration: "GST output" });

      const res = await postWithinTx(tx, {
        date: inv.issueDate ?? new Date(),
        narration: `Revenue — invoice ${inv.invoiceNumber}`,
        sourceModule: "RECEIVABLE", sourceRefId: inv.id, createdById: byId ?? null, lines,
      });
      return { posted: true, entryId: res.id, entryNo: res.entryNo };
    });
  } catch (e) {
    return { posted: false, reason: e instanceof Error ? e.message : "post-failed" };
  }
}

export type ReversalOutcome =
  | { ok: true; reversed: boolean }
  | { ok: false; error: string };

/**
 * Reverse the RECEIVABLE journal entry posted for a source document (an invoice
 * id when cancelling an invoice, a payment id when cancelling a payment), so the
 * ledger stays balanced after a cancellation.
 *
 * Fail-safe semantics (see Vendor module spec §6a):
 *  - Finance not in use (no Chart of Accounts) → nothing was ever posted, so the
 *    cancellation is safe to proceed: {ok:true, reversed:false}.
 *  - A live POSTED entry exists → reverse it (swapped balanced entry) and return
 *    {ok:true, reversed:true}. reverseJournalEntry's own reversedById guard makes
 *    concurrent callers safe (the loser sees the already-reversed state below).
 *  - Only a REVERSED entry exists → a prior attempt already reversed it → treat
 *    as an idempotent no-op: {ok:true, reversed:false}.
 *  - The ledger IS in use but no entry (posted or reversed) exists for this
 *    document → the forward post never happened; REFUSE ({ok:false}) rather than
 *    silently cancelling and leaving revenue/AR/cash unreversed in the GL.
 */
export async function reverseReceivableEntry(
  sourceRefId: string,
  reason: string,
  byId?: string,
): Promise<ReversalOutcome> {
  try {
    const accountCount = await prisma.finAccount.count();
    if (accountCount === 0) return { ok: true, reversed: false }; // Finance not set up — nothing was posted

    // Match ONLY the original forward entry — never a reversal entry. A reversal
    // shares this sourceModule+sourceRefId (reverseJournalEntry copies them onto
    // it) but has reversalOfId set; without the `reversalOfId: null` filter a
    // retry would find the reversal (also POSTED) and reverse IT, re-posting the
    // original balances.
    const posted = await prisma.finJournalEntry.findFirst({
      where: { sourceModule: "RECEIVABLE", sourceRefId, status: "POSTED", reversalOfId: null },
      select: { id: true },
    });
    if (posted) {
      try {
        await reverseJournalEntry(posted.id, reason, byId);
      } catch (e) {
        // Lost a concurrency race — a parallel approver already reversed this
        // entry. The GL is already consistent, so treat it as an idempotent
        // no-op rather than a spurious failure.
        const msg = e instanceof Error ? e.message : "";
        if (/already reversed|Only a posted entry/i.test(msg)) return { ok: true, reversed: false };
        throw e;
      }
      return { ok: true, reversed: true };
    }

    // No un-reversed forward entry remains: either it was already reversed on a
    // prior attempt, or this document was never posted (e.g. a draft/unsent
    // invoice with no revenue entry, or a payment recorded before Finance was
    // seeded). In every case there is nothing to reverse and the GL is already
    // consistent, so allow the cancellation to proceed.
    return { ok: true, reversed: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GL reversal failed" };
  }
}

/**
 * Reverse the cash-receipt GL entry for a CANCELLED payment.
 *
 * Unlike a blind swap of the original entry's lines, the offsetting DEBIT
 * targets the account that CURRENTLY holds the cash — mirroring
 * postPaymentReceived's own credit-account choice, but evaluated at *cancel*
 * time:
 *   - invoice revenue recognised  → Dr Accounts Receivable / Cr Bank
 *   - revenue not yet recognised  → Dr Customer Advances   / Cr Bank
 *
 * This is what makes the advance-paid-BEFORE-invoice case correct: when the
 * invoice was later issued, postInvoiceIssued RECLASSIFIED that advance out of
 * Customer Advances into AR. A naive swap would re-debit the (already-cleared)
 * Customer Advances, leaving AR understated and the advance liability negative.
 * By choosing the debit account from the current revenue-posted state, the
 * reversal debits AR in that case, restoring the full receivable exactly.
 *
 * Called only by the winner of the payment-cancel status-guarded flip, so there
 * is a single caller and the whole thing runs in one transaction. Marks the
 * original receipt REVERSED so a retry is an idempotent no-op.
 */
export async function reversePaymentEntry(
  paymentId: string,
  reason: string,
  byId?: string,
): Promise<ReversalOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const accountCount = await tx.finAccount.count();
      if (accountCount === 0) return { ok: true, reversed: false }; // Finance not in use

      // Only the ORIGINAL receipt (never a reversal — reversalOfId:null).
      const orig = await tx.finJournalEntry.findFirst({
        where: { sourceModule: "RECEIVABLE", sourceRefId: paymentId, status: "POSTED", reversalOfId: null },
        include: { lines: true },
      });
      if (!orig) return { ok: true, reversed: false }; // never posted, or already reversed → GL consistent

      const pay = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { amount: true, invoiceId: true },
      });
      if (!pay) return { ok: false, error: "Payment not found for GL reversal." };
      const amount = Number(pay.amount);
      if (amount <= 0) return { ok: true, reversed: false };

      // Which account holds this cash NOW? (Same rule postPaymentReceived used to
      // pick the credit account, re-evaluated at cancel time.)
      const revenuePosted = pay.invoiceId
        ? await alreadyPosted(tx, "RECEIVABLE", pay.invoiceId)
        : false;
      const debitCode = revenuePosted ? FIN_ACCOUNT_CODES.debtors : FIN_ACCOUNT_CODES.customerAdvances;

      // Credit back the SAME bank/cash account the original receipt debited.
      const origBankLine = orig.lines.find((l) => Number(l.debit) > 0);
      const bankId = origBankLine?.accountId ?? (await accountId(tx, FIN_ACCOUNT_CODES.bank));
      const debitId = await accountId(tx, debitCode);
      if (!bankId || !debitId) return { ok: false, error: "GL accounts missing for payment reversal." };

      const lines: JournalLineInput[] = [
        { accountId: debitId, debit: amount, narration: `Reversal — ${reason}` },
        { accountId: bankId, credit: amount, narration: `Reversal — ${reason}` },
      ];
      const rev = await postWithinTx(tx, {
        date: new Date(),
        narration: `Reversal of payment receipt — ${reason}`,
        sourceModule: "RECEIVABLE", sourceRefId: paymentId, createdById: byId ?? null, lines,
      });
      await tx.finJournalEntry.update({ where: { id: orig.id }, data: { status: "REVERSED", reversedById: rev.id } });
      await tx.finJournalEntry.update({ where: { id: rev.id }, data: { reversalOfId: orig.id } });
      return { ok: true, reversed: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GL reversal failed" };
  }
}

/**
 * Post cash collection for a completed payment:
 *   Dr Bank (amount)
 *     Cr Accounts Receivable (amount)
 * Keyed on the payment id; safe to call repeatedly.
 */
export async function postPaymentReceived(paymentId: string, byId?: string): Promise<BridgeResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const accountCount = await tx.finAccount.count();
      if (accountCount === 0) return { posted: false, reason: "not-seeded" } as BridgeResult;
      if (await alreadyPosted(tx, "RECEIVABLE", paymentId)) return { posted: false, reason: "already-posted" };

      const pay = await tx.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
      if (!pay) return { posted: false, reason: "payment-not-found" };
      const amount = Number(pay.amount);
      if (amount <= 0) return { posted: false, reason: "non-positive-amount" };

      // If the invoice's revenue has been recognised in the GL, this clears the
      // receivable; otherwise the cash is a customer advance (deposit) until the
      // invoice is issued. Either way the entry balances.
      const revenuePosted = pay.invoiceId
        ? await alreadyPosted(tx, "RECEIVABLE", pay.invoiceId)
        : false;
      const creditCode = revenuePosted ? FIN_ACCOUNT_CODES.debtors : FIN_ACCOUNT_CODES.customerAdvances;

      const [bankId, creditId] = await Promise.all([
        accountId(tx, FIN_ACCOUNT_CODES.bank),
        accountId(tx, creditCode),
      ]);
      if (!bankId || !creditId) return { posted: false, reason: "accounts-missing" };

      const ref = pay.invoice?.invoiceNumber ?? pay.receiptNumber ?? pay.id;
      const lines: JournalLineInput[] = [
        { accountId: bankId, debit: amount, narration: `Receipt — ${ref}` },
        {
          accountId: creditId, credit: amount,
          narration: revenuePosted ? `Against invoice ${ref}` : `Advance — ${ref}`,
        },
      ];

      const res = await postWithinTx(tx, {
        date: pay.paidAt ?? new Date(),
        narration: `Payment received — ${ref}`,
        sourceModule: "RECEIVABLE", sourceRefId: pay.id, createdById: byId ?? null, lines,
      });
      return { posted: true, entryId: res.id, entryNo: res.entryNo };
    });
  } catch (e) {
    return { posted: false, reason: e instanceof Error ? e.message : "post-failed" };
  }
}
