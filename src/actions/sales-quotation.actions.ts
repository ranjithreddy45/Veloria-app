"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/email";
import { hasPermission } from "@/lib/permissions";
import {
  computeQuotation,
  validateQuotationInput,
  type QuotationInput,
} from "@/lib/sales/quotation-calc";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string; code?: number };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Customer + context metadata captured alongside the calculator inputs.
export interface QuotationMeta {
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  occasion?: string;
  eventDate?: string | Date | null;
  timeSlot?: string;
  notes?: string;
  leadId?: string | null;
  contactId?: string | null;
  venueId?: string | null;
}

// Denormalised headline figures derived from the engine — kept in sync on
// every create/update so list views and sorting never need to recompute.
function headline(input: QuotationInput, meta: QuotationMeta) {
  const out = computeQuotation(input);
  return {
    clientName: meta.clientName?.trim() || null,
    clientPhone: meta.clientPhone?.trim() || null,
    clientEmail: meta.clientEmail?.trim() || null,
    occasion: meta.occasion?.trim() || null,
    eventDate: meta.eventDate ? new Date(meta.eventDate) : null,
    timeSlot: meta.timeSlot?.trim() || null,
    guestCount: Math.max(0, Math.floor(input.guestCount || 0)),
    subtotal: new Prisma.Decimal(out.subtotal),
    discountPct: new Prisma.Decimal(out.discountPct),
    taxAmount: new Prisma.Decimal(out.tax),
    grandTotal: new Prisma.Decimal(out.grandTotal),
    notes: meta.notes?.trim() || null,
  };
}

async function nextQuoteNumber(): Promise<string> {
  const count = await prisma.salesQuotation.count();
  const seq = String(count + 1).padStart(5, "0");
  return `VG-Q-${seq}`;
}

// ------------------------------------------------------------
// List / get
// ------------------------------------------------------------
export async function getSalesQuotations(filter?: {
  leadId?: string;
  status?: string;
}): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:read")) return { success: false, error: "Unauthorized" };
  const rows = await prisma.salesQuotation.findMany({
    where: {
      ...(filter?.leadId ? { leadId: filter.leadId } : {}),
      ...(filter?.status ? { status: filter.status as never } : {}),
    },
    include: {
      createdBy: { select: { name: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lead: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { success: true, data: serialize(rows) as unknown[] };
}

export async function getSalesQuotation(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:read")) return { success: false, error: "Unauthorized" };
  const row = await prisma.salesQuotation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      sentBy: { select: { name: true } },
      lead: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      venue: { select: { id: true, name: true } },
      transitions: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!row) return { success: false, error: "Quotation not found" };
  return { success: true, data: serialize(row) };
}

// ------------------------------------------------------------
// Create draft
// ------------------------------------------------------------
export async function createSalesQuotation(
  input: QuotationInput,
  meta: QuotationMeta = {}
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:create")) return { success: false, error: "Unauthorized" };

  const errs = validateQuotationInput(input);
  if (errs.length) return { success: false, error: errs.join(" ") };

  const quoteNumber = await nextQuoteNumber();
  const row = await prisma.salesQuotation.create({
    data: {
      quoteNumber,
      status: "DRAFT",
      inputsJson: input as unknown as Prisma.InputJsonValue,
      leadId: meta.leadId || null,
      contactId: meta.contactId || null,
      venueId: meta.venueId || null,
      createdById: user.id,
      ...headline(input, meta),
    },
    select: { id: true },
  });
  await prisma.salesQuotationTransition.create({
    data: { quotationId: row.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `${quoteNumber} created` },
  });
  revalidatePath("/quotations");
  if (meta.leadId) revalidatePath(`/leads/${meta.leadId}`);
  return { success: true, data: { id: row.id } };
}

// ------------------------------------------------------------
// Edit draft (DRAFT only)
// ------------------------------------------------------------
export async function updateSalesQuotation(
  id: string,
  input: QuotationInput,
  meta: QuotationMeta = {}
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:update")) return { success: false, error: "Unauthorized" };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "DRAFT")
    return { success: false, error: "Only a draft quotation can be edited. Create a new version instead.", code: 409 };

  const errs = validateQuotationInput(input);
  if (errs.length) return { success: false, error: errs.join(" ") };

  await prisma.salesQuotation.update({
    where: { id },
    data: {
      inputsJson: input as unknown as Prisma.InputJsonValue,
      leadId: meta.leadId ?? row.leadId,
      contactId: meta.contactId ?? row.contactId,
      venueId: meta.venueId ?? row.venueId,
      ...headline(input, {
        clientName: meta.clientName ?? row.clientName ?? undefined,
        clientPhone: meta.clientPhone ?? row.clientPhone ?? undefined,
        clientEmail: meta.clientEmail ?? row.clientEmail ?? undefined,
        occasion: meta.occasion ?? row.occasion ?? undefined,
        eventDate: meta.eventDate ?? row.eventDate,
        timeSlot: meta.timeSlot ?? row.timeSlot ?? undefined,
        notes: meta.notes ?? row.notes ?? undefined,
      }),
    },
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Submit for approval (DRAFT -> PENDING_APPROVAL)
// ------------------------------------------------------------
export async function submitSalesQuotation(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:create")) return { success: false, error: "Unauthorized" };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "DRAFT") return { success: false, error: `Cannot submit from ${row.status}.`, code: 409 };

  const errs = validateQuotationInput(row.inputsJson as unknown as QuotationInput);
  if (errs.length) return { success: false, error: errs.join(" ") };

  await prisma.$transaction([
    prisma.salesQuotation.update({
      where: { id },
      data: { status: "PENDING_APPROVAL", submittedById: user.id, submittedAt: new Date(), rejectedReason: null },
    }),
    prisma.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL", actorId: user.id },
    }),
  ]);

  // Notify approvers (anyone with quotes:approve — typically sales manager/head + admins).
  const candidates = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });
  for (const c of candidates) {
    if (can(c.role, "quotes:approve")) {
      notify({
        userId: c.id,
        type: "SYSTEM",
        title: "Quotation awaiting approval",
        message: `Quotation ${row.quoteNumber} (₹${row.grandTotal}) needs your approval.`,
        actionUrl: `/quotations/${id}`,
      });
    }
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { status: "PENDING_APPROVAL" } };
}

// ------------------------------------------------------------
// Approve (PENDING_APPROVAL -> APPROVED) — freezes the snapshot.
// ------------------------------------------------------------
export async function approveSalesQuotation(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:approve"))
    return { success: false, error: "Only a sales manager / head can approve quotations." };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "PENDING_APPROVAL")
    return { success: false, error: `Cannot approve from ${row.status}.`, code: 409 };

  // A rep cannot approve their own quote unless they're an admin.
  if (row.submittedById === user.id && !isAdmin(user.role)) {
    return { success: false, error: "You submitted this quotation — a different approver must approve it." };
  }

  // Freeze the snapshot: recompute the full result server-side from stored inputs.
  const input = row.inputsJson as unknown as QuotationInput;
  const out = computeQuotation(input);

  await prisma.$transaction([
    prisma.salesQuotation.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        outputsJson: out as unknown as Prisma.InputJsonValue,
        pdfUrl: `/api/quotations/${id}/pdf`,
      },
    }),
    prisma.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED", actorId: user.id },
    }),
  ]);

  if (row.submittedById) {
    notify({
      userId: row.submittedById,
      type: "SYSTEM",
      title: "Quotation approved",
      message: `Quotation ${row.quoteNumber} was approved and is ready to send to the customer.`,
      actionUrl: `/quotations/${id}`,
    });
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { status: "APPROVED" } };
}

// ------------------------------------------------------------
// Reject (PENDING_APPROVAL -> DRAFT) with a required comment.
// ------------------------------------------------------------
export async function rejectSalesQuotation(id: string, reason: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:approve"))
    return { success: false, error: "Only a sales manager / head can reject quotations." };
  if (!reason?.trim()) return { success: false, error: "A rejection comment is required." };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "PENDING_APPROVAL")
    return { success: false, error: `Cannot reject from ${row.status}.`, code: 409 };

  await prisma.$transaction([
    prisma.salesQuotation.update({ where: { id }, data: { status: "DRAFT", rejectedReason: reason.trim() } }),
    prisma.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "PENDING_APPROVAL", toStatus: "DRAFT", actorId: user.id, note: reason.trim() },
    }),
  ]);
  if (row.submittedById) {
    notify({
      userId: row.submittedById,
      type: "SYSTEM",
      title: "Quotation returned for changes",
      message: `Your quotation ${row.quoteNumber} was returned: ${reason.trim()}`,
      actionUrl: `/quotations/${id}`,
    });
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { status: "DRAFT" } };
}

// ------------------------------------------------------------
// Send (APPROVED -> SENT). Renders from the frozen snapshot.
// ------------------------------------------------------------
export async function sendSalesQuotation(
  id: string,
  opts: { method: "EMAIL" | "WHATSAPP" | "MANUAL_DOWNLOAD"; to?: string; subject?: string; body?: string }
): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:send")) return { success: false, error: "Unauthorized" };

  const row = await prisma.salesQuotation.findUnique({
    where: { id },
    include: { contact: { select: { email: true, phone: true, firstName: true } } },
  });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "APPROVED" && row.status !== "SENT")
    return { success: false, error: "A quotation can only be sent after it is approved.", code: 409 };

  const pdfUrl = row.pdfUrl ?? `/api/quotations/${id}/pdf`;
  const email = opts.to?.trim() || row.clientEmail || row.contact?.email || "";
  if (opts.method === "EMAIL" && !email)
    return { success: false, error: "No customer email on file — enter a recipient." };

  await prisma.$transaction([
    prisma.salesQuotation.update({
      where: { id },
      data: {
        status: "SENT",
        sendMethod: opts.method,
        sentChannel: opts.method.toLowerCase(),
        sentTo: opts.method === "EMAIL" ? email : opts.method === "WHATSAPP" ? row.clientPhone || row.contact?.phone || null : null,
        sentById: user.id,
        sentAt: new Date(),
      },
    }),
    prisma.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: row.status, toStatus: "SENT", actorId: user.id, note: opts.method },
    }),
  ]);

  if (opts.method === "EMAIL") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
    const subject = opts.subject?.trim() || `Your Veloria Grand Quotation — ${row.quoteNumber}`;
    const body =
      opts.body?.trim() ||
      `Dear ${row.clientName || row.contact?.firstName || "Guest"},<br/><br/>Thank you for considering Veloria Grand. Please find your event quotation below.<br/><br/><a href="${appUrl}${pdfUrl}">View / download your quotation (PDF)</a><br/><br/>Grand total: ₹${row.grandTotal}<br/><br/>Warm regards,<br/>Veloria Grand`;
    sendEmail({ to: email, subject, html: body }).catch((e) => console.error("[QUOTATION_EMAIL_ERROR]", e));
  }

  logActivity({
    userId: user.id,
    action: "QUOTATION_SENT",
    entityType: "SalesQuotation",
    entityId: id,
    changes: { method: opts.method },
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { status: "SENT" } };
}

// ------------------------------------------------------------
// New version: clone an APPROVED/SENT quotation into a fresh DRAFT.
// ------------------------------------------------------------
export async function newSalesQuotationVersion(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:create")) return { success: false, error: "Unauthorized" };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "APPROVED" && row.status !== "SENT")
    return { success: false, error: "Only an approved or sent quotation can be versioned." };

  const quoteNumber = await nextQuoteNumber();
  const clone = await prisma.salesQuotation.create({
    data: {
      quoteNumber,
      version: row.version + 1,
      status: "DRAFT",
      inputsJson: row.inputsJson as Prisma.InputJsonValue,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      clientEmail: row.clientEmail,
      occasion: row.occasion,
      eventDate: row.eventDate,
      timeSlot: row.timeSlot,
      guestCount: row.guestCount,
      subtotal: row.subtotal,
      discountPct: row.discountPct,
      taxAmount: row.taxAmount,
      grandTotal: row.grandTotal,
      notes: row.notes,
      leadId: row.leadId,
      contactId: row.contactId,
      venueId: row.venueId,
      createdById: user.id,
    },
    select: { id: true },
  });
  await prisma.salesQuotationTransition.create({
    data: { quotationId: clone.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `${quoteNumber} from ${row.quoteNumber}` },
  });
  revalidatePath("/quotations");
  return { success: true, data: { id: clone.id } };
}

// ------------------------------------------------------------
// Delete a draft (housekeeping).
// ------------------------------------------------------------
export async function deleteSalesQuotation(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:delete")) return { success: false, error: "Unauthorized" };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "DRAFT" && !isAdmin(user.role))
    return { success: false, error: "Only a draft quotation can be deleted." };
  await prisma.salesQuotationTransition.deleteMany({ where: { quotationId: id } });
  await prisma.salesQuotation.delete({ where: { id } });
  revalidatePath("/quotations");
  return { success: true, data: { id } };
}
