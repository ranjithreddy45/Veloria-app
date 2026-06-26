"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/email";
import { after } from "next/server";
import { hasPermission } from "@/lib/permissions";
import {
  computeQuotation,
  validateQuotationInput,
  type QuotationInput,
} from "@/lib/sales/quotation-calc";
import { updateLeadStatus } from "@/actions/lead.actions";
import { updateDeal } from "@/actions/pipeline.actions";
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

// Escape user-controlled values before interpolating into HTML email bodies.
function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

// Quote -> pipeline bridge. When a quote is approved/sent or its slot is
// blocked, push the quote economics into the linked lead's deal and advance
// the lead status so the funnel reflects the proposal. Best-effort: a quote
// with no lead, or a lead with no deal, must never fail the quote operation.
async function syncLeadFromQuotation(
  leadId: string | null | undefined,
  grandTotal: Prisma.Decimal | number | null | undefined
): Promise<void> {
  if (!leadId) return;
  try {
    const value = Number(grandTotal ?? 0);
    // Mirror the quote total onto the lead's deal (deal.leadId is @unique).
    const deal = await prisma.deal.findUnique({ where: { leadId }, select: { id: true } });
    if (deal && value > 0) {
      await updateDeal(deal.id, { value });
    }
    // Advance the lead to PROPOSAL_SENT (no-op if already there or further).
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    const FUNNEL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    const cur = lead ? FUNNEL_ORDER.indexOf(lead.status) : -1;
    const target = FUNNEL_ORDER.indexOf("PROPOSAL_SENT");
    if (cur >= 0 && cur < target) {
      await updateLeadStatus(leadId, "PROPOSAL_SENT" as never);
    }
  } catch (e) {
    console.error("[QUOTE_LEAD_SYNC_ERROR]", e);
  }
}

function isSerializationFailure(e: unknown): boolean {
  const code = !!e && typeof e === "object" ? (e as { code?: string }).code : undefined;
  return code === "P2034" || code === "P2002"; // write conflict / serialization / unique
}

// Allocate the next number AND create the row inside a single Serializable
// transaction so two concurrent creates can't read the same max and collide.
// The loser hits a serialization failure and retries with the next number.
// (No @unique on quoteNumber — that would make `prisma db push` destructive.)
async function createQuotationRow(
  buildData: (quoteNumber: string) => Prisma.SalesQuotationUncheckedCreateInput
): Promise<{ id: string; quoteNumber: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const last = await tx.salesQuotation.findFirst({
            where: { quoteNumber: { startsWith: "VG-Q-" } },
            orderBy: { quoteNumber: "desc" },
            select: { quoteNumber: true },
          });
          const lastSeq = last ? parseInt(last.quoteNumber.split("-").pop() || "0", 10) : 0;
          const quoteNumber = `VG-Q-${String(lastSeq + 1).padStart(5, "0")}`;
          return tx.salesQuotation.create({
            data: buildData(quoteNumber),
            select: { id: true, quoteNumber: true },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (e) {
      if (isSerializationFailure(e) && attempt < 5) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate a unique quotation number.");
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
// Pending quote approvals (for the /approvals queue).
// Quote approvals live as a SalesQuotation status (PENDING_APPROVAL) with
// transitions — NOT as generic ApprovalRequest rows — so the generic approvals
// queue can't see them. This surfaces them for anyone who can approve quotes.
// ------------------------------------------------------------
export interface PendingQuoteApproval {
  id: string;
  quoteNumber: string;
  version: number;
  clientName: string | null;
  occasion: string | null;
  eventDate: string | null;
  grandTotal: number;
  submittedAt: string | null;
  submittedByName: string | null;
  submittedById: string | null;
}

export async function getPendingQuoteApprovals(): Promise<Result<PendingQuoteApproval[]>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:approve")) {
    // Not an approver — nothing to surface (don't error; this runs alongside the generic queue).
    return { success: true, data: [] };
  }
  const rows = await prisma.salesQuotation.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { submittedBy: { select: { id: true, name: true } } },
    orderBy: { submittedAt: "desc" },
  });
  const data: PendingQuoteApproval[] = rows.map((r) => ({
    id: r.id,
    quoteNumber: r.quoteNumber,
    version: r.version,
    clientName: r.clientName,
    occasion: r.occasion,
    eventDate: r.eventDate ? r.eventDate.toISOString() : null,
    grandTotal: Number(r.grandTotal),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    submittedByName: r.submittedBy?.name ?? null,
    submittedById: r.submittedById,
  }));
  return { success: true, data };
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

  const row = await createQuotationRow((quoteNumber) => ({
    quoteNumber,
    status: "DRAFT",
    inputsJson: input as unknown as Prisma.InputJsonValue,
    leadId: meta.leadId || null,
    contactId: meta.contactId || null,
    venueId: meta.venueId || null,
    createdById: user.id,
    ...headline(input, meta),
  }));
  await prisma.salesQuotationTransition.create({
    data: { quotationId: row.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `${row.quoteNumber} created` },
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
      // `undefined` = key omitted (keep current); explicit null = clear it.
      leadId: meta.leadId !== undefined ? meta.leadId || null : row.leadId,
      contactId: meta.contactId !== undefined ? meta.contactId || null : row.contactId,
      venueId: meta.venueId !== undefined ? meta.venueId || null : row.venueId,
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

  const guarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", submittedById: user.id, submittedAt: new Date(), rejectedReason: null },
    });
    if (count === 0) return false;
    await tx.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL", actorId: user.id },
    });
    return true;
  });
  if (!guarded) return { success: false, error: `Cannot submit from ${row.status}.`, code: 409 };

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

  // Segregation of duties: nobody may approve a quotation they submitted — a
  // different approver must sign off (SCRM-007). Exception: SUPER_ADMIN is never
  // gated by the approval process and may self-approve.
  if (row.submittedById === user.id && user.role !== "SUPER_ADMIN") {
    return { success: false, error: "You submitted this quotation — a different approver must approve it." };
  }

  // Freeze the snapshot: recompute the full result server-side from stored inputs.
  const input = row.inputsJson as unknown as QuotationInput;
  const out = computeQuotation(input);

  const guarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        outputsJson: out as unknown as Prisma.InputJsonValue,
        pdfUrl: `/api/quotations/${id}/pdf`,
      },
    });
    if (count === 0) return false;
    await tx.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED", actorId: user.id },
    });
    return true;
  });
  if (!guarded) return { success: false, error: `Cannot approve from ${row.status}.`, code: 409 };

  if (row.submittedById) {
    notify({
      userId: row.submittedById,
      type: "SYSTEM",
      title: "Quotation approved",
      message: `Quotation ${row.quoteNumber} was approved and is ready to send to the customer.`,
      actionUrl: `/quotations/${id}`,
    });
  }
  // Flow quote economics into the pipeline and advance the lead (best-effort).
  await syncLeadFromQuotation(row.leadId, out.grandTotal);
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  if (row.leadId) revalidatePath(`/leads/${row.leadId}`);
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

  const guarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status: "DRAFT", rejectedReason: reason.trim() },
    });
    if (count === 0) return false;
    await tx.salesQuotationTransition.create({
      data: { quotationId: id, fromStatus: "PENDING_APPROVAL", toStatus: "DRAFT", actorId: user.id, note: reason.trim() },
    });
    return true;
  });
  if (!guarded) return { success: false, error: `Cannot reject from ${row.status}.`, code: 409 };
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
    const greetingName = escapeHtml(row.clientName || row.contact?.firstName || "Guest");
    const body =
      opts.body?.trim() ||
      `Dear ${greetingName},<br/><br/>Thank you for considering Veloria Grand. Please find your event quotation below.<br/><br/><a href="${appUrl}${pdfUrl}">View / download your quotation (PDF)</a><br/><br/>Grand total: ₹${escapeHtml(String(row.grandTotal))}<br/><br/>Warm regards,<br/>Veloria Grand`;
    // after() so the quotation email survives a serverless freeze.
    after(() => sendEmail({ to: email, subject, html: body }).catch((e) => console.error("[QUOTATION_EMAIL_ERROR]", e)));
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

  const clone = await createQuotationRow((quoteNumber) => ({
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
  }));
  await prisma.salesQuotationTransition.create({
    data: { quotationId: clone.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `${clone.quoteNumber} from ${row.quoteNumber}` },
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
  // A quotation with a blocked slot owns a booking — deleting it would orphan
  // that booking (and leave the slot held). Refuse for everyone, admins included.
  if (row.bookingId)
    return { success: false, error: "This quotation has a blocked slot — cancel the booking before deleting." };
  if (row.status !== "DRAFT" && !isAdmin(user.role))
    return { success: false, error: "Only a draft quotation can be deleted." };
  await prisma.salesQuotationTransition.deleteMany({ where: { quotationId: id } });
  await prisma.salesQuotation.delete({ where: { id } });
  revalidatePath("/quotations");
  return { success: true, data: { id } };
}
