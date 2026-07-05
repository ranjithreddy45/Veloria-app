"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { createPortalInvite, acceptPortalInvite } from "@/lib/portal-invite";
import type { PaymentMethod } from "@prisma/client";

// ============================================================
// Helper: Get contact IDs linked to this user's VERIFIED identity.
// Delegates to the single guarded resolver (C9): unverified users get [].
// ============================================================

async function getClientContactIds(userId: string): Promise<string[]> {
  return getVerifiedContactIds(userId);
}

// ============================================================
// Portal Dashboard
// ============================================================

export async function getPortalDashboard(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return {
      upcomingBookings: 0,
      pendingInvoices: 0,
      totalPaid: 0,
      nextEvent: null,
      recentBookings: [],
    };
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) {
    return {
      upcomingBookings: 0,
      pendingInvoices: 0,
      totalPaid: 0,
      nextEvent: null,
      recentBookings: [],
    };
  }

  const now = new Date();

  // Upcoming bookings (date >= today and not cancelled/completed)
  const upcomingBookings = await prisma.booking.count({
    where: {
      contactId: { in: contactIds },
      date: { gte: now },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
  });

  // Pending invoices (not PAID, not CANCELLED, not DRAFT)
  const pendingInvoices = await prisma.invoice.count({
    where: {
      contactId: { in: contactIds },
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
  });

  // Total paid amount
  const paidResult = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: "COMPLETED",
      invoice: { contactId: { in: contactIds } },
    },
  });
  const totalPaid = Number(paidResult._sum.amount || 0);

  // Next event
  const nextEvent = await prisma.booking.findFirst({
    where: {
      contactId: { in: contactIds },
      date: { gte: now },
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { date: "asc" },
    include: {
      venue: { select: { name: true } },
    },
  });

  // Recent bookings (last 5)
  const recentBookings = await prisma.booking.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { date: "desc" },
    take: 5,
    include: {
      venue: { select: { name: true } },
    },
  });

  return serialize({
    upcomingBookings,
    pendingInvoices,
    totalPaid,
    nextEvent: nextEvent
      ? {
          id: nextEvent.id,
          eventName: nextEvent.eventName,
          eventType: nextEvent.eventType,
          date: nextEvent.date,
          timeSlot: nextEvent.timeSlot,
          venueName: nextEvent.venue.name,
          guestCount: nextEvent.guestCount,
          status: nextEvent.status,
        }
      : null,
    recentBookings: recentBookings.map((b) => ({
      id: b.id,
      eventName: b.eventName,
      date: b.date,
      venueName: b.venue.name,
      status: b.status,
      guestCount: b.guestCount,
    })),
  });
}

// ============================================================
// Portal Bookings List
// ============================================================

export async function getPortalBookings(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return [];
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { date: "desc" },
    include: {
      venue: { select: { name: true, id: true } },
    },
  });

  return serialize(bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    eventName: b.eventName,
    eventType: b.eventType,
    date: b.date,
    timeSlot: b.timeSlot,
    venueName: b.venue.name,
    guestCount: b.guestCount,
    status: b.status,
    totalAmount: Number(b.totalAmount),
    specialRequests: b.specialRequests,
  })));
}

// ============================================================
// Portal Single Booking
// ============================================================

export async function getPortalBooking(userId: string, bookingId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return null;
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) return null;

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      contactId: { in: contactIds },
    },
    include: {
      venue: true,
      contact: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
          status: true,
          dueDate: true,
        },
        orderBy: { issueDate: "desc" },
      },
      createdBy: {
        select: { name: true, phone: true, email: true },
      },
    },
  });

  if (!booking) return null;

  return serialize({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    eventName: booking.eventName,
    eventType: booking.eventType,
    date: booking.date,
    timeSlot: booking.timeSlot,
    startTime: booking.startTime,
    endTime: booking.endTime,
    guestCount: booking.guestCount,
    specialRequests: booking.specialRequests,
    status: booking.status,
    totalAmount: Number(booking.totalAmount),
    venue: {
      id: booking.venue.id,
      name: booking.venue.name,
      description: booking.venue.description,
      capacity: booking.venue.capacity,
      amenities: booking.venue.amenities,
    },
    contact: booking.contact,
    invoices: booking.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      balanceDue: Number(inv.balanceDue),
      status: inv.status,
      dueDate: inv.dueDate,
    })),
    coordinator: booking.createdBy
      ? {
          name: booking.createdBy.name,
          phone: booking.createdBy.phone,
          email: booking.createdBy.email,
        }
      : null,
    createdAt: booking.createdAt,
  });
}

// ============================================================
// Portal Invoices List
// ============================================================

export async function getPortalInvoices(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return [];
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) return [];

  const invoices = await prisma.invoice.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { issueDate: "desc" },
    include: {
      booking: {
        select: { eventName: true, bookingNumber: true },
      },
    },
  });

  return serialize(invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    balanceDue: Number(inv.balanceDue),
    eventName: inv.booking?.eventName ?? null,
    bookingNumber: inv.booking?.bookingNumber ?? null,
  })));
}

// ============================================================
// Portal Single Invoice
// ============================================================

export async function getPortalInvoice(userId: string, invoiceId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return null;
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) return null;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      contactId: { in: contactIds },
    },
    include: {
      contact: {
        select: {
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
      },
      booking: {
        select: { eventName: true, bookingNumber: true, date: true },
      },
      lineItems: { orderBy: { order: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      installments: { orderBy: { order: "asc" } },
    },
  });

  if (!invoice) return null;

  return serialize({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal),
    discountPercent: invoice.discountPercent
      ? Number(invoice.discountPercent)
      : null,
    discountAmount: invoice.discountAmount
      ? Number(invoice.discountAmount)
      : null,
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    igstRate: Number(invoice.igstRate),
    cgstAmount: Number(invoice.cgstAmount),
    sgstAmount: Number(invoice.sgstAmount),
    igstAmount: Number(invoice.igstAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    notes: invoice.notes,
    terms: invoice.terms,
    gstin: invoice.gstin,
    placeOfSupply: invoice.placeOfSupply,
    sacCode: invoice.sacCode,
    contact: invoice.contact,
    booking: invoice.booking
      ? {
          eventName: invoice.booking.eventName,
          bookingNumber: invoice.booking.bookingNumber,
          date: invoice.booking.date,
        }
      : null,
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
      sacCode: li.sacCode,
    })),
    payments: invoice.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      method: p.method,
      transactionId: p.transactionId,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
    installments: invoice.installments.map((inst) => ({
      id: inst.id,
      label: inst.label,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      paidAt: inst.paidAt,
    })),
  });
}

// ============================================================
// Portal Payments List
// ============================================================

export async function getPortalPayments(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return [];
  }

  const contactIds = await getClientContactIds(userId);

  if (contactIds.length === 0) return [];

  const payments = await prisma.payment.findMany({
    where: {
      invoice: { contactId: { in: contactIds } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          booking: { select: { eventName: true } },
        },
      },
    },
  });

  return serialize(payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    method: p.method,
    transactionId: p.transactionId,
    receiptNumber: p.receiptNumber,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice.invoiceNumber,
    eventName: p.invoice.booking?.eventName ?? null,
  })));
}

// ============================================================
// Portal Event Progress (Aggregated — No Task Details)
// ============================================================

export async function getPortalEventProgress(userId: string, bookingId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return null;
  }

  const contactIds = await getClientContactIds(userId);
  if (contactIds.length === 0) return null;

  // Verify booking belongs to this user
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, contactId: { in: contactIds } },
    select: { id: true },
  });
  if (!booking) return null;

  // Try ExecutionPlan first
  const executionPlan = await prisma.executionPlan.findUnique({
    where: { bookingId },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            select: { status: true },
          },
        },
      },
    },
  });

  if (executionPlan) {
    const phases = executionPlan.phases.map((phase) => {
      const totalTasks = phase.tasks.length;
      const completedTasks = phase.tasks.filter((t) => t.status === "COMPLETED").length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        phaseName: phase.name,
        phaseType: phase.phase,
        totalTasks,
        completedTasks,
        progressPercent,
      };
    });

    const totalTasks = phases.reduce((sum, p) => sum + p.totalTasks, 0);
    const totalCompleted = phases.reduce((sum, p) => sum + p.completedTasks, 0);
    const overallProgress = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Vendor readiness
    const vendorStats = await prisma.bookingVendor.groupBy({
      by: ["status"],
      where: { bookingId },
      _count: true,
    });
    const vendorTotal = vendorStats.reduce((sum, v) => sum + v._count, 0);
    const vendorConfirmed = vendorStats.find((v) => v.status === "CONFIRMED")?._count || 0;

    return serialize({
      overallProgress,
      phases,
      vendorReadiness: { confirmed: vendorConfirmed, total: vendorTotal },
      hasExecutionPlan: true,
    });
  }

  // Fallback: use Task model
  const tasks = await prisma.task.findMany({
    where: { bookingId },
    select: { status: true },
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Vendor readiness
  const vendorStats = await prisma.bookingVendor.groupBy({
    by: ["status"],
    where: { bookingId },
    _count: true,
  });
  const vendorTotal = vendorStats.reduce((sum, v) => sum + v._count, 0);
  const vendorConfirmed = vendorStats.find((v) => v.status === "CONFIRMED")?._count || 0;

  return serialize({
    overallProgress,
    phases: [],
    vendorReadiness: { confirmed: vendorConfirmed, total: vendorTotal },
    hasExecutionPlan: false,
  });
}

// ============================================================
// Submit a payment proof (customer uploads a receipt/screenshot)
// Creates a PENDING payment for staff to verify; on verification the
// booking auto-confirms. Data-URL (base64) is stored so this works with
// no external file storage.
// ============================================================

export async function submitPaymentProof(
  userId: string,
  data: { invoiceId: string; amount: number; method: PaymentMethod; receiptUrl: string; notes?: string }
) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!data.receiptUrl) return { success: false as const, error: "Attach a payment screenshot or reference." };
  if (!(data.amount > 0)) return { success: false as const, error: "Enter a valid amount." };
  // Guard against oversized data-URLs (base64 of a large photo).
  if (data.receiptUrl.length > 7_000_000) {
    return { success: false as const, error: "Image too large — please upload one under ~5 MB." };
  }
  // SECURITY: a customer controls this string. Only accept a base64 image/PDF
  // data-URL — never an executable scheme (javascript:, data:text/html) that
  // could run when staff open the proof.
  if (!isSafeReceiptDataUrl(data.receiptUrl)) {
    return { success: false as const, error: "Unsupported file — upload a JPG, PNG, WEBP, GIF or PDF." };
  }

  const contactIds = await getClientContactIds(userId);
  if (contactIds.length === 0) return { success: false as const, error: "No linked account found." };

  const invoice = await prisma.invoice.findFirst({
    where: { id: data.invoiceId, contactId: { in: contactIds } },
    select: { id: true, balanceDue: true, invoiceNumber: true },
  });
  if (!invoice) return { success: false as const, error: "Invoice not found." };
  if (data.amount > Number(invoice.balanceDue) + 0.01) {
    return { success: false as const, error: "Amount exceeds the balance due." };
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
      status: "PENDING",
      notes: data.notes || "Customer-submitted payment proof",
      receiptUrl: data.receiptUrl,
      receiptUploadedAt: new Date(),
    },
    select: { id: true },
  });

  // Alert staff who can verify payments.
  const verifiers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });
  for (const v of verifiers) {
    if (hasPermission(v.role, "payments:update")) {
      notify({
        userId: v.id,
        type: "PAYMENT_RECEIVED",
        title: "Payment proof to verify",
        message: `A customer uploaded a payment proof for invoice ${invoice.invoiceNumber}. Please verify.`,
        actionUrl: `/invoices/${data.invoiceId}`,
      });
    }
  }

  revalidatePath("/portal/invoices");
  revalidatePath(`/portal/invoices/${data.invoiceId}`);
  return { success: true as const, data: { id: payment.id } };
}

// ============================================================
// H1 — Portal-scoped invoice PDF data.
// The internal /invoices/{id}/pdf route is gated to staff (CLIENT gets
// /not-authorized). This returns the same branded invoice data, but ONLY when
// the invoice belongs to the caller's verified contact — so the portal PDF page
// can render without ever touching the internal, staff-permissioned action.
// ============================================================

export async function getPortalInvoiceForPdf(userId: string, invoiceId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) return null;

  const contactIds = await getClientContactIds(userId);
  if (contactIds.length === 0) return null;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, contactId: { in: contactIds } },
    include: {
      contact: {
        select: {
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
      },
      booking: {
        select: {
          eventName: true,
          eventType: true,
          bookingNumber: true,
          date: true,
          venue: { select: { name: true } },
        },
      },
      lineItems: { orderBy: { order: "asc" } },
    },
  });

  if (!invoice) return null;

  return serialize({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal),
    discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : 0,
    discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : 0,
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    igstRate: Number(invoice.igstRate),
    cgstAmount: Number(invoice.cgstAmount),
    sgstAmount: Number(invoice.sgstAmount),
    igstAmount: Number(invoice.igstAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    notes: invoice.notes,
    terms: invoice.terms,
    gstin: invoice.gstin,
    placeOfSupply: invoice.placeOfSupply,
    sacCode: invoice.sacCode,
    contact: invoice.contact,
    booking: invoice.booking
      ? {
          eventName: invoice.booking.eventName,
          eventType: invoice.booking.eventType,
          bookingNumber: invoice.booking.bookingNumber,
          date: invoice.booking.date,
          venue: invoice.booking.venue ? { name: invoice.booking.venue.name } : null,
        }
      : null,
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
    })),
  });
}

// ============================================================
// H3 — Documents hub: the client's downloadable items in one place.
// Reuses the same verified-contact scope as everything else.
// ============================================================

export async function getPortalDocuments(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    return { verified: false as const, invoices: [], contracts: [] };
  }

  const contactIds = await getClientContactIds(userId);
  if (contactIds.length === 0) {
    // Distinguish "unverified" from "verified but empty" so the page can show
    // the right message.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    return {
      verified: !!user?.emailVerified,
      invoices: [],
      contracts: [],
    };
  }

  const [invoices, contracts] = await Promise.all([
    prisma.invoice.findMany({
      where: { contactId: { in: contactIds }, status: { not: "DRAFT" } },
      orderBy: { issueDate: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        totalAmount: true,
        balanceDue: true,
        booking: { select: { eventName: true } },
      },
    }),
    prisma.contract.findMany({
      where: { contactId: { in: contactIds }, status: { notIn: ["DRAFT"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        signedAt: true,
        sentAt: true,
        booking: { select: { eventName: true } },
      },
    }),
  ]);

  return serialize({
    verified: true as const,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      issueDate: inv.issueDate,
      totalAmount: Number(inv.totalAmount),
      balanceDue: Number(inv.balanceDue),
      eventName: inv.booking?.eventName ?? null,
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      signedAt: c.signedAt,
      sentAt: c.sentAt,
      eventName: c.booking?.eventName ?? null,
    })),
  });
}

// ============================================================
// C9 — Staff: generate a portal invite link for a contact.
// Gives staff a way to onboard a client (mark their portal identity verified)
// even though transactional email/OTP is not configured. Guarded by the same
// permission that lets staff manage contacts.
// ============================================================

export async function generatePortalInvite(contactId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!hasPermission(session.user.role, "contacts:update")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!contact) {
    return { success: false as const, error: "Contact not found" };
  }
  if (!contact.email) {
    return {
      success: false as const,
      error: "This contact has no email on file — add one before inviting.",
    };
  }

  const token = await createPortalInvite(contact.id);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/portal/activate?contactId=${contact.id}&token=${token}`;

  return {
    success: true as const,
    data: {
      url,
      contactEmail: contact.email,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
    },
  };
}

// ============================================================
// C9 — Client: accept a portal invite (marks the signed-in user verified and
// links them to the invited contact). Requires the client to be signed in as a
// user whose email matches the invited contact — so a leaked link can't verify
// a stranger's account against someone else's contact.
// ============================================================

export async function acceptPortalInviteAction(params: {
  contactId: string;
  token: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Please sign in to activate your portal." };
  }

  const [user, contact] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true },
    }),
    prisma.contact.findFirst({
      where: { id: params.contactId, deletedAt: null },
      select: { email: true },
    }),
  ]);

  if (!user?.email) {
    return { success: false as const, error: "Your account is missing an email." };
  }
  if (user.emailVerified) {
    // Already verified — nothing to do, treat as success (idempotent UX).
    return { success: true as const };
  }
  if (!contact) {
    return { success: false as const, error: "This invite link is invalid." };
  }
  // The signed-in user's email must match the invited contact's email. This is
  // the binding that prevents a leaked link from verifying a foreign account.
  if (contact.email?.toLowerCase() !== user.email.toLowerCase()) {
    return {
      success: false as const,
      error:
        "This invite was issued for a different email. Please sign in with the email we invoiced you at.",
    };
  }

  const result = await acceptPortalInvite({
    userId: session.user.id,
    contactId: params.contactId,
    token: params.token,
  });

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath("/portal");
  return { success: true as const };
}
