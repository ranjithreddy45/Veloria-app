"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { velosOnPaymentCollected } from "@/lib/velos/triggers";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { reportSystemFailure } from "@/lib/ops-alert";
import { after } from "next/server";
import { sendEmail } from "@/lib/email";
import { paymentReceivedEmail } from "@/lib/email-templates/payment-received";
import { format } from "date-fns";
import { hasPermission } from "@/lib/permissions";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { applyRazorpayCapture, allocatePaidAmountToInstallments } from "@/lib/payments/apply-capture";
import { postPaymentReceived } from "@/lib/finance/receivables";

// ============================================================
// Money math helpers — currency values are paise-exact
// ------------------------------------------------------------
// Invoice/Payment amounts are Prisma Decimal; converting to JS Number for
// arithmetic accumulates IEEE-754 drift. We do all balance math in integer
// paise and only convert back to rupees at the boundary, so a 0.01 "tolerance"
// band-aid is never needed and we never persist micro-balances.
// ============================================================

/** Rupees (number/Decimal-as-number) → integer paise. */
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise → rupees, rounded to 2 dp for a Decimal column. */
function toRupees(paise: number): number {
  return paise / 100;
}

// ============================================================
// Helper: Generate Receipt Number (RCP-YYYY-NNNN)
// ------------------------------------------------------------
// Allocated from a gapless FinSequence counter INSIDE the caller's transaction
// (mirrors ledger.ts allocateEntryNo), eliminating the read-then-generate
// window that a non-@unique receiptNumber column otherwise leaves open under
// concurrent payment creation.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReceiptTx = any;

async function allocateReceiptNumber(tx: ReceiptTx): Promise<string> {
  const year = new Date().getFullYear();
  const fy = String(year);
  const prefix = `RCP-${year}-`;
  const existing = await tx.finSequence.findUnique({
    where: { entityId_series_fy: { entityId: "BILLION", series: "RCP", fy } },
  });
  let n: number;
  if (!existing) {
    // Seed the counter from any pre-FinSequence receipts already minted this
    // year (legacy max-scan rows) so we never re-mint an existing number.
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

// ============================================================
// Get Payments (Paginated + Filtered)
// ============================================================

export async function getPayments(params?: {
  status?: PaymentStatus;
  invoiceId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.invoiceId) {
      where.invoiceId = params.invoiceId;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              contact: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  company: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(payments),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_PAYMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payments" };
  }
}

// ============================================================
// Record Payment (Manual)
// ============================================================

export async function recordPayment(data: {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  transactionId?: string;
  notes?: string;
  receiptUrl?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      return { success: false as const, error: "Amount must be positive" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        balanceDue: true,
        status: true,
        dueDate: true,
      },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (invoice.status === "PAID") {
      return { success: false as const, error: "Invoice is already fully paid" };
    }

    if (invoice.status === "CANCELLED") {
      return {
        success: false as const,
        error: "Cannot record payment for cancelled invoice",
      };
    }

    // Cash can only be taken against an issued invoice — never a DRAFT (still
    // editable) or any other non-collectable state. Allow SENT/PARTIALLY_PAID/OVERDUE.
    if (!["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
      return {
        success: false as const,
        error: "Invoice must be sent before a payment can be recorded",
      };
    }

    const balancePaise = toPaise(Number(invoice.balanceDue));
    const amountPaise = toPaise(data.amount);
    if (amountPaise > balancePaise) {
      return {
        success: false as const,
        error: `Payment amount exceeds balance due (${toRupees(balancePaise).toFixed(2)})`,
      };
    }

    // Reject an unsafe receipt reference (never execute on open).
    if (data.receiptUrl && !isSafeReceiptUrl(data.receiptUrl)) {
      return { success: false as const, error: "Unsupported receipt — use an image, PDF or https link." };
    }

    // Atomic: allocate the receipt number from a gapless FinSequence counter,
    // create the payment, and CREDIT the invoice with a relative increment (not
    // an absolute write from a stale read), then re-read inside the same
    // transaction to set balance/status — so concurrent payments can't clobber
    // each other or mint a duplicate receipt number. All balance math is done in
    // integer paise to avoid float drift; balanceDue is rounded (never negative,
    // never a micro-balance) before persisting to the Decimal column.
    const txResult = await prisma.$transaction(async (tx) => {
      const receiptNumber = await allocateReceiptNumber(tx);
      const created = await tx.payment.create({
        data: {
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          status: "COMPLETED",
          transactionId: data.transactionId || null,
          receiptNumber,
          notes: data.notes || null,
          receiptUrl: data.receiptUrl || null,
          receiptUploadedAt: data.receiptUrl ? new Date() : null,
          paidAt: new Date(),
        },
      });
      const credited = await tx.invoice.update({
        where: { id: data.invoiceId },
        data: { paidAmount: { increment: data.amount } },
        select: { totalAmount: true, paidAmount: true },
      });
      const paidPaise = toPaise(Number(credited.paidAmount));
      const balPaise = toPaise(Number(credited.totalAmount)) - paidPaise;
      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          balanceDue: toRupees(Math.max(0, balPaise)),
          status: balPaise <= 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });
      // Flip fully-covered installments PENDING→COMPLETED in the same tx.
      await allocatePaidAmountToInstallments(tx, data.invoiceId, toRupees(paidPaise));
      return { payment: created, receiptNumber, newBalanceDue: toRupees(balPaise) };
    });
    const { payment, receiptNumber, newBalanceDue } = txResult;

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Payment",
      entityId: payment.id,
    });

    notify({
      userId: session.user.id as string,
      type: "PAYMENT_RECEIVED",
      title: "Payment Recorded",
      message: `Payment of ${formatINR(data.amount)} recorded (${receiptNumber}).`,
      actionUrl: `/invoices/${data.invoiceId}`,
    });

    // Fire-and-forget: Send payment receipt email
    try {
      const invoiceWithContact = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
        select: {
          invoiceNumber: true,
          balanceDue: true,
          contact: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });

      if (invoiceWithContact?.contact?.email) {
        const isFullyPaid = newBalanceDue <= 0;
        const emailTo = invoiceWithContact.contact.email;
        // after() so the receipt email survives a serverless freeze.
        after(() =>
        sendEmail({
          to: emailTo,
          subject: `Payment Received — ${receiptNumber}`,
          html: paymentReceivedEmail({
            contactName: `${invoiceWithContact.contact.firstName} ${invoiceWithContact.contact.lastName}`,
            receiptNumber,
            invoiceNumber: invoiceWithContact.invoiceNumber,
            paymentAmount: formatINR(data.amount),
            paymentMethod: data.method,
            paymentDate: format(new Date(), "dd MMM yyyy"),
            remainingBalance: formatINR(Math.max(0, newBalanceDue)),
            isFullyPaid,
          }),
        }).catch((err) => console.error("[PAYMENT_EMAIL_ERROR]", err))
        );
      }
    } catch (emailErr) {
      console.error("[PAYMENT_EMAIL_ERROR]", emailErr);
    }

    // Post the cash receipt to the General Ledger. Runs in after() so it's
    // guaranteed to execute post-response on serverless (instead of being a
    // fire-and-forget promise that can be dropped on function freeze), without
    // blocking the response. Idempotent; the daily gl-reconcile is the backstop.
    after(() =>
      postPaymentReceived(payment.id, session.user.id as string).catch((err) => {
        console.error("[PAYMENT_GL_POST_ERROR]", err);
        void reportSystemFailure({
          area: "GL posting",
          title: "Payment cash-receipt failed to post",
          detail: `Payment ${payment.id}: ${err instanceof Error ? err.message : "unknown"}. AR/cash may be unreconciled.`,
          actionUrl: "/finance",
        });
      })
    );

    // BookMyShow-style: if this payment covers the booking advance, the held
    // slot auto-confirms and the customer gets confirmations (best-effort).
    await maybeConfirmBookingOnPayment(data.invoiceId);

    // Velos: reward on-time collection (finance). Best-effort.
    await velosOnPaymentCollected({
      paymentId: payment.id,
      ownerId: session.user.id as string,
      onOrBeforeDue: !invoice.dueDate || new Date() <= invoice.dueDate,
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/payments");
    revalidatePath("/bookings");
    return { success: true as const, data: serialize(payment) };
  } catch (error) {
    console.error("[RECORD_PAYMENT_ERROR]", error);
    return { success: false as const, error: "Failed to record payment" };
  }
}

// ============================================================
// Verify a customer-submitted payment proof (PENDING → COMPLETED)
// ============================================================

export async function verifyPaymentProof(paymentId: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "payments:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { id: true, status: true } } },
    });
    if (!payment) return { success: false as const, error: "Payment not found" };
    // STRICT allow-list: only a genuine PENDING proof can be verified (blocks
    // already-COMPLETED, plus FAILED / REFUNDED / PROCESSING).
    if (payment.status !== "PENDING")
      return { success: false as const, error: "Only a pending payment proof can be verified" };
    if (!payment.receiptUrl)
      return { success: false as const, error: "This payment has no attached proof to verify" };
    if (payment.invoice.status === "CANCELLED")
      return { success: false as const, error: "Invoice is cancelled" };

    // Atomic + idempotent: only the writer that flips this PENDING row proceeds
    // to credit the invoice (relative increment, re-read for status) — so a
    // double-verify can't double-count. If the payment has no receipt number yet
    // we allocate one from the gapless FinSequence counter INSIDE the same
    // transaction (no read-then-generate window). Balance math is integer paise.
    const existingReceipt = payment.receiptNumber;
    const { verified, receiptNumber } = await prisma.$transaction(async (tx) => {
      const receiptNumber = existingReceipt || (await allocateReceiptNumber(tx));
      const flip = await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: "COMPLETED", paidAt: new Date(), receiptNumber },
      });
      if (flip.count !== 1) return { verified: false, receiptNumber }; // someone else verified it first
      const credited = await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: { paidAmount: { increment: Number(payment.amount) } },
        select: { totalAmount: true, paidAmount: true },
      });
      const paidPaise = toPaise(Number(credited.paidAmount));
      const balPaise = toPaise(Number(credited.totalAmount)) - paidPaise;
      await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          balanceDue: toRupees(Math.max(0, balPaise)),
          status: balPaise <= 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });
      // Flip fully-covered installments PENDING→COMPLETED in the same tx.
      await allocatePaidAmountToInstallments(tx, payment.invoice.id, toRupees(paidPaise));
      return { verified: true, receiptNumber };
    });
    if (!verified) return { success: false as const, error: "This payment was just verified by someone else" };

    await logActivity({
      userId: session.user.id as string,
      action: "verified",
      entityType: "Payment",
      entityId: paymentId,
    });

    // Post the verified cash receipt to the General Ledger via after() so it
    // can't be dropped on a serverless freeze (idempotent; reconcile backstop).
    after(() =>
      postPaymentReceived(paymentId, session.user.id as string).catch((err) => {
        console.error("[PAYMENT_GL_POST_ERROR]", err);
        void reportSystemFailure({
          area: "GL posting",
          title: "Payment cash-receipt failed to post",
          detail: `Payment ${paymentId}: ${err instanceof Error ? err.message : "unknown"}. AR/cash may be unreconciled.`,
          actionUrl: "/finance",
        });
      })
    );

    // Same BookMyShow-style confirm + customer notifications as a recorded payment.
    await maybeConfirmBookingOnPayment(payment.invoice.id);

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${payment.invoice.id}`);
    revalidatePath("/payments");
    revalidatePath("/bookings");
    return { success: true as const, data: { id: paymentId, receiptNumber } };
  } catch (error) {
    console.error("[VERIFY_PAYMENT_PROOF_ERROR]", error);
    return { success: false as const, error: "Failed to verify payment" };
  }
}

// ============================================================
// Create Razorpay Order (direct SDK call — no self-referential fetch)
// ============================================================

export async function createRazorpayOrder(invoiceId: string, amount: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return { success: false as const, error: "Razorpay is not configured" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, invoiceNumber: true, balanceDue: true, status: true },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return {
        success: false as const,
        error: "Cannot create payment for this invoice",
      };
    }

    if (!Number.isFinite(amount)) {
      return { success: false as const, error: "Invalid payment amount" };
    }
    const balancePaise = toPaise(Number(invoice.balanceDue));
    const pay = Math.round(Number(amount));
    if (!(pay >= 1) || toPaise(pay) > balancePaise) {
      return { success: false as const, error: "Invalid payment amount" };
    }

    // Create Razorpay order directly via SDK
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amountInPaise = Math.round(pay * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    // Create a pending payment record
    await prisma.payment.create({
      data: {
        invoiceId,
        amount: pay,
        method: "RAZORPAY",
        status: "PENDING",
        razorpayOrderId: order.id,
      },
    });

    return {
      success: true as const,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  } catch (error) {
    console.error("[CREATE_RAZORPAY_ORDER_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to create Razorpay order",
    };
  }
}

// ============================================================
// Verify Razorpay Payment (direct crypto — no self-referential fetch)
// ============================================================

export async function verifyRazorpayPayment(data: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  invoiceId: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return { success: false as const, error: "Razorpay is not configured" };
    }

    const crypto = (await import("crypto")).default;

    // Verify payment signature (timing-safe)
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    const genBuf = Buffer.from(generatedSignature);
    const provBuf = Buffer.from(data.razorpay_signature || "");
    const signatureValid =
      genBuf.length === provBuf.length && crypto.timingSafeEqual(genBuf, provBuf);
    if (!signatureValid) {
      await prisma.payment.updateMany({
        where: { razorpayOrderId: data.razorpay_order_id },
        data: { status: "FAILED" },
      });
      return { success: false as const, error: "Invalid payment signature" };
    }

    // Idempotent + atomic credit, bound to the payment's OWN invoice (not the
    // caller-supplied invoiceId — that could target another tenant's invoice).
    const applied = await applyRazorpayCapture({
      razorpayOrderId: data.razorpay_order_id,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature,
    });
    if (!applied.ok) return { success: false as const, error: applied.error };
    if (data.invoiceId && data.invoiceId !== applied.invoiceId) {
      return { success: false as const, error: "Invoice mismatch for this payment" };
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${applied.invoiceId}`);
    revalidatePath("/payments");
    return { success: true as const, data: { invoiceId: applied.invoiceId } };
  } catch (error) {
    console.error("[VERIFY_RAZORPAY_PAYMENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to verify Razorpay payment",
    };
  }
}

// ============================================================
// PUBLIC payment link flow (no login) — a customer opens /pay/<invoiceId> and
// pays via Razorpay. The unguessable invoice id is the access token; the
// Razorpay signature self-authenticates the capture. These mirror the authed
// order/verify but skip the session/permission gate (there is no logged-in
// customer). They never expose anything beyond what a payer needs.
// ============================================================

export async function getPublicInvoiceForPayment(invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        balanceDue: true,
        paidAmount: true,
        contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
        booking: { select: { eventName: true, date: true } },
      },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };
    return {
      success: true as const,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        total: Number(invoice.totalAmount),
        balanceDue: Number(invoice.balanceDue),
        paid: Number(invoice.paidAmount),
        customerName: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
        customerEmail: invoice.contact.email ?? "",
        customerPhone: invoice.contact.phone ?? "",
        eventName: invoice.booking?.eventName ?? null,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to load invoice" };
  }
}

export async function createPublicRazorpayOrder(invoiceId: string, amount: number) {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return { success: false as const, error: "Online payment is not configured" };
    }
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, invoiceNumber: true, balanceDue: true, status: true },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return { success: false as const, error: "This invoice is not payable" };
    }
    const balanceDue = Number(invoice.balanceDue);
    const pay = Math.round(Number(amount));
    if (!(pay >= 1) || pay > balanceDue + 0.01) {
      return { success: false as const, error: "Invalid payment amount" };
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await razorpay.orders.create({
      amount: Math.round(pay * 100),
      currency: "INR",
      receipt: invoice.invoiceNumber,
      notes: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, source: "payment_link" },
    });
    await prisma.payment.create({
      data: { invoiceId, amount: pay, method: "RAZORPAY", status: "PENDING", razorpayOrderId: order.id },
    });
    return {
      success: true as const,
      data: { orderId: order.id, amount: Math.round(pay * 100), currency: "INR", keyId: process.env.RAZORPAY_KEY_ID },
    };
  } catch (error: unknown) {
    // Razorpay SDK errors look like { statusCode, error: { code, description } }.
    const e = error as { statusCode?: number; error?: { code?: string; description?: string } };
    const desc = e?.error?.description;
    console.error("[CREATE_PUBLIC_RAZORPAY_ORDER_ERROR]", {
      statusCode: e?.statusCode,
      code: e?.error?.code,
      description: desc,
      raw: desc ? undefined : error,
    });
    if (e?.statusCode === 401) {
      return { success: false as const, error: "Payment gateway authentication failed. Please contact us — the link will be reissued." };
    }
    return {
      success: false as const,
      error: desc ? `Couldn't start payment: ${desc}` : "Failed to start payment. Please try again or contact us.",
    };
  }
}

export async function verifyPublicRazorpayPayment(data: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}) {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return { success: false as const, error: "Online payment is not configured" };
    }
    const crypto = (await import("crypto")).default;
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const genBuf = Buffer.from(generatedSignature);
    const provBuf = Buffer.from(data.razorpay_signature || "");
    const signatureValid =
      genBuf.length === provBuf.length && crypto.timingSafeEqual(genBuf, provBuf);
    if (!signatureValid) {
      await prisma.payment.updateMany({
        where: { razorpayOrderId: data.razorpay_order_id },
        data: { status: "FAILED" },
      });
      return { success: false as const, error: "Invalid payment signature" };
    }
    // Idempotent, atomic credit bound to the payment's own invoice via the order id.
    const applied = await applyRazorpayCapture({
      razorpayOrderId: data.razorpay_order_id,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature,
    });
    if (!applied.ok) return { success: false as const, error: applied.error };
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${applied.invoiceId}`);
    revalidatePath("/payments");
    return { success: true as const, data: { invoiceId: applied.invoiceId } };
  } catch (error) {
    console.error("[VERIFY_PUBLIC_RAZORPAY_PAYMENT_ERROR]", error);
    return { success: false as const, error: "Failed to confirm payment" };
  }
}

// ============================================================
// Get Payment Stats
// ============================================================

export async function getPaymentStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    const [todayCollections, pendingPayments, overdueAmount] = await Promise.all(
      [
        // Today's collections
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: "COMPLETED",
            paidAt: { gte: todayStart, lt: todayEnd },
          },
        }),
        // Pending payments
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: {
            status: { in: ["SENT", "PARTIALLY_PAID"] },
          },
        }),
        // Overdue amount
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: { status: "OVERDUE" },
        }),
      ]
    );

    return {
      success: true as const,
      data: {
        todayCollections: Number(todayCollections._sum.amount ?? 0),
        pendingPayments: Number(pendingPayments._sum.balanceDue ?? 0),
        overdueAmount: Number(overdueAmount._sum.balanceDue ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_PAYMENT_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payment stats" };
  }
}

// ============================================================
// Generate Payment Link
// ------------------------------------------------------------
// Produces a shareable link to the customer portal, where the customer pays
// the invoice through the Razorpay payment GATEWAY (checkout) — see
// src/app/(portal)/portal/invoices. Razorpay is used purely as the gateway at
// pay-time; we deliberately do NOT use Razorpay's separate "Payment Links"
// product (which needs separate account activation). This makes link
// generation independent of any Razorpay account state.
// ============================================================

export async function generatePaymentLink(
  invoiceId: string,
  options?: {
    acceptPartial?: boolean;
    expiresInDays?: number;
    notifyCustomer?: boolean;
    /** % of the invoice total the rep wants to collect now. Min 20%, max 100%. */
    percent?: number;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "payments:create")) {
      return { success: false as const, error: "Forbidden" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
        contact: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
      },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return { success: false as const, error: `Cannot generate link for ${invoice.status} invoice` };
    }

    const balanceDue = Number(invoice.balanceDue);
    if (balanceDue <= 0) {
      return { success: false as const, error: "No balance due" };
    }

    // Rep-selected collection %: at least 20% (the booking advance), capped at
    // 100%. Applied to the invoice total, then capped at the outstanding balance.
    const pct = Math.max(20, Math.min(100, Math.round(options?.percent ?? 100)));
    const total = Number(invoice.totalAmount);
    const collectAmount = Math.min(
      balanceDue,
      Math.max(1, Math.round((total * pct) / 100))
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // Public, no-login pay page tied to this invoice; carries the amount to
    // collect now (clamped server-side). No portal account needed.
    const shortUrl = `${baseUrl}/pay/${invoice.id}?amt=${collectAmount}`;

    logActivity({
      userId: session.user.id as string,
      action: "generated_payment_link",
      entityType: "Invoice",
      entityId: invoiceId,
      changes: { invoiceNumber: invoice.invoiceNumber, amount: collectAmount, percent: pct },
    });

    return {
      success: true as const,
      data: {
        shortUrl,
        amount: collectAmount,
        percent: pct,
        invoiceNumber: invoice.invoiceNumber,
        contactName: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
        contactEmail: invoice.contact.email,
        contactPhone: invoice.contact.phone,
        mode: "portal" as const,
      },
    };
  } catch (error) {
    console.error("[GENERATE_PAYMENT_LINK_ERROR]", error);
    return { success: false as const, error: "Failed to generate payment link" };
  }
}
