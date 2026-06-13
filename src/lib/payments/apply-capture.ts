import { prisma } from "@/lib/prisma";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { postPaymentReceived } from "@/lib/finance/receivables";

// Prisma tx client type is broad; keep it loose to avoid importing internals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextReceiptNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const last = await tx.payment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const lastNum = last?.receiptNumber ? parseInt(last.receiptNumber.split("-").pop() || "0", 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
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

  const credited = await prisma.$transaction(async (tx) => {
    const receiptNumber = await nextReceiptNumber(tx);
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
    return true;
  });

  if (!credited) return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: true };

  // Post the cash receipt to the General Ledger (best-effort, idempotent —
  // covers both the browser-verify and webhook paths from this one place).
  postPaymentReceived(payment.id).catch((err) =>
    console.error("[PAYMENT_GL_POST_ERROR]", err),
  );

  // BookMyShow-style: confirm the held slot once the advance is covered.
  await maybeConfirmBookingOnPayment(payment.invoiceId);
  return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: false };
}
