"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";

// ============================================================
// Export Actions — Fetch ALL data (no pagination) for CSV export
// ============================================================

export async function exportContacts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        city: true,
        state: true,
        type: true,
        createdAt: true,
      },
    });

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company",
      "City",
      "State",
      "Type",
      "Created At",
    ];

    const rows = contacts.map((c) => [
      c.firstName,
      c.lastName,
      c.email || "",
      c.phone || "",
      c.company || "",
      c.city || "",
      c.state || "",
      c.type || "",
      c.createdAt.toISOString().split("T")[0],
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_CONTACTS_ERROR]", error);
    return { success: false as const, error: "Failed to export contacts" };
  }
}

export async function exportLeads() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const leads = await prisma.lead.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
    });

    const headers = [
      "Title",
      "Contact",
      "Status",
      "Source",
      "Event Type",
      "Est. Value",
      "Assigned To",
      "Created At",
    ];

    const rows = leads.map((l) => [
      l.title,
      `${l.contact.firstName} ${l.contact.lastName}`,
      l.status,
      l.source,
      l.eventType || "",
      l.estimatedValue ? Number(l.estimatedValue) : "",
      l.assignedTo?.name || "",
      l.createdAt.toISOString().split("T")[0],
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_LEADS_ERROR]", error);
    return { success: false as const, error: "Failed to export leads" };
  }
}

export async function exportBookings() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bookings = await prisma.booking.findMany({
      orderBy: { date: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        venue: { select: { name: true } },
      },
    });

    const headers = [
      "Booking #",
      "Event Name",
      "Event Type",
      "Status",
      "Date",
      "Time Slot",
      "Venue",
      "Contact",
      "Guests",
      "Total Amount",
    ];

    const rows = bookings.map((b) => [
      b.bookingNumber,
      b.eventName,
      b.eventType,
      b.status,
      b.date.toISOString().split("T")[0],
      b.timeSlot,
      b.venue.name,
      `${b.contact.firstName} ${b.contact.lastName}`,
      b.guestCount,
      Number(b.totalAmount),
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to export bookings" };
  }
}

export async function exportInvoices() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const invoices = await prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const headers = [
      "Invoice #",
      "Contact",
      "Status",
      "Issue Date",
      "Due Date",
      "Subtotal",
      "Tax",
      "Total",
      "Paid",
      "Balance Due",
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      `${inv.contact.firstName} ${inv.contact.lastName}`,
      inv.status,
      inv.issueDate.toISOString().split("T")[0],
      inv.dueDate.toISOString().split("T")[0],
      Number(inv.subtotal),
      Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount),
      Number(inv.totalAmount),
      Number(inv.paidAmount),
      Number(inv.balanceDue),
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_INVOICES_ERROR]", error);
    return { success: false as const, error: "Failed to export invoices" };
  }
}

export async function exportQuotes() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const headers = [
      "Quote #",
      "Title",
      "Contact",
      "Status",
      "Valid Until",
      "Subtotal",
      "Tax",
      "Total",
      "Created At",
    ];

    const rows = quotes.map((q) => [
      q.quoteNumber,
      q.title,
      `${q.contact.firstName} ${q.contact.lastName}`,
      q.status,
      q.validUntil.toISOString().split("T")[0],
      Number(q.subtotal),
      Number(q.taxAmount),
      Number(q.totalAmount),
      q.createdAt.toISOString().split("T")[0],
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_QUOTES_ERROR]", error);
    return { success: false as const, error: "Failed to export quotes" };
  }
}

export async function exportVendors() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const vendors = await prisma.vendor.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      take: 10000,
    });

    const headers = [
      "Name",
      "Category",
      "Status",
      "Email",
      "Phone",
      "Company",
      "GSTIN",
      "Rating",
      "Total Bookings",
    ];

    const rows = vendors.map((v) => [
      v.name,
      v.category,
      v.status,
      v.email || "",
      v.phone || "",
      v.company || "",
      v.gstin || "",
      v.rating,
      v.totalBookings,
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_VENDORS_ERROR]", error);
    return { success: false as const, error: "Failed to export vendors" };
  }
}

export async function exportPayments() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "payments:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const headers = [
      "Receipt #",
      "Invoice #",
      "Contact",
      "Amount",
      "Method",
      "Status",
      "Transaction ID",
      "Paid At",
    ];

    const rows = payments.map((p) => [
      p.receiptNumber || "",
      p.invoice.invoiceNumber,
      `${p.invoice.contact.firstName} ${p.invoice.contact.lastName}`,
      Number(p.amount),
      p.method,
      p.status,
      p.transactionId || "",
      p.paidAt ? p.paidAt.toISOString().split("T")[0] : "",
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_PAYMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to export payments" };
  }
}
