"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { quoteSchema, type QuoteInput } from "@/schemas/quote.schema";
import type { QuoteStatus } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { quoteSentEmail } from "@/lib/email-templates/quote-sent";
import {
  getEntityApprovalState,
  requestApprovalIfNeeded,
} from "@/lib/approval-engine";
import { format } from "date-fns";

// ============================================================
// Helper: Generate Quote Number (QT-YYYY-NNNN)
// ============================================================

async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;

  const lastQuote = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  let nextNumber = 1;
  if (lastQuote) {
    const lastNum = parseInt(
      lastQuote.quoteNumber.split("-").pop() || "0",
      10
    );
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ============================================================
// Helper: Generate Invoice Number (INV-YYYY-NNNN)
// ============================================================

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

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

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ============================================================
// Get Quotes (Paginated + Filtered)
// ============================================================

export async function getQuotes(params?: {
  search?: string;
  status?: QuoteStatus;
  contactId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
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
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
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

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
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
          lead: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: { lineItems: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.quote.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(quotes),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_QUOTES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch quotes" };
  }
}

// ============================================================
// Get Single Quote
// ============================================================

export async function getQuote(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        contact: true,
        lead: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
          },
        },
        lineItems: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, email: true } },
        convertedInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
      },
    });

    if (!quote) {
      return { success: false as const, error: "Quote not found" };
    }

    return { success: true as const, data: serialize(quote) };
  } catch (error) {
    console.error("[GET_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch quote" };
  }
}

// ============================================================
// Create Quote
// ============================================================

export async function createQuote(data: QuoteInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = quoteSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const quoteData = parsed.data;

    // Calculate subtotal from line items
    let subtotal = 0;
    const lineItemsWithAmount = quoteData.lineItems.map((item, index) => {
      const amount = item.quantity * item.unitPrice;
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount,
        category: item.category || null,
        order: index,
      };
    });

    // Calculate discount
    const discountPercent = quoteData.discountPercent ?? 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    const taxRate = quoteData.taxRate ?? 18;
    const taxAmount = (afterDiscount * taxRate) / 100;
    const totalAmount = afterDiscount + taxAmount;

    const quoteNumber = await generateQuoteNumber();

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        title: quoteData.title,
        status: "DRAFT",
        validUntil: quoteData.validUntil,
        subtotal,
        discountPercent: discountPercent || null,
        discountAmount: discountAmount || null,
        taxRate,
        taxAmount,
        totalAmount,
        notes: quoteData.notes || null,
        terms: quoteData.terms || null,
        coverLetter: quoteData.coverLetter || null,
        contactId: quoteData.contactId,
        leadId: quoteData.leadId || null,
        packageId: quoteData.packageId || null,
        createdById: session.user.id,
        lineItems: {
          create: lineItemsWithAmount,
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
      entityType: "Quote",
      entityId: quote.id,
    });

    revalidatePath("/quotes");
    return { success: true as const, data: serialize(quote) };
  } catch (error) {
    console.error("[CREATE_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to create quote" };
  }
}

// ============================================================
// Update Quote
// ============================================================

export async function updateQuote(id: string, data: QuoteInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = quoteSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      return { success: false as const, error: "Quote not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft quotes can be edited",
      };
    }

    const quoteData = parsed.data;

    // Recalculate subtotal
    let subtotal = 0;
    const lineItemsWithAmount = quoteData.lineItems.map((item, index) => {
      const amount = item.quantity * item.unitPrice;
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount,
        category: item.category || null,
        order: index,
      };
    });

    const discountPercent = quoteData.discountPercent ?? 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;

    const taxRate = quoteData.taxRate ?? 18;
    const taxAmount = (afterDiscount * taxRate) / 100;
    const totalAmount = afterDiscount + taxAmount;

    // Delete old line items and create new ones
    await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        title: quoteData.title,
        validUntil: quoteData.validUntil,
        subtotal,
        discountPercent: discountPercent || null,
        discountAmount: discountAmount || null,
        taxRate,
        taxAmount,
        totalAmount,
        notes: quoteData.notes || null,
        terms: quoteData.terms || null,
        coverLetter: quoteData.coverLetter || null,
        contactId: quoteData.contactId,
        leadId: quoteData.leadId || null,
        packageId: quoteData.packageId || null,
        lineItems: {
          create: lineItemsWithAmount,
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Quote",
      entityId: quote.id,
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    return { success: true as const, data: serialize(quote) };
  } catch (error) {
    console.error("[UPDATE_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to update quote" };
  }
}

// ============================================================
// Delete Quote (DRAFT only)
// ============================================================

export async function deleteQuote(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Quote not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft quotes can be deleted",
      };
    }

    await prisma.quote.delete({ where: { id } });

    revalidatePath("/quotes");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to delete quote" };
  }
}

// ============================================================
// Send Quote
// ============================================================

export async function sendQuote(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return { success: false as const, error: "Quote not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft quotes can be sent",
      };
    }

    // ---- Approval gate ------------------------------------------------
    // If an active approval rule matches this quote (e.g. discount over a
    // threshold), it must be approved before it can be sent to the customer.
    const approval = await getEntityApprovalState("QUOTE", id);
    if (approval.status === "pending") {
      return {
        success: false as const,
        error:
          "This quote is awaiting internal approval. It can be sent once approved.",
      };
    }
    if (approval.status === "rejected") {
      return {
        success: false as const,
        error:
          "This quote's approval was rejected. Edit the quote and resubmit before sending.",
      };
    }
    if (approval.status === "none") {
      // Not yet evaluated — check the rules now.
      const result = await requestApprovalIfNeeded(
        "QUOTE",
        id,
        session.user.id as string
      );
      if (result.status === "pending") {
        return {
          success: false as const,
          error:
            "This quote requires approval before it can be sent. An approval request has been raised and the approver has been notified.",
        };
      }
    }
    // status === "approved" (or no rule matched) falls through and sends.

    const quote = await prisma.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
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
      entityType: "Quote",
      entityId: quote.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Quote Sent",
      message: `Quote ${quote.quoteNumber} has been sent to ${quote.contact?.firstName} ${quote.contact?.lastName}.`,
      actionUrl: `/quotes/${quote.id}`,
    });

    // Fire-and-forget: Send quote email to contact
    if (quote.contact?.email) {
      sendEmail({
        to: quote.contact.email,
        subject: `Quotation ${quote.quoteNumber}`,
        html: quoteSentEmail({
          contactName: `${quote.contact.firstName} ${quote.contact.lastName}`,
          quoteNumber: quote.quoteNumber,
          quoteTitle: quote.title,
          validUntil: format(new Date(quote.validUntil), "dd MMM yyyy"),
          totalAmount: formatINR(quote.totalAmount),
          lineItems: quote.lineItems.map((item) => ({
            description: item.description,
            amount: formatINR(item.amount),
          })),
          coverLetter: quote.coverLetter,
        }),
      }).catch((err) => console.error("[QUOTE_EMAIL_ERROR]", err));
    }

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    return { success: true as const, data: serialize(quote) };
  } catch (error) {
    console.error("[SEND_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to send quote" };
  }
}

// ============================================================
// Convert Quote to Invoice
// ============================================================

export async function convertToInvoice(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { order: "asc" } },
        contact: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!quote) {
      return { success: false as const, error: "Quote not found" };
    }

    if (quote.status === "CONVERTED") {
      return {
        success: false as const,
        error: "Quote has already been converted to an invoice",
      };
    }

    if (quote.status === "REJECTED" || quote.status === "EXPIRED") {
      return {
        success: false as const,
        error: `Cannot convert a ${quote.status.toLowerCase()} quote`,
      };
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Use quote's taxRate to calculate GST amounts (split into CGST + SGST)
    const taxRate = Number(quote.taxRate);
    const halfRate = taxRate / 2;

    const subtotal = Number(quote.subtotal);
    const discountPercent = Number(quote.discountPercent ?? 0);
    const discountAmount = Number(quote.discountAmount ?? 0);
    const afterDiscount = subtotal - discountAmount;

    const cgstRate = halfRate;
    const sgstRate = halfRate;
    const cgstAmount = (afterDiscount * cgstRate) / 100;
    const sgstAmount = (afterDiscount * sgstRate) / 100;
    const totalAmount = afterDiscount + cgstAmount + sgstAmount;

    // Create invoice line items from quote line items
    const invoiceLineItems = quote.lineItems.map((item, index) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
      order: index,
    }));

    // Create the invoice and update the quote in a transaction
    // Interactive transaction so the quote's back-link is set atomically
    // with the invoice creation (no dangling convertedInvoiceId on failure).
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          status: "DRAFT",
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          subtotal,
          discountPercent: discountPercent || null,
          discountAmount: discountAmount || null,
          cgstRate,
          sgstRate,
          igstRate: 0,
          cgstAmount,
          sgstAmount,
          igstAmount: 0,
          totalAmount,
          paidAmount: 0,
          balanceDue: totalAmount,
          notes: quote.notes,
          terms: quote.terms,
          contactId: quote.contactId,
          createdById: session.user.id,
          lineItems: {
            create: invoiceLineItems,
          },
        },
      });
      await tx.quote.update({
        where: { id },
        data: { status: "CONVERTED", convertedInvoiceId: created.id },
      });
      return created;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Quote",
      entityId: id,
      changes: { convertedToInvoice: invoice.invoiceNumber },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Invoice",
      entityId: invoice.id,
      changes: { convertedFromQuote: quote.quoteNumber },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Quote Converted",
      message: `Quote ${quote.quoteNumber} has been converted to Invoice ${invoice.invoiceNumber}.`,
      actionUrl: `/invoices/${invoice.id}`,
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/invoices");
    return {
      success: true as const,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    };
  } catch (error) {
    console.error("[CONVERT_TO_INVOICE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to convert quote to invoice",
    };
  }
}

// ============================================================
// Get Contacts (for quote form)
// ============================================================

export async function getContacts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { isActive: true, deletedAt: null },
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
// Get Leads (for quote form)
// ============================================================

export async function getLeadsForQuote() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ["LOST"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        contactId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(leads) };
  } catch (error) {
    console.error("[GET_LEADS_FOR_QUOTE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch leads" };
  }
}
