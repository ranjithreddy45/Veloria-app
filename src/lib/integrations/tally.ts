import { prisma } from "@/lib/prisma";

// ============================================================
// Tally Integration — Placeholder Module
// ============================================================
// All functions are placeholders that queue records for future
// Tally accounting sync. They log a message and create an
// AccountingSyncLog record with status PENDING. Real Tally API
// integration will replace these stubs later.

/**
 * Sync an invoice to Tally (placeholder).
 */
export async function syncInvoice(invoiceId: string) {
  // Placeholder: queued for sync when Tally integration is configured
  console.log(`Tally sync placeholder: queuing invoice ${invoiceId}`);

  const log = await prisma.accountingSyncLog.create({
    data: {
      type: "INVOICE",
      entityId: invoiceId,
      status: "PENDING",
      externalRef: null,
      syncedAt: new Date(),
    },
  });

  return log;
}

/**
 * Sync a payment to Tally (placeholder).
 */
export async function syncPayment(paymentId: string) {
  // Placeholder: queued for sync when Tally integration is configured
  console.log(`Tally sync placeholder: queuing payment ${paymentId}`);

  const log = await prisma.accountingSyncLog.create({
    data: {
      type: "PAYMENT",
      entityId: paymentId,
      status: "PENDING",
      externalRef: null,
      syncedAt: new Date(),
    },
  });

  return log;
}

/**
 * Sync a payout to Tally (placeholder).
 */
export async function syncPayout(payoutId: string) {
  // Placeholder: queued for sync when Tally integration is configured
  console.log(`Tally sync placeholder: queuing payout ${payoutId}`);

  const log = await prisma.accountingSyncLog.create({
    data: {
      type: "PAYOUT",
      entityId: payoutId,
      status: "PENDING",
      externalRef: null,
      syncedAt: new Date(),
    },
  });

  return log;
}
