import { prisma } from "@/lib/prisma";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { settleConfiguratorPayment } from "@/lib/public/settle-configurator";
import { postPaymentReceived } from "@/lib/finance/receivables";
import { reportSystemFailure } from "@/lib/ops-alert";
import { allocateReceiptNumber } from "@/lib/finance/receipt-number";
import { finalizeOneTapBlock } from "@/lib/sales/quote-onetap";

/**
 * Allocate an invoice's cumulative paidAmount across its Installments,
 * oldest-due-first, and flip every fully-covered installment to COMPLETED
 * (setting paidAt). A partially-covered installment stays PENDING.
 *
 * Idempotent: derives state purely from the current paidAmount, so it can run
 * after every payment-apply path without double-counting. Money is Decimal —
 * we compare with Number() and a 1-paisa tolerance to avoid float drift.
 *
 * Must be called INSIDE the same transaction that updated paidAmount. Pass the
 * already-credited paidAmount so we don't re-read a stale row.
 *
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
export async function allocatePaidAmountToInstallments(
  // Prisma tx client type is broad; keep it loose to avoid importing internals.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  invoiceId: string,
  paidAmount: number,
): Promise<void> {
  // Guard the derived-state input: a non-finite or negative paidAmount must
  // never reach the allocation loop. NaN comparisons silently fall through to
  // the PENDING branch (wrongly reverting COMPLETED installments), and a
  // negative value would revert every installment. Clamp to a safe floor of 0
  // so a malformed/regressed amount degrades to "nothing covered" rather than
  // corrupting truthful state.
  const safePaid = Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : 0;

  const installments: { id: string; amount: unknown; status: string; paidAt: Date | null }[] =
    await tx.installment.findMany({
      where: { invoiceId },
      orderBy: { dueDate: "asc" },
      select: { id: true, amount: true, status: true, paidAt: true },
    });
  if (installments.length === 0) return;

  let remaining = safePaid;
  const now = new Date();
  for (const inst of installments) {
    const rawAmt = Number(inst.amount);
    // A malformed installment amount (NaN) would make every comparison false
    // and silently revert COMPLETED rows; treat it as 0 so it's covered rather
    // than corrupting state from an unexpected value.
    const amt = Number.isFinite(rawAmt) && rawAmt > 0 ? rawAmt : 0;
    if (remaining + 0.01 >= amt) {
      // Fully covered.
      remaining -= amt;
      if (inst.status !== "COMPLETED") {
        await tx.installment.update({
          where: { id: inst.id },
          data: { status: "COMPLETED", paidAt: inst.paidAt ?? now },
        });
      }
    } else {
      // Partially covered (or nothing left) — leave PENDING. If a prior run had
      // marked it COMPLETED but allocation no longer covers it, revert so state
      // stays truthful to paidAmount.
      if (inst.status === "COMPLETED") {
        await tx.installment.update({
          where: { id: inst.id },
          data: { status: "PENDING", paidAt: null },
        });
      }
      remaining = 0;
    }
  }
}

export type CaptureResult =
  | { ok: true; invoiceId: string; alreadyProcessed: boolean }
  | { ok: false; error: string };

/**
 * Idempotently + atomically apply a captured Razorpay payment to its OWN
 * invoice (never a caller-supplied invoiceId). Razorpay fires multiple paths
 * for one payment — the browser verify call AND the server webhook — so this
 * flips the payment PENDING→COMPLETED with a status-guarded updateMany and
 * credits the invoice with a relative increment inside one transaction. The
 * amount is therefore added EXACTLY ONCE no matter how many paths run or race.
 */
export async function applyRazorpayCapture(opts: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
}): Promise<CaptureResult> {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: opts.razorpayOrderId },
    select: { id: true, amount: true, invoiceId: true, status: true },
  });
  if (!payment) return { ok: false, error: "Payment record not found" };
  if (payment.status === "COMPLETED") {
    return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: true };
  }

  // Allocate the RCP-YYYY-NNNN receipt number from the shared gapless
  // FinSequence counter and apply the capture inside one transaction. The
  // counter's atomic increment makes the number monotonic across BOTH the
  // online (this) and manual payment paths, so duplicates can't occur. The
  // retry loop is retained as defense-in-depth (resolves cleanly if a P2002
  // ever fires, e.g. once receiptNumber is later made @unique).
  let credited: boolean | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5 && credited === null; attempt++) {
    try {
      credited = await prisma.$transaction(async (tx) => {
        // Allocate from the SHARED FinSequence counter — the same one the manual
        // payment paths use — so online + manual receipts never collide.
        const receiptNumber = await allocateReceiptNumber(tx);
        const flip = await tx.payment.updateMany({
          where: { id: payment.id, status: { not: "COMPLETED" } },
          data: {
            status: "COMPLETED",
            transactionId: opts.razorpayPaymentId || undefined,
            razorpaySignature: opts.razorpaySignature || undefined,
            receiptNumber,
            paidAt: new Date(),
          },
        });
        if (flip.count !== 1) return false; // another path already processed it
        const inv = await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { paidAmount: { increment: Number(payment.amount) } },
          select: { totalAmount: true, paidAmount: true },
        });
        const bal = Number(inv.totalAmount) - Number(inv.paidAmount);
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { balanceDue: Math.max(0, bal), status: bal <= 0.01 ? "PAID" : "PARTIALLY_PAID" },
        });
        // Flip fully-covered installments PENDING→COMPLETED in the same tx.
        await allocatePaidAmountToInstallments(tx, payment.invoiceId, Number(inv.paidAmount));
        return true;
      });
    } catch (e) {
      lastErr = e;
      // Only retry on a unique violation (fires once receiptNumber is @unique);
      // anything else is a real error and should propagate.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  if (credited === null) throw lastErr ?? new Error("Could not allocate a receipt number");

  if (!credited) return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: true };

  // Post the cash receipt to the General Ledger (best-effort, idempotent —
  // covers both the browser-verify and webhook paths from this one place).
  postPaymentReceived(payment.id).catch((err) => {
    console.error("[PAYMENT_GL_POST_ERROR]", err);
    void reportSystemFailure({
      area: "GL posting",
      title: "Payment cash-receipt failed to post",
      detail: `Payment ${payment.id}: ${err instanceof Error ? err.message : "unknown"}. AR/cash may be unreconciled.`,
      actionUrl: "/finance",
    });
  });

  // BookMyShow-style: confirm the held slot once the advance is covered.
  await maybeConfirmBookingOnPayment(payment.invoiceId);

  // Self-serve configurator (C6): a paid advance must never be silently dropped.
  // Mark the draft PAID and alert the team to reserve + confirm (re-checks the
  // slot, so a paid-but-taken race becomes an urgent alert). Idempotent.
  await settleConfiguratorPayment(payment.invoiceId).catch((e) =>
    console.error("[SETTLE_CONFIGURATOR_HOOK_ERROR]", e)
  );

  // One-tap quote-share: the slot block + booking creation must NOT depend on
  // the browser success handler running (the tab can close, or only Razorpay's
  // server webhook fires). If this captured invoice is the pay-invoice of a
  // QuoteShareLink, finalize server-side here. finalizeOneTapBlock is idempotent,
  // so this is safe alongside the client path; on failure we ESCALATE so a paid
  // customer is never silently left without a blocked slot.
  try {
    const link = await prisma.quoteShareLink.findFirst({
      where: { payInvoiceId: payment.invoiceId, status: "ACTIVE" },
      select: { id: true },
    });
    if (link) {
      const fin = await finalizeOneTapBlock(link.id);
      if (!fin.success && fin.error !== "SLOT_TAKEN") {
        void reportSystemFailure({
          area: "One-tap booking",
          title: "Paid quote-share advance — slot not blocked",
          detail: `Invoice ${payment.invoiceId} / link ${link.id}: ${fin.error}. Customer paid; block the slot manually.`,
          actionUrl: "/quotations",
        });
      }
    }
  } catch (err) {
    console.error("[ONETAP_WEBHOOK_FINALIZE_ERROR]", err);
    void reportSystemFailure({
      area: "One-tap booking",
      title: "Paid quote-share advance — finalize threw",
      detail: `Invoice ${payment.invoiceId}: ${err instanceof Error ? err.message : "unknown"}. Customer paid; block the slot manually.`,
      actionUrl: "/quotations",
    });
  }

  return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: false };
}
