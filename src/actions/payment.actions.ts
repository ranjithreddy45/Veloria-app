"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { velosOnPaymentCollected } from "@/lib/velos/triggers";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { paymentReceivedEmail } from "@/lib/email-templates/payment-received";
import { format } from "date-fns";
import { hasPermission } from "@/lib/permissions";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { applyRazorpayCapture, allocatePaidAmountToInstallments } from "@/lib/payments/apply-capture";
import { postPaymentReceived } from "@/lib/finance/receivables";

// ============================================================
// Helper: Generate Receipt Number (RCP-YYYY-NNNN)
// ============================================================

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;

  const lastPayment = await prisma.payment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  let nextNumber = 1;
  if (lastPayment?.receiptNumber) {
    const lastNum = parseInt(
      lastPayment.receiptNumber.split("-").pop() || "0",
      10
    );
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
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

    if (data.amount <= 0) {
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

    const balanceDue = Number(invoice.balanceDue);
    if (data.amount > balanceDue + 0.01) {
      return {
        success: false as const,
        error: `Payment amount exceeds balance due (${balanceDue.toFixed(2)})`,
      };
    }

    // Reject an unsafe receipt reference (never execute on open).
    if (data.receiptUrl && !isSafeReceiptUrl(data.receiptUrl)) {
      return { success: false as const, error: "Unsupported receipt — use an image, PDF or https link." };
    }

    // Atomic: create the payment and CREDIT the invoice with a relative
    // increment (not an absolute write from a stale read), then re-read inside
    // the same transaction to set balance/status — so concurrent payments can't
    // clobber each other and lose money.
    //
    // The RCP-YYYY-NNNN receipt number is allocated INSIDE a P2002 retry loop:
    // two concurrent records can read the same max and mint a duplicate, so on a
    // unique violation we re-allocate (mirroring the booking-number pattern).
    // NOTE: Payment.receiptNumber is NOT @unique in the schema (and per the task
    // we don't add the constraint), so P2002 can't fire today — re-reading the
    // max each attempt narrows the window but can't fully guarantee uniqueness
    // under true concurrency; a @unique index would be required. The catch is
    // kept so the retry resolves correctly if the column is later made unique.
    let txResult: { payment: Awaited<ReturnType<typeof prisma.payment.create>>; newPaidAmount: number; newBalanceDue: number } | null = null;
    let receiptNumber = "";
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5 && txResult === null; attempt++) {
      receiptNumber = await generateReceiptNumber();
      try {
        txResult = await prisma.$transaction(async (tx) => {
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
          const paid = Number(credited.paidAmount);
          const bal = Number(credited.totalAmount) - paid;
          await tx.invoice.update({
            where: { id: data.invoiceId },
            data: { balanceDue: Math.max(0, bal), status: bal <= 0.01 ? "PAID" : "PARTIALLY_PAID" },
          });
          // Flip fully-covered installments PENDING→COMPLETED in the same tx.
          await allocatePaidAmountToInstallments(tx, data.invoiceId, paid);
          return { payment: created, newPaidAmount: paid, newBalanceDue: bal };
        });
      } catch (e) {
        lastErr = e;
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
    }
    if (txResult === null) throw lastErr ?? new Error("Could not allocate a receipt number");
    const { payment, newPaidAmount, newBalanceDue } = txResult;

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
        const isFullyPaid = newBalanceDue <= 0.01;
        sendEmail({
          to: invoiceWithContact.contact.email,
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
        }).catch((err) => console.error("[PAYMENT_EMAIL_ERROR]", err));
      }
    } catch (emailErr) {
      console.error("[PAYMENT_EMAIL_ERROR]", emailErr);
    }

    // Post the cash receipt to the General Ledger (best-effort: no-op if
    // Finance isn't set up; never blocks recording the payment).
    postPaymentReceived(payment.id, session.user.id as string).catch((err) =>
      console.error("[PAYMENT_GL_POST_ERROR]", err),
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
    // double-verify can't double-count.
    //
    // If the payment has no receipt number yet we allocate RCP-YYYY-NNNN inside
    // a P2002 retry loop (re-allocating on a unique violation, mirroring the
    // booking-number pattern). NOTE: Payment.receiptNumber is NOT @unique (and
    // per the task we don't add the constraint), so P2002 can't fire today — the
    // re-read narrows the window but can't fully guarantee uniqueness under true
    // concurrency; a @unique index would be required. The catch is kept so the
    // retry resolves correctly if the column is later made unique.
    let receiptNumber = payment.receiptNumber || "";
    let verified: boolean | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5 && verified === null; attempt++) {
      if (!payment.receiptNumber) receiptNumber = await generateReceiptNumber();
      try {
        verified = await prisma.$transaction(async (tx) => {
          const flip = await tx.payment.updateMany({
            where: { id: paymentId, status: "PENDING" },
            data: { status: "COMPLETED", paidAt: new Date(), receiptNumber },
          });
          if (flip.count !== 1) return false; // someone else verified it first
          const credited = await tx.invoice.update({
            where: { id: payment.invoice.id },
            data: { paidAmount: { increment: Number(payment.amount) } },
            select: { totalAmount: true, paidAmount: true },
          });
          const bal = Number(credited.totalAmount) - Number(credited.paidAmount);
          await tx.invoice.update({
            where: { id: payment.invoice.id },
            data: { balanceDue: Math.max(0, bal), status: bal <= 0.01 ? "PAID" : "PARTIALLY_PAID" },
          });
          // Flip fully-covered installments PENDING→COMPLETED in the same tx.
          await allocatePaidAmountToInstallments(tx, payment.invoice.id, Number(credited.paidAmount));
          return true;
        });
      } catch (e) {
        lastErr = e;
        // A pre-existing receipt number can't collide on re-run, so a P2002 there
        // is unexpected; only retry the freshly-allocated case.
        if ((e as { code?: string }).code !== "P2002" || payment.receiptNumber) throw e;
      }
    }
    if (verified === null) throw lastErr ?? new Error("Could not allocate a receipt number");
    if (!verified) return { success: false as const, error: "This payment was just verified by someone else" };

    await logActivity({
      userId: session.user.id as string,
      action: "verified",
      entityType: "Payment",
      entityId: paymentId,
    });

    // Post the verified cash receipt to the General Ledger (best-effort).
    postPaymentReceived(paymentId, session.user.id as string).catch((err) =>
      console.error("[PAYMENT_GL_POST_ERROR]", err),
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

    const balanceDue = Number(invoice.balanceDue);
    if (amount > balanceDue + 0.01) {
      return { success: false as const, error: "Amount exceeds balance due" };
    }

    // Create Razorpay order directly via SDK
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amountInPaise = Math.round(amount * 100);
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
        amount,
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

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== data.razorpay_signature) {
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
  } catch (error) {
    console.error("[CREATE_PUBLIC_RAZORPAY_ORDER_ERROR]", error);
    return { success: false as const, error: "Failed to start payment" };
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
    if (generatedSignature !== data.razorpay_signature) {
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
