// ============================================================
// Receipt-number allocator — the SINGLE source of truth for RCP-YYYY-NNNN.
// ------------------------------------------------------------
// Both the manual payment paths (recordPayment / verifyPaymentProof) AND the
// Razorpay capture path mint receipt numbers here, from one gapless FinSequence
// counter, so the two can never collide on a duplicate RCP number (which would
// break GL/audit reconciliation). Must be called INSIDE the caller's tx.
// ============================================================

// Prisma's interactive-transaction client type is broad; keep it loose so this
// shared helper works from any $transaction callback without importing internals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReceiptTx = any;

export async function allocateReceiptNumber(tx: ReceiptTx): Promise<string> {
  const year = new Date().getFullYear();
  const fy = String(year);
  const prefix = `RCP-${year}-`;
  const existing = await tx.finSequence.findUnique({
    where: { entityId_series_fy: { entityId: "BILLION", series: "RCP", fy } },
  });
  let n: number;
  if (!existing) {
    // Seed the counter from any pre-FinSequence receipts already minted this
    // year (legacy max-scan rows, incl. older Razorpay captures) so we never
    // re-mint an existing number when the counter is first created.
    const last = await tx.payment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });
    const lastNum = last?.receiptNumber
      ? parseInt(last.receiptNumber.split("-").pop() || "0", 10) || 0
      : 0;
    n = lastNum + 1;
    await tx.finSequence.create({
      data: { entityId: "BILLION", series: "RCP", fy, nextNum: n + 1 },
    });
  } else {
    await tx.finSequence.update({
      where: { id: existing.id },
      data: { nextNum: { increment: 1 } },
    });
    n = existing.nextNum;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}
