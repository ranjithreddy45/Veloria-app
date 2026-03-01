"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { paymentReceivedEmail } from "@/lib/email-templates/payment-received";
import { format } from "date-fns";
import { hasPermission } from "@/lib/permissions";

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
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
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

    const balanceDue = Number(invoice.balanceDue);
    if (data.amount > balanceDue + 0.01) {
      return {
        success: false as const,
        error: `Payment amount exceeds balance due (${balanceDue.toFixed(2)})`,
      };
    }

    const receiptNumber = await generateReceiptNumber();

    const newPaidAmount = Number(invoice.paidAmount) + data.amount;
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus =
      newBalanceDue <= 0.01 ? "PAID" : "PARTIALLY_PAID";

    // Create payment and update invoice in a transaction
    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          status: "COMPLETED",
          transactionId: data.transactionId || null,
          receiptNumber,
          notes: data.notes || null,
          paidAt: new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
        },
      }),
    ]);

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

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/payments");
    return { success: true as const, data: serialize(payment) };
  } catch (error) {
    console.error("[RECORD_PAYMENT_ERROR]", error);
    return { success: false as const, error: "Failed to record payment" };
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

    // Find the pending payment
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: data.razorpay_order_id },
    });

    if (!payment) {
      return { success: false as const, error: "Payment record not found" };
    }

    // Get invoice for balance calculations
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      select: { totalAmount: true, paidAmount: true },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    const paymentAmount = Number(payment.amount);
    const newPaidAmount = Number(invoice.paidAmount) + paymentAmount;
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus = newBalanceDue <= 0.01 ? "PAID" : "PARTIALLY_PAID";

    // Generate receipt number
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
    const receiptNumber = `${prefix}${String(nextNumber).padStart(4, "0")}`;

    // Update payment and invoice in a transaction
    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          transactionId: data.razorpay_payment_id,
          razorpaySignature: data.razorpay_signature,
          receiptNumber,
          paidAt: new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
        },
      }),
    ]);

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/payments");
    return { success: true as const, data: serialize(updatedPayment) };
  } catch (error) {
    console.error("[VERIFY_RAZORPAY_PAYMENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to verify Razorpay payment",
    };
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
// Generate Razorpay Payment Link
// ============================================================

export async function generatePaymentLink(
  invoiceId: string,
  options?: {
    acceptPartial?: boolean;
    expiresInDays?: number;
    notifyCustomer?: boolean;
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

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      // Fallback: generate a portal payment link (no Razorpay needed)
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

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const portalLink = `${baseUrl}/portal/invoices?invoice=${invoice.invoiceNumber}`;

      return {
        success: true as const,
        data: {
          shortUrl: portalLink,
          amount: Number(invoice.balanceDue),
          invoiceNumber: invoice.invoiceNumber,
          contactName: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
          contactEmail: invoice.contact.email,
          contactPhone: invoice.contact.phone,
          mode: "portal" as const,
        },
      };
    }

    // Full Razorpay Payment Link mode
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
        dueDate: true,
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

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amountInPaise = Math.round(balanceDue * 100);
    const expiresInDays = options?.expiresInDays ?? 7;
    const expireBy = Math.floor(Date.now() / 1000) + expiresInDays * 86400;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkData: any = {
      amount: amountInPaise,
      currency: "INR",
      accept_partial: options?.acceptPartial ?? true,
      reference_id: invoice.id,
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
      expire_by: expireBy,
      notify: {
        sms: options?.notifyCustomer ?? true,
        email: options?.notifyCustomer ?? true,
      },
      reminder_enable: true,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices?payment=success`,
      callback_method: "get",
    };

    // Add customer info if available
    if (invoice.contact.email || invoice.contact.phone) {
      linkData.customer = {
        name: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
        email: invoice.contact.email || undefined,
        contact: invoice.contact.phone || undefined,
      };
    }

    const paymentLink = await razorpay.paymentLink.create(linkData);

    logActivity({
      userId: session.user.id as string,
      action: "generated_payment_link",
      entityType: "Invoice",
      entityId: invoiceId,
      changes: {
        invoiceNumber: invoice.invoiceNumber,
        amount: balanceDue,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkId: (paymentLink as any).id,
      },
    });

    return {
      success: true as const,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shortUrl: (paymentLink as any).short_url as string,
        amount: balanceDue,
        invoiceNumber: invoice.invoiceNumber,
        contactName: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
        contactEmail: invoice.contact.email,
        contactPhone: invoice.contact.phone,
        mode: "razorpay" as const,
      },
    };
  } catch (error) {
    console.error("[GENERATE_PAYMENT_LINK_ERROR]", error);
    return { success: false as const, error: "Failed to generate payment link" };
  }
}
