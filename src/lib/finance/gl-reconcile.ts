import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { postInvoiceIssued, postPaymentReceived } from "@/lib/finance/receivables";
import { postPayoutPaid } from "@/lib/finance/payables";
import { reconcileAdvanceNetting } from "@/actions/vendor-bill.actions";
import { reportSystemFailure } from "@/lib/ops-alert";

// ============================================================
// GL self-heal. The real-time GL bridges (postInvoiceIssued / postPaymentReceived)
// are best-effort and idempotent — if one ever fails (DB blip, accounts mid-seed),
// AR/cash silently desync. This sweep re-posts any issued invoice or completed
// payment that is missing its General-Ledger entry, so the books reconcile
// themselves. Fully idempotent (skips anything already posted) and never throws.
// Anything that STILL won't post after a retry is surfaced to admins.
// ============================================================

// Reasons that are normal skips, not failures worth alerting on.
const BENIGN_REASONS = new Set([
  "already-posted",
  "not-seeded",
  "zero-total",
  "non-positive-amount",
  "accounts-missing", // finance mid-seed / chart incomplete — not a real posting failure
]);

const RECEIVABLE = "RECEIVABLE" as Prisma.FinJournalEntryWhereInput["sourceModule"];
const PAYABLE = "PAYABLE" as Prisma.FinJournalEntryWhereInput["sourceModule"];

export interface GlReconcileResult {
  seeded: boolean;
  invoicesChecked: number;
  invoicesReposted: number;
  paymentsChecked: number;
  paymentsReposted: number;
  payoutsChecked: number;
  payoutsReposted: number;
  nettingReattempted: number;
  failures: { kind: "invoice" | "payment" | "payout"; id: string; reason: string }[];
}

export async function reconcileGlPostings(opts?: { lookbackDays?: number }): Promise<GlReconcileResult> {
  const result: GlReconcileResult = {
    seeded: false,
    invoicesChecked: 0,
    invoicesReposted: 0,
    paymentsChecked: 0,
    paymentsReposted: 0,
    payoutsChecked: 0,
    payoutsReposted: 0,
    nettingReattempted: 0,
    failures: [],
  };

  // No chart of accounts → finance isn't set up; nothing to reconcile.
  const accountCount = await prisma.finAccount.count();
  if (accountCount === 0) return result;
  result.seeded = true;

  const lookbackDays = opts?.lookbackDays ?? 45;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // 1) Issued invoices missing a revenue posting.
  const issued = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  result.invoicesChecked = issued.length;
  if (issued.length) {
    const ids = issued.map((i) => i.id);
    const posted = await prisma.finJournalEntry.findMany({
      where: { sourceModule: RECEIVABLE, sourceRefId: { in: ids } },
      select: { sourceRefId: true },
    });
    const postedSet = new Set(posted.map((e) => e.sourceRefId));
    for (const id of ids) {
      if (postedSet.has(id)) continue;
      const r = await postInvoiceIssued(id);
      if (r.posted) result.invoicesReposted++;
      else if (!BENIGN_REASONS.has(r.reason)) result.failures.push({ kind: "invoice", id, reason: r.reason });
    }
  }

  // 2) Completed payments missing a cash-receipt posting (the payment's own
  //    entry is keyed on sourceRefId = paymentId).
  const payments = await prisma.payment.findMany({
    where: { status: "COMPLETED", createdAt: { gte: since } },
    select: { id: true },
  });
  result.paymentsChecked = payments.length;
  if (payments.length) {
    const ids = payments.map((p) => p.id);
    const posted = await prisma.finJournalEntry.findMany({
      where: { sourceModule: RECEIVABLE, sourceRefId: { in: ids } },
      select: { sourceRefId: true },
    });
    const postedSet = new Set(posted.map((e) => e.sourceRefId));
    for (const id of ids) {
      if (postedSet.has(id)) continue;
      const r = await postPaymentReceived(id);
      if (r.posted) result.paymentsReposted++;
      else if (!BENIGN_REASONS.has(r.reason)) result.failures.push({ kind: "payment", id, reason: r.reason });
    }
  }

  // 3) PAID payouts missing their cash-disbursement posting (Dr payable / Cr Bank),
  //    keyed on sourceModule=PAYABLE, sourceRefId=payoutId. The real-time post runs
  //    in after() and can be dropped on a serverless freeze with no other retry.
  const paidPayouts = await prisma.payout.findMany({
    where: { status: "PAID", createdAt: { gte: since } },
    select: { id: true },
  });
  result.payoutsChecked = paidPayouts.length;
  if (paidPayouts.length) {
    const ids = paidPayouts.map((p) => p.id);
    const posted = await prisma.finJournalEntry.findMany({
      where: { sourceModule: PAYABLE, sourceRefId: { in: ids } },
      select: { sourceRefId: true },
    });
    const postedSet = new Set(posted.map((e) => e.sourceRefId));
    for (const id of ids) {
      if (postedSet.has(id)) continue;
      const r = await postPayoutPaid(id);
      if (r.posted) result.payoutsReposted++;
      else if (!BENIGN_REASONS.has(r.reason)) result.failures.push({ kind: "payout", id, reason: r.reason });
    }
  }

  // 4) Re-attempt vendor advance-netting for any APPROVED bill whose post-approval
  //    netting was dropped, so a paid advance can't be double-paid. Idempotent.
  try {
    const net = await reconcileAdvanceNetting(lookbackDays);
    result.nettingReattempted = net.reattempted;
  } catch (e) {
    console.error("[GL_RECONCILE_NETTING_ERR]", e);
  }

  // Anything that still won't post after a retry needs a human — surface it.
  if (result.failures.length > 0) {
    await reportSystemFailure({
      area: "GL reconcile",
      title: `${result.failures.length} document(s) still won't post to the GL`,
      detail: result.failures
        .slice(0, 10)
        .map((f) => `${f.kind} ${f.id}: ${f.reason}`)
        .join("; "),
      actionUrl: "/finance",
    });
  }

  return result;
}
