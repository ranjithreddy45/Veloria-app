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
import { postWithinTx, type JournalLineInput } from "./ledger";
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

      const [arId, revId, gstId] = await Promise.all([
        accountId(tx, FIN_ACCOUNT_CODES.debtors),
        accountId(tx, FIN_ACCOUNT_CODES.venueRental),
        accountId(tx, FIN_ACCOUNT_CODES.gstOutput),
      ]);
      if (!arId || !revId || !gstId) return { posted: false, reason: "accounts-missing" };

      const lines: JournalLineInput[] = [
        { accountId: arId, debit: total, narration: `Invoice ${inv.invoiceNumber}` },
        { accountId: revId, credit: revenue, narration: "Event revenue" },
      ];
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
