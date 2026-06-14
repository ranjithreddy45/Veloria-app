"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invoiceSchema, type InvoiceInput } from "@/schemas/invoice.schema";
import type { InvoiceStatus } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { calculateInvoiceTotals } from "@/lib/invoice-calc";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { postInvoiceIssued } from "@/lib/finance/receivables";
import { sendEmail } from "@/lib/email";
import { invoiceSentEmail } from "@/lib/email-templates/invoice-sent";
import { format } from "date-fns";

// ============================================================
// Helper: Generate Invoice Number (INV-YYYY-NNNN)
// ============================================================

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lastInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const lastNum = parseInt(
        lastInvoice.invoiceNumber.split("-").pop() || "0",
        10
      );
      nextNumber = lastNum + 1;
    }

    const number = `${prefix}${String(nextNumber + attempt).padStart(4, "0")}`;

    // Check uniqueness to avoid TOCTOU race condition
    const existing = await prisma.invoice.findFirst({
      where: { invoiceNumber: number },
    });

    if (!existing) return number;
  }

  // Fallback: use timestamp-based unique number
  return `INV-${Date.now()}`;
}

// formatINR is in @/lib/utils

// ============================================================
// Get Invoices (Paginated + Filtered)
// ============================================================

export async function getInvoices(params?: {
  search?: string;
  status?: InvoiceStatus;
  contactId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.contactId) {
      where.contactId = params.contactId;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              eventName: true,
            },
          },
          _count: {
            select: { payments: true, lineItems: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(invoices),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_INVOICES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch invoices" };
  }
}

// ============================================================
// Get Single Invoice
// ============================================================

export async function getInvoice(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        contact: true,
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
            eventType: true,
            date: true,
            venue: { select: { name: true } },
          },
        },
        lineItems: { orderBy: { order: "asc" } },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        installments: {
          orderBy: { order: "asc" },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    return { success: true as const, data: serialize(invoice) };
  } catch (error) {
    console.error("[GET_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch invoice" };
  }
}

// ============================================================
// Create Invoice
// ============================================================

export async function createInvoice(data: InvoiceInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = invoiceSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const invoiceData = parsed.data;

    // Single source of truth for all money math (see lib/invoice-calc.ts)
    const calc = calculateInvoiceTotals({
      lineItems: invoiceData.lineItems,
      discountPercent: invoiceData.discountPercent,
      cgstRate: invoiceData.cgstRate,
      sgstRate: invoiceData.sgstRate,
      igstRate: invoiceData.igstRate,
    });
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: "DRAFT",
        issueDate: new Date(),
        dueDate: invoiceData.dueDate,
        subtotal: calc.subtotal,
        discountPercent: calc.discountPercent || null,
        discountAmount: calc.discountAmount || null,
        cgstRate: calc.cgstRate,
        sgstRate: calc.sgstRate,
        igstRate: calc.igstRate,
        cgstAmount: calc.cgstAmount,
        sgstAmount: calc.sgstAmount,
        igstAmount: calc.igstAmount,
        totalAmount: calc.totalAmount,
        paidAmount: 0,
        balanceDue: calc.totalAmount,
        notes: invoiceData.notes || null,
        terms: invoiceData.terms || null,
        gstin: invoiceData.gstin || null,
        placeOfSupply: invoiceData.placeOfSupply || null,
        contactId: invoiceData.contactId,
        bookingId: invoiceData.bookingId || null,
        createdById: session.user.id,
        lineItems: {
          create: calc.lineItems,
        },
      },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
        lineItems: true,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Invoice",
      entityId: invoice.id,
    });

    revalidatePath("/invoices");
    return { success: true as const, data: serialize(invoice) };
  } catch (error) {
    console.error("[CREATE_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to create invoice" };
  }
}

// ============================================================
// Update Invoice
// ============================================================

export async function updateInvoice(id: string, data: InvoiceInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = invoiceSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true, paidAmount: true },
    });
    if (!existing) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft invoices can be edited",
      };
    }

    const invoiceData = parsed.data;

    // Single source of truth for all money math (see lib/invoice-calc.ts)
    const calc = calculateInvoiceTotals({
      lineItems: invoiceData.lineItems,
      discountPercent: invoiceData.discountPercent,
      cgstRate: invoiceData.cgstRate,
      sgstRate: invoiceData.sgstRate,
      igstRate: invoiceData.igstRate,
    });
    const paidAmount = Number(existing.paidAmount);
    const balanceDue = calc.totalAmount - paidAmount;

    // Delete old line items + write new totals/lines atomically, so a mid-flight
    // failure can't leave the invoice with zero line items and stale totals.
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          dueDate: invoiceData.dueDate,
          subtotal: calc.subtotal,
          discountPercent: calc.discountPercent || null,
          discountAmount: calc.discountAmount || null,
          cgstRate: calc.cgstRate,
          sgstRate: calc.sgstRate,
          igstRate: calc.igstRate,
          cgstAmount: calc.cgstAmount,
          sgstAmount: calc.sgstAmount,
          igstAmount: calc.igstAmount,
          totalAmount: calc.totalAmount,
          balanceDue,
          notes: invoiceData.notes || null,
          terms: invoiceData.terms || null,
          gstin: invoiceData.gstin || null,
          placeOfSupply: invoiceData.placeOfSupply || null,
          contactId: invoiceData.contactId,
          bookingId: invoiceData.bookingId || null,
          lineItems: {
            create: calc.lineItems,
          },
        },
      });
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Invoice",
      entityId: invoice.id,
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true as const, data: serialize(invoice) };
  } catch (error) {
    console.error("[UPDATE_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to update invoice" };
  }
}

// ============================================================
// Delete Invoice (DRAFT only)
// ============================================================

export async function deleteInvoice(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft invoices can be deleted",
      };
    }

    await prisma.invoice.delete({ where: { id } });

    revalidatePath("/invoices");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to delete invoice" };
  }
}

// ============================================================
// Send Invoice
// ============================================================

export async function sendInvoice(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Invoice not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft invoices can be sent",
      };
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: "SENT" },
      include: {
        contact: {
          select: { firstName: true, lastName: true, email: true },
        },
        lineItems: {
          orderBy: { order: "asc" },
          select: { description: true, amount: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Invoice",
      entityId: invoice.id,
    });

    // Recognise revenue in the General Ledger (best-effort: no-op if Finance
    // isn't set up yet; never blocks sending the invoice).
    postInvoiceIssued(invoice.id, session.user.id as string).catch((err) =>
      console.error("[INVOICE_GL_POST_ERROR]", err),
    );

    notify({
      userId: session.user.id as string,
      type: "INVOICE_SENT",
      title: "Invoice Sent",
      message: `Invoice ${invoice.invoiceNumber} has been sent to ${invoice.contact?.firstName} ${invoice.contact?.lastName}.`,
      actionUrl: `/invoices/${invoice.id}`,
    });

    // Fire-and-forget: Send invoice email to contact
    if (invoice.contact?.email) {
      sendEmail({
        to: invoice.contact.email,
        subject: `Invoice ${invoice.invoiceNumber}`,
        html: invoiceSentEmail({
          contactName: `${invoice.contact.firstName} ${invoice.contact.lastName}`,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: format(new Date(invoice.issueDate), "dd MMM yyyy"),
          dueDate: format(new Date(invoice.dueDate), "dd MMM yyyy"),
          totalAmount: formatINR(invoice.totalAmount),
          lineItems: invoice.lineItems.map((item) => ({
            description: item.description,
            amount: formatINR(item.amount),
          })),
        }),
      }).catch((err) => console.error("[INVOICE_EMAIL_ERROR]", err));
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true as const, data: serialize(invoice) };
  } catch (error) {
    console.error("[SEND_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to send invoice" };
  }
}

// ============================================================
// Mark Overdue (Batch)
// ============================================================

export async function markOverdue() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();

    const result = await prisma.invoice.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["SENT", "PARTIALLY_PAID"] },
      },
      data: { status: "OVERDUE" },
    });

    revalidatePath("/invoices");
    return {
      success: true as const,
      data: { count: result.count },
    };
  } catch (error) {
    console.error("[MARK_OVERDUE_ERROR]", error);
    return { success: false as const, error: "Failed to mark overdue invoices" };
  }
}

// ============================================================
// Create Installment Plan
// ============================================================

export async function createInstallmentPlan(
  invoiceId: string,
  installments: { label: string; amount: number; dueDate: Date }[]
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        totalAmount: true,
        paidAmount: true,
        status: true,
        installments: { select: { status: true } },
      },
    });

    if (!invoice) {
      return { success: false as const, error: "Invoice not found" };
    }

    // Don't (re)build a plan for an invoice that's settled or dead.
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return {
        success: false as const,
        error: `Cannot change the installment plan of a ${invoice.status.toLowerCase()} invoice`,
      };
    }

    // Don't wipe a plan that already has money against it — deleteMany +
    // recreate-as-PENDING would silently un-pay collected installments.
    const hasPaidAllocation =
      Number(invoice.paidAmount) > 0 ||
      invoice.installments.some((i) => i.status === "COMPLETED");
    if (hasPaidAllocation) {
      return {
        success: false as const,
        error: "This invoice already has payments — its installment plan can no longer be replaced",
      };
    }

    const totalInstallments = installments.reduce(
      (sum, inst) => sum + inst.amount,
      0
    );
    const totalAmount = Number(invoice.totalAmount);

    if (Math.abs(totalInstallments - totalAmount) > 0.01) {
      return {
        success: false as const,
        error: `Installments must sum to invoice total (₹${totalAmount.toLocaleString("en-IN")}). Current sum: (₹${totalInstallments.toLocaleString("en-IN")})`,
      };
    }

    // Idempotent-safe: delete + recreate in one transaction so a mid-failure
    // can't leave the invoice with a half-built plan.
    await prisma.$transaction([
      prisma.installment.deleteMany({ where: { invoiceId } }),
      prisma.installment.createMany({
        data: installments.map((inst, index) => ({
          invoiceId,
          label: inst.label,
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
          status: "PENDING",
          order: index,
        })),
      }),
    ]);

    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true as const, data: { count: installments.length } };
  } catch (error) {
    console.error("[CREATE_INSTALLMENT_PLAN_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to create installment plan",
    };
  }
}

// ============================================================
// Get Invoice Stats
// ============================================================

export async function getInvoiceStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [outstandingResult, overdueResult, collectedResult] =
      await Promise.all([
        // Total outstanding (balance due on non-paid, non-cancelled invoices)
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: {
            status: { notIn: ["PAID", "CANCELLED", "REFUNDED", "DRAFT"] },
          },
        }),
        // Overdue amount
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: { status: "OVERDUE" },
        }),
        // Collected this month
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: "COMPLETED",
            paidAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ]);

    return {
      success: true as const,
      data: {
        totalOutstanding: Number(outstandingResult._sum.balanceDue ?? 0),
        overdueAmount: Number(overdueResult._sum.balanceDue ?? 0),
        collectedThisMonth: Number(collectedResult._sum.amount ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_INVOICE_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch invoice stats" };
  }
}

// ============================================================
// Get Contacts (for invoice form)
// ============================================================

export async function getContacts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
      },
      orderBy: { firstName: "asc" },
    });

    return { success: true as const, data: serialize(contacts) };
  } catch (error) {
    console.error("[GET_CONTACTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contacts" };
  }
}

// ============================================================
// Get Bookings (for invoice form - optionally filtered by contact)
// ============================================================

export async function getBookingsForInvoice(contactId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: { notIn: ["CANCELLED"] },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        date: true,
        totalAmount: true,
      },
      orderBy: { date: "desc" },
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_BOOKINGS_FOR_INVOICE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}
