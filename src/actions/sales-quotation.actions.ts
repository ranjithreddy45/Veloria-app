"use server";

import { auth } from "@/../auth";
import { awardVelos } from "@/lib/velos/award";
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
import { validatePackageLinesAgainstCatalog } from "@/actions/quote-packages.actions";
import { blocksApproval, resolveTaxSlab, totalRate } from "@/lib/sales/tax-slab";
import { getVenueSlabs } from "@/lib/sales/venue-tax";
import { ensureQuoteShareLink, quotationPdfShareUrl } from "@/lib/quote-radar/share-link";
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
  /** Which of the property's GST rates to use. Omitted = let the property decide. */
  taxSlabId?: string | null;
}

// ------------------------------------------------------------
// Which GST rate does this quotation carry?
//
// The property decides. One rate applies itself, a property with several needs
// someone to pick, and a property with none falls back to the planner's 5% —
// which is every quotation raised before rates existed, so nothing moves under
// a quote that was already sent.
//
// The resolved rate is written INTO the stored input, so every later recompute
// (the approval freeze, the PDF, the public view) reproduces the same number
// without having to re-resolve it against a property whose rates may since
// have changed.
// ------------------------------------------------------------
interface QuoteTaxResolution {
  /** Fraction, e.g. 0.18. Null = no rates configured, use the fallback. */
  taxRate: number | null;
  taxSlabId: string | null;
  /** Several rates and nobody has picked — must not go for approval. */
  mustAsk: boolean;
  options: { id: string; name: string; total: number }[];
}

async function resolveQuoteTax(
  venueId: string | null | undefined,
  chosenSlabId?: string | null
): Promise<QuoteTaxResolution> {
  const empty: QuoteTaxResolution = { taxRate: null, taxSlabId: null, mustAsk: false, options: [] };
  if (!venueId) return empty;
  try {
    const slabs = await getVenueSlabs(venueId);
    const res = resolveTaxSlab(slabs, chosenSlabId);
    if (res.kind === "NONE") return empty;
    if (res.kind === "MUST_ASK") {
      return {
        taxRate: null,
        taxSlabId: null,
        mustAsk: blocksApproval(res),
        options: res.options.map((o) => ({ id: o.id, name: o.name, total: totalRate(o) })),
      };
    }
    return { taxRate: totalRate(res.slab) / 100, taxSlabId: res.slab.id, mustAsk: false, options: [] };
  } catch (e) {
    // A quotation must never fail because the rate lookup did. Falling back is
    // the same behaviour as a property with no rates.
    console.error("[QUOTE_TAX_RESOLVE]", venueId, e);
    return empty;
  }
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
  // DB-authoritative min-pax + max-discount cap check on vendor-package lines.
  // The returned `lines` carry the catalog unit price / min-pax (never the
  // client's), so the stored snapshot and headline totals can't be forged.
  const { errors: pkgErrs, lines: safeLines } = await validatePackageLinesAgainstCatalog(input.packageLines, meta.venueId ?? null);
  if (pkgErrs.length) return { success: false, error: pkgErrs.join(" ") };
  const baseInput: QuotationInput = input.packageLines ? { ...input, packageLines: safeLines } : input;

  const tax = await resolveQuoteTax(meta.venueId, meta.taxSlabId);
  const safeInput: QuotationInput =
    tax.taxRate != null ? { ...baseInput, taxRate: tax.taxRate } : baseInput;

  const row = await createQuotationRow((quoteNumber) => ({
    quoteNumber,
    status: "DRAFT",
    inputsJson: safeInput as unknown as Prisma.InputJsonValue,
    leadId: meta.leadId || null,
    contactId: meta.contactId || null,
    venueId: meta.venueId || null,
    taxSlabId: tax.taxSlabId,
    createdById: user.id,
    ...headline(safeInput, meta),
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
  const { errors: pkgErrs, lines: safeLines } = await validatePackageLinesAgainstCatalog(input.packageLines, meta.venueId !== undefined ? meta.venueId : row.venueId);
  if (pkgErrs.length) return { success: false, error: pkgErrs.join(" ") };
  const baseInput: QuotationInput = input.packageLines ? { ...input, packageLines: safeLines } : input;

  const venueForTax = meta.venueId !== undefined ? meta.venueId : row.venueId;
  const tax = await resolveQuoteTax(
    venueForTax,
    meta.taxSlabId !== undefined ? meta.taxSlabId : row.taxSlabId
  );
  const safeInput: QuotationInput =
    tax.taxRate != null ? { ...baseInput, taxRate: tax.taxRate } : baseInput;

  // (Audit fix) Guarded write: the DRAFT check above is a plain read, so a
  // concurrent submit could land between check and write and the edit would
  // mutate a quotation already under review. updateMany with the status in the
  // WHERE makes check-and-write atomic — count 0 ⇒ it left DRAFT, reject.
  const { count: updated } = await prisma.salesQuotation.updateMany({
    where: { id, status: "DRAFT" },
    data: {
      inputsJson: safeInput as unknown as Prisma.InputJsonValue,
      // `undefined` = key omitted (keep current); explicit null = clear it.
      leadId: meta.leadId !== undefined ? meta.leadId || null : row.leadId,
      contactId: meta.contactId !== undefined ? meta.contactId || null : row.contactId,
      venueId: meta.venueId !== undefined ? meta.venueId || null : row.venueId,
      taxSlabId: tax.taxSlabId,
      ...headline(safeInput, {
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
  if (updated === 0)
    return { success: false, error: "Only a draft quotation can be edited. Create a new version instead.", code: 409 };
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

  // A quote sent at the wrong GST rate is a number the customer has already
  // agreed to, and correcting it afterwards means reissuing the quote or
  // absorbing the difference. So an undecided rate stops here, not later.
  const storedInput = row.inputsJson as unknown as QuotationInput;
  if (storedInput.taxRate == null) {
    const tax = await resolveQuoteTax(row.venueId, row.taxSlabId);
    if (tax.mustAsk) {
      const names = tax.options.map((o) => `${o.name} (${o.total}%)`).join(" or ");
      return {
        success: false,
        error: `This property charges more than one GST rate. Choose ${names} on the quotation before sending it for approval.`,
      };
    }
  }

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
  // Re-check vendor-package lines against the LIVE catalog at freeze time — a
  // package archived, re-priced or re-capped since the draft was created must
  // not be frozen in unchecked. Block on errors; freeze with the authoritative
  // (re-priced) lines so the stored input and frozen output agree.
  const { errors: pkgErrs, lines: safeLines } = await validatePackageLinesAgainstCatalog(input.packageLines, row.venueId);
  if (pkgErrs.length) return { success: false, error: pkgErrs.join(" ") };
  const withLines: QuotationInput = input.packageLines ? { ...input, packageLines: safeLines } : input;
  // The rate stored on the draft wins. Only a draft raised before rates existed
  // has none, and for that one the property decides at freeze time.
  const frozenTax =
    withLines.taxRate != null
      ? { taxRate: withLines.taxRate, taxSlabId: row.taxSlabId }
      : await resolveQuoteTax(row.venueId, row.taxSlabId).then((t) => ({
          taxRate: t.taxRate,
          taxSlabId: t.taxSlabId,
        }));
  const frozenInput: QuotationInput =
    frozenTax.taxRate != null ? { ...withLines, taxRate: frozenTax.taxRate } : withLines;
  const out = computeQuotation(frozenInput);

  const guarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        inputsJson: frozenInput as unknown as Prisma.InputJsonValue,
        outputsJson: out as unknown as Prisma.InputJsonValue,
        // (Audit fix) The freeze re-prices lines against the live catalog, so
        // the denormalized headline totals MUST be refreshed with it — the
        // booking amount, 20% advance gate and send-email all read these
        // columns, and a vendor re-price between draft and approval previously
        // left them stale while the frozen output/PDF showed the new figures.
        subtotal: new Prisma.Decimal(out.subtotal),
        discountPct: new Prisma.Decimal(out.discountPct),
        taxAmount: new Prisma.Decimal(out.tax),
        grandTotal: new Prisma.Decimal(out.grandTotal),
        taxSlabId: frozenTax.taxSlabId,
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
/**
 * Reopen an APPROVED/SENT quotation back to DRAFT so it can be edited — even
 * after an invoice was raised from it. Approver-gated (quotes:approve): an
 * approved commercial document must not be silently editable by its author.
 * The re-edited quote goes through submit → approve again; an already-issued
 * invoice or blocked slot is NOT touched (adjust those on the invoice itself).
 */
export async function reopenSalesQuotation(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:approve"))
    return { success: false, error: "Only a sales manager / head can reopen an approved quotation." };
  const row = await prisma.salesQuotation.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Quotation not found" };
  if (row.status !== "APPROVED" && row.status !== "SENT" && row.status !== "CONVERTED")
    return { success: false, error: `Cannot reopen from ${row.status}.`, code: 409 };

  const fromStatus = row.status;
  const guarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: fromStatus },
      data: {
        status: "DRAFT",
        // Clear the approval so the resubmit → approve cycle runs clean.
        approvedById: null,
        approvedAt: null,
        rejectedReason: null,
      },
    });
    if (count === 0) return false;
    await tx.salesQuotationTransition.create({
      data: {
        quotationId: id,
        fromStatus,
        toStatus: "DRAFT",
        actorId: user.id,
        note: "Reopened for editing after approval",
      },
    });
    return true;
  });
  if (!guarded) return { success: false, error: `Cannot reopen from ${row.status}.`, code: 409 };
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { success: true, data: { status: "DRAFT" } };
}

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

  const email = opts.to?.trim() || row.clientEmail || row.contact?.email || "";
  if (opts.method === "EMAIL" && !email)
    return { success: false, error: "No customer email on file — enter a recipient." };

  // Compose the email before anything is recorded. Its PDF link has to open for
  // a customer who isn't signed in, and the printout allows that only with
  // ?token= of a live share link (access.ts next to /api/quotations/[id]/pdf),
  // so reuse the quotation's live link or mint one. If that fails the send
  // fails too: no email with a link that opens nothing, no SENT without a send.
  let message: { subject: string; html: string } | null = null;
  let shareLinkId: string | null = null;
  if (opts.method === "EMAIL") {
    let html = opts.body?.trim();
    if (!html) {
      let pdfLink: string;
      try {
        const link = await ensureQuoteShareLink(prisma, row, { actorId: user.id });
        shareLinkId = link.id;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
        pdfLink = quotationPdfShareUrl(appUrl, id, link.token);
      } catch (e) {
        console.error("[QUOTATION_SHARE_LINK_ERROR]", e);
        return {
          success: false,
          error: "Couldn't create the customer's link to this quotation, so it wasn't sent. Please try again.",
        };
      }
      const greetingName = escapeHtml(row.clientName || row.contact?.firstName || "Guest");
      html = `Dear ${greetingName},<br/><br/>Thank you for considering Veloria Grand. Please find your event quotation below.<br/><br/><a href="${escapeHtml(pdfLink)}">View / download your quotation (PDF)</a><br/><br/>Grand total: ₹${escapeHtml(String(row.grandTotal))}<br/><br/>Warm regards,<br/>Veloria Grand`;
    }
    message = { subject: opts.subject?.trim() || `Your Veloria Grand Quotation — ${row.quoteNumber}`, html };
  }

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

  if (message) {
    const mail = { to: email, ...message };
    // after() so the quotation email survives a serverless freeze.
    after(() => sendEmail(mail).catch((e) => console.error("[QUOTATION_EMAIL_ERROR]", e)));
  }

  logActivity({
    userId: user.id,
    action: "QUOTATION_SENT",
    entityType: "SalesQuotation",
    entityId: id,
    changes: { method: opts.method, ...(shareLinkId ? { shareLinkId } : {}) },
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  // "Quote sent" has been worth 20 points in VELOS_DEFAULTS since the engine
  // shipped, and nothing ever awarded it. Keyed on the quotation id with no
  // suffix, so re-sending the same quote does not pay twice.
  await awardVelos(prisma, {
    userId: user.id,
    eventType: "quote_sent",
    entityType: "quotation",
    entityId: id,
  }).catch(() => {
    /* never fail a send because the ledger did not move */
  });

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
    // A revision keeps the rate the previous version was built on; the stored
    // input carries the same number, so the two cannot drift apart.
    taxSlabId: row.taxSlabId,
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
