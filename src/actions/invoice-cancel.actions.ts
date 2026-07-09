"use server";

// ============================================================
// Invoice + Payment cancellation — maker-checker (Vendor module spec §6a)
// ------------------------------------------------------------
// A "maker" (invoices:update / payments:update) REQUESTS a cancellation; a
// "manager" (invoices:cancel / payments:cancel — ADMIN / SUPER_ADMIN / FINANCE)
// APPROVES or REJECTS it. A requester who is themselves a manager auto-approves
// in one step. Approval REVERSES the source document's General-Ledger entry
// (reuse reverseJournalEntry via reverseReceivableEntry) so the double-entry
// ledger stays balanced, and — for payments — exactly reverses the invoice
// paidAmount / balanceDue / status / installment state that recording the
// payment set. All money math is done in integer paise to avoid float drift.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notifyAwait } from "@/lib/notify";
import { reverseReceivableEntry } from "@/lib/finance/receivables";
import { allocatePaidAmountToInstallments } from "@/lib/payments/apply-capture";

// ---- Money helpers (paise-exact; never persist a micro-balance) ----
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
function toRupees(paise: number): number {
  return paise / 100;
}

// ---- Manager helpers ----
function isInvoiceManager(role: string): boolean {
  return hasPermission(role, "invoices:cancel");
}
function isPaymentManager(role: string): boolean {
  return hasPermission(role, "payments:cancel");
}

/** Roles that hold a given permission (used to fan-out approval notifications). */
function rolesWith(perm: Permission): UserRole[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes(perm))
    .map(([role]) => role as UserRole);
}

/** Notify every active manager (holder of `perm`) that an approval is waiting. */
async function notifyManagers(
  perm: Permission,
  msg: { title: string; message: string; actionUrl: string; excludeUserId?: string },
): Promise<void> {
  const roles = rolesWith(perm);
  if (roles.length === 0) return;
  const managers = await prisma.user.findMany({
    where: {
      role: { in: roles },
      isActive: true,
      ...(msg.excludeUserId ? { id: { not: msg.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  await Promise.all(
    managers.map((m) =>
      notifyAwait({
        userId: m.id,
        type: "SYSTEM",
        title: msg.title,
        message: msg.message,
        actionUrl: msg.actionUrl,
      }),
    ),
  );
}

// ============================================================
// INVOICES
// ============================================================

export async function requestInvoiceCancellation(invoiceId: string, reason: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "invoices:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const trimmed = (reason ?? "").trim();
    if (!trimmed) return { success: false as const, error: "A cancellation reason is required" };

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, cancelPending: true, invoiceNumber: true, createdById: true },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };
    if (invoice.status === "CANCELLED") {
      return { success: false as const, error: "Invoice is already cancelled" };
    }
    if (invoice.cancelPending) {
      return { success: false as const, error: "A cancellation request is already pending for this invoice" };
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        cancelPending: true,
        cancelReason: trimmed,
        cancelRequestedById: session.user.id,
        cancelRequestedAt: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "requested_cancellation",
      entityType: "Invoice",
      entityId: invoiceId,
    });

    // A manager who requests is the checker too → auto-approve in one step.
    if (isInvoiceManager(session.user.role as string)) {
      return approveInvoiceCancellation(invoiceId);
    }

    await notifyManagers("invoices:cancel", {
      title: "Invoice cancellation requested",
      message: `${invoice.invoiceNumber} — cancellation requested: ${trimmed}`,
      actionUrl: `/invoices/${invoiceId}`,
      excludeUserId: session.user.id,
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true as const, data: { pending: true } };
  } catch (error) {
    console.error("[REQUEST_INVOICE_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to request cancellation" };
  }
}

export async function approveInvoiceCancellation(invoiceId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "invoices:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        paidAmount: true,
        invoiceNumber: true,
        cancelRequestedById: true,
        cancelReason: true,
      },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };
    if (invoice.status === "CANCELLED") {
      return { success: false as const, error: "Invoice is already cancelled" };
    }

    // HARD BLOCK: an invoice with money against it must have its payments
    // cancelled/refunded first — never silently un-collect real cash.
    if (toPaise(Number(invoice.paidAmount)) > 0) {
      return {
        success: false as const,
        error: `This invoice has ${formatINR(Number(invoice.paidAmount))} collected — cancel or refund its payments before cancelling the invoice.`,
      };
    }

    // Reverse the revenue-recognition GL entry FIRST (fail-safe): if the ledger
    // is live but the entry can't be found/reversed, refuse rather than leave
    // revenue/AR unreversed. No-op when Finance isn't set up.
    const rev = await reverseReceivableEntry(
      invoiceId,
      `Invoice ${invoice.invoiceNumber} cancelled`,
      session.user.id,
    );
    if (!rev.ok) return { success: false as const, error: rev.error };

    // Atomically mark cancelled + void any open installments. Guarded on the
    // status so a concurrent approve can't double-apply.
    const updated = await prisma.$transaction(async (tx) => {
      const flip = await tx.invoice.updateMany({
        where: { id: invoiceId, status: { not: "CANCELLED" } },
        data: {
          status: "CANCELLED",
          balanceDue: 0,
          cancelPending: false,
          cancelledById: session.user!.id,
          cancelledAt: new Date(),
        },
      });
      if (flip.count !== 1) return false;
      // Void every installment that hasn't been collected.
      await tx.installment.updateMany({
        where: { invoiceId, status: { not: "COMPLETED" } },
        data: { status: "CANCELLED" },
      });
      return true;
    });
    if (!updated) return { success: false as const, error: "Invoice was just cancelled by someone else" };

    await logActivity({
      userId: session.user.id as string,
      action: "cancelled",
      entityType: "Invoice",
      entityId: invoiceId,
    });

    // Tell the requester (if someone else) their request was approved.
    if (invoice.cancelRequestedById && invoice.cancelRequestedById !== session.user.id) {
      await notifyAwait({
        userId: invoice.cancelRequestedById,
        type: "SYSTEM",
        title: "Invoice cancellation approved",
        message: `${invoice.invoiceNumber} has been cancelled.`,
        actionUrl: `/invoices/${invoiceId}`,
      });
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/payments");
    revalidatePath("/finance");
    return { success: true as const, data: { id: invoiceId, cancelled: true } };
  } catch (error) {
    console.error("[APPROVE_INVOICE_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to cancel invoice" };
  }
}

export async function rejectInvoiceCancellation(invoiceId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "invoices:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, cancelPending: true, cancelRequestedById: true, invoiceNumber: true },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };
    if (!invoice.cancelPending) {
      return { success: false as const, error: "There is no pending cancellation to reject" };
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        cancelPending: false,
        cancelReason: null,
        cancelRequestedById: null,
        cancelRequestedAt: null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "rejected_cancellation",
      entityType: "Invoice",
      entityId: invoiceId,
    });

    if (invoice.cancelRequestedById && invoice.cancelRequestedById !== session.user.id) {
      await notifyAwait({
        userId: invoice.cancelRequestedById,
        type: "SYSTEM",
        title: "Invoice cancellation rejected",
        message: `The request to cancel ${invoice.invoiceNumber} was rejected.`,
        actionUrl: `/invoices/${invoiceId}`,
      });
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true as const, data: { id: invoiceId, rejected: true } };
  } catch (error) {
    console.error("[REJECT_INVOICE_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to reject cancellation" };
  }
}

// ============================================================
// PAYMENTS
// ============================================================

export async function requestPaymentCancellation(paymentId: string, reason: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "payments:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const trimmed = (reason ?? "").trim();
    if (!trimmed) return { success: false as const, error: "A cancellation reason is required" };

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, cancelPending: true, invoiceId: true, receiptNumber: true },
    });
    if (!payment) return { success: false as const, error: "Payment not found" };
    if (payment.status === "CANCELLED") {
      return { success: false as const, error: "Payment is already cancelled" };
    }
    // Only a completed (collected) payment needs a maker-checker cancel; a
    // PENDING/FAILED proof can be handled by the existing verify flow.
    if (payment.status !== "COMPLETED") {
      return { success: false as const, error: "Only a completed payment can be cancelled" };
    }
    if (payment.cancelPending) {
      return { success: false as const, error: "A cancellation request is already pending for this payment" };
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        cancelPending: true,
        cancelReason: trimmed,
        cancelRequestedById: session.user.id,
        cancelRequestedAt: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "requested_cancellation",
      entityType: "Payment",
      entityId: paymentId,
    });

    if (isPaymentManager(session.user.role as string)) {
      return approvePaymentCancellation(paymentId);
    }

    await notifyManagers("payments:cancel", {
      title: "Payment cancellation requested",
      message: `Receipt ${payment.receiptNumber ?? paymentId.slice(0, 8)} — cancellation requested: ${trimmed}`,
      actionUrl: `/invoices/${payment.invoiceId}`,
      excludeUserId: session.user.id,
    });

    revalidatePath("/payments");
    revalidatePath(`/invoices/${payment.invoiceId}`);
    return { success: true as const, data: { pending: true } };
  } catch (error) {
    console.error("[REQUEST_PAYMENT_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to request cancellation" };
  }
}

export async function approvePaymentCancellation(paymentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "payments:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        invoiceId: true,
        receiptNumber: true,
        cancelRequestedById: true,
      },
    });
    if (!payment) return { success: false as const, error: "Payment not found" };
    if (payment.status === "CANCELLED") {
      return { success: false as const, error: "Payment is already cancelled" };
    }
    if (payment.status !== "COMPLETED") {
      return { success: false as const, error: "Only a completed payment can be cancelled" };
    }

    // Reverse the cash-receipt GL entry FIRST (fail-safe). No-op if Finance
    // isn't set up; refuses if the ledger is live but the entry is missing.
    const rev = await reverseReceivableEntry(
      paymentId,
      `Payment ${payment.receiptNumber ?? paymentId} cancelled`,
      session.user.id,
    );
    if (!rev.ok) return { success: false as const, error: rev.error };

    const amountPaise = toPaise(Number(payment.amount));

    // Atomically: flip the payment CANCELLED (status-guarded so a concurrent
    // approve can't double-decrement), remove its amount from the invoice, and
    // recompute balance/status/installments EXACTLY reversing recordPayment.
    const result = await prisma.$transaction(async (tx) => {
      const flip = await tx.payment.updateMany({
        where: { id: paymentId, status: "COMPLETED" },
        data: {
          status: "CANCELLED",
          cancelPending: false,
          cancelledById: session.user!.id,
          cancelledAt: new Date(),
        },
      });
      if (flip.count !== 1) return { done: false as const };

      const debited = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { paidAmount: { decrement: Number(payment.amount) } },
        select: { totalAmount: true, paidAmount: true, dueDate: true },
      });

      // Never let paidAmount drift below zero from rounding.
      const paidPaise = Math.max(0, toPaise(Number(debited.paidAmount)));
      const totalPaise = toPaise(Number(debited.totalAmount));
      const balPaise = Math.max(0, totalPaise - paidPaise);
      const pastDue = !!debited.dueDate && debited.dueDate < new Date();
      // Removing a payment can only ever move the invoice AWAY from PAID:
      //  - no money left  → SENT (or OVERDUE if past its due date)
      //  - money remains  → PARTIALLY_PAID (or OVERDUE if past due)
      const status =
        paidPaise <= 0 ? (pastDue ? "OVERDUE" : "SENT") : pastDue ? "OVERDUE" : "PARTIALLY_PAID";

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { paidAmount: toRupees(paidPaise), balanceDue: toRupees(balPaise), status },
      });

      // Re-derive installment state from the reduced paidAmount: this reopens
      // (COMPLETED→PENDING) any installment the remaining cash no longer covers.
      await allocatePaidAmountToInstallments(tx, payment.invoiceId, toRupees(paidPaise));

      return { done: true as const, newPaid: toRupees(paidPaise), newBalance: toRupees(balPaise) };
    });

    if (!result.done) {
      return { success: false as const, error: "Payment was just cancelled by someone else" };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "cancelled",
      entityType: "Payment",
      entityId: paymentId,
    });

    if (payment.cancelRequestedById && payment.cancelRequestedById !== session.user.id) {
      await notifyAwait({
        userId: payment.cancelRequestedById,
        type: "SYSTEM",
        title: "Payment cancellation approved",
        message: `Payment of ${formatINR(Number(payment.amount))} (${payment.receiptNumber ?? paymentId.slice(0, 8)}) has been cancelled.`,
        actionUrl: `/invoices/${payment.invoiceId}`,
      });
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${payment.invoiceId}`);
    revalidatePath("/payments");
    revalidatePath("/finance");
    return { success: true as const, data: serialize({ id: paymentId, ...result }) };
  } catch (error) {
    console.error("[APPROVE_PAYMENT_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to cancel payment" };
  }
}

export async function rejectPaymentCancellation(paymentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "payments:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, cancelPending: true, cancelRequestedById: true, invoiceId: true, receiptNumber: true },
    });
    if (!payment) return { success: false as const, error: "Payment not found" };
    if (!payment.cancelPending) {
      return { success: false as const, error: "There is no pending cancellation to reject" };
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        cancelPending: false,
        cancelReason: null,
        cancelRequestedById: null,
        cancelRequestedAt: null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "rejected_cancellation",
      entityType: "Payment",
      entityId: paymentId,
    });

    if (payment.cancelRequestedById && payment.cancelRequestedById !== session.user.id) {
      await notifyAwait({
        userId: payment.cancelRequestedById,
        type: "SYSTEM",
        title: "Payment cancellation rejected",
        message: `The request to cancel receipt ${payment.receiptNumber ?? paymentId.slice(0, 8)} was rejected.`,
        actionUrl: `/invoices/${payment.invoiceId}`,
      });
    }

    revalidatePath("/payments");
    revalidatePath(`/invoices/${payment.invoiceId}`);
    return { success: true as const, data: { id: paymentId, rejected: true } };
  } catch (error) {
    console.error("[REJECT_PAYMENT_CANCELLATION_ERROR]", error);
    return { success: false as const, error: "Failed to reject cancellation" };
  }
}
