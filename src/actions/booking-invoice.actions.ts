"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { coarseContactWhere, matchesContactKey } from "@/lib/dedup";
import { createInvoice, createInstallmentPlan } from "@/actions/invoice.actions";
import {
  computeQuotation,
  buildPaymentSchedule,
  PAYMENT_TERMS,
  PAYMENT_TERMS_SENTENCE,
  installmentDueDate,
  type QuotationInput,
  type QuotationResult,
} from "@/lib/sales/quotation-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Resolve the customer for a quotation that was built without one linked:
 * 1. the linked lead's contact, else
 * 2. an existing contact matched by normalized phone/email (same rule as the
 *    rest of the app's dedup), else
 * 3. a new contact created from the quote's client name/phone/email.
 * Returns null only when the quote has no phone AND no email to work from.
 */
async function resolveQuotationContact(q: {
  leadId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
}): Promise<string | null> {
  if (q.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: q.leadId },
      select: { contactId: true },
    });
    if (lead?.contactId) return lead.contactId;
  }
  const phone = q.clientPhone?.trim() || null;
  const email = q.clientEmail?.trim() || null;
  if (!phone && !email) return null;

  const coarse = coarseContactWhere(email, phone);
  if (coarse) {
    const candidates = await prisma.contact.findMany({
      where: { AND: [{ deletedAt: null }, coarse] },
      select: { id: true, email: true, phone: true },
      take: 25,
    });
    const matched = matchesContactKey(candidates, email, phone);
    if (matched.length > 0) return matched[0].id;
  }

  const nameParts = (q.clientName?.trim() || "Customer").split(/\s+/);
  const created = await prisma.contact.create({
    data: {
      firstName: nameParts[0] || "Customer",
      lastName: nameParts.slice(1).join(" ") || "",
      phone,
      email,
      enquirySource: "DIRECT",
    },
    select: { id: true },
  });
  return created.id;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

/**
 * Turn a slot-blocked, approved quotation into a real booking-advance invoice.
 * Tax is the planner's 5% (CGST 2.5% + SGST 2.5%) so the invoice matches the
 * customer-facing quotation. Line items are broken out on a PER-PLATE basis
 * (food = rate/plate × guests); fixed services stay as single units. An
 * installment plan mirrors the canonical PAYMENT_TERMS (30 / 50 / 20), with due
 * dates anchored on the event date.
 */
export async function createBookingInvoiceFromQuotation(
  quotationId: string
): Promise<Result<{ invoiceId: string }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "invoices:create"))
    return { success: false, error: "You don't have permission to create invoices." };

  const q = await prisma.salesQuotation.findUnique({ where: { id: quotationId } });
  if (!q) return { success: false, error: "Quotation not found." };
  if (q.status !== "APPROVED" && q.status !== "SENT")
    return { success: false, error: "Approve the quotation before invoicing." };
  // The proforma invoice is raised FIRST (to collect the advance) — the slot is
  // only blocked AFTER the advance is paid. So the booking may not exist yet;
  // the invoice attaches to it later, when the slot is blocked (see
  // blockSlotFromQuotation, which links + auto-confirms once the advance clears).
  //
  // Missing contact: a quotation built without picking a lead (client typed in
  // by hand) has no contactId, and this step used to dead-end with "Link a
  // customer/contact to the quotation first" — with no UI to actually do that.
  // Resolve it automatically instead: lead's contact → normalized phone/email
  // match → create a contact from the quote's client details. Only give up when
  // the quote holds no client identity at all.
  let contactId = q.contactId;
  if (!contactId) {
    contactId = await resolveQuotationContact(q);
    if (!contactId)
      return {
        success: false,
        error:
          "This quotation has no client phone or email to create the customer from. Edit the quotation and add the client's phone number first.",
      };
    await prisma.salesQuotation
      .update({ where: { id: quotationId }, data: { contactId } })
      .catch(() => {}); // persistence is a convenience; the invoice uses contactId directly
  }
  const PENDING = "__pending__";
  // A real invoice already exists (the sentinel doesn't count — see below).
  if (q.invoiceId && q.invoiceId !== PENDING)
    return { success: false, error: "An invoice already exists for this quotation." };

  // Atomically CLAIM the quotation so two concurrent clicks can't both create
  // an invoice. Only the writer that flips invoiceId→sentinel proceeds. We also
  // reclaim a STALE sentinel (>5 min old) so a crashed prior attempt can't lock
  // the quotation out of invoicing forever.
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claim = await prisma.salesQuotation.updateMany({
    where: {
      id: quotationId,
      OR: [{ invoiceId: null }, { invoiceId: PENDING, updatedAt: { lt: staleBefore } }],
    },
    data: { invoiceId: PENDING },
  });
  if (claim.count === 0)
    return { success: false, error: "An invoice is already being created for this quotation." };

  const release = () =>
    prisma.salesQuotation
      .updateMany({ where: { id: quotationId, invoiceId: PENDING }, data: { invoiceId: null } })
      .catch(() => {});

  try {
    const input = q.inputsJson as unknown as QuotationInput;
    const result: QuotationResult = (q.outputsJson as unknown as QuotationResult) || computeQuotation(input);
    const guests = Math.max(1, q.guestCount || input.guestCount || 1);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Per-plate line items: food is shown on a per-head basis when it divides
    // evenly into the guest count (guests × unit reconstructs the total exactly).
    // When it doesn't divide evenly, a per-unit price would drift the line — and
    // therefore the invoice subtotal/tax/total — off the quoted grand total. In
    // that case we carry the indivisible remainder paise as a separate adjustment
    // line so the food total still sums to the exact quoted amount. Fixed items
    // stay whole. Drop any non-positive line rather than clamping it to +₹1
    // (which would overcharge).
    const lineItems = result.lines
      .filter((l) => l.amount > 0)
      .flatMap((l) => {
        if (l.particulars === "Food Plan") {
          const totalPaise = Math.round(l.amount * 100);
          const unitPaise = Math.floor(totalPaise / guests);
          const remainderPaise = totalPaise - unitPaise * guests;
          const unit = round2(unitPaise / 100);
          const lines = [
            { description: `${l.particulars} — ${l.plan}`, quantity: guests, unitPrice: unit },
          ];
          if (remainderPaise > 0) {
            lines.push({
              description: `${l.particulars} — ${l.plan} (rounding adjustment)`,
              quantity: 1,
              unitPrice: round2(remainderPaise / 100),
            });
          }
          return lines;
        }
        return [{ description: `${l.particulars} — ${l.plan}`, quantity: 1, unitPrice: l.amount }];
      });
    if (lineItems.length === 0) {
      await release();
      return { success: false, error: "Quotation has no line items to invoice." };
    }

    // GST for the invoice. The property's slab is authoritative: it carries the
    // exact CGST/SGST/IGST split a GST invoice has to print, which is why the
    // rate is stored split rather than as one percentage. Without a slab, halve
    // the rate the quotation actually used — the same thing the flat 5% did as
    // 2.5 + 2.5 — so a quote raised before rates existed invoices unchanged.
    const slab = q.taxSlabId
      ? await prisma.venueTaxSlab.findUnique({
          where: { id: q.taxSlabId },
          select: { cgstRate: true, sgstRate: true, igstRate: true },
        })
      : null;
    const quotedRatePct = round2(Number(result.taxRate ?? 0) * 100);
    const gst = slab
      ? {
          cgstRate: Number(slab.cgstRate),
          sgstRate: Number(slab.sgstRate),
          igstRate: Number(slab.igstRate),
        }
      : { cgstRate: round2(quotedRatePct / 2), sgstRate: round2(quotedRatePct / 2), igstRate: 0 };

    const effectivePerPlate = Math.round(result.grandTotal / guests);
    const dueNow = new Date();
    dueNow.setDate(dueNow.getDate() + 1);

    const inv = await createInvoice({
      contactId, // resolved above (q.contactId, lead's contact, matched, or created)
      // May be null in the proforma-first flow (slot blocked later); the invoice
      // is linked to the booking when the slot is blocked after the advance.
      bookingId: q.bookingId ?? undefined,
      dueDate: dueNow,
      lineItems,
      discountPercent: Number(q.discountPct) || 0,
      // From the quotation's own rate — see the split derived above.
      cgstRate: gst.cgstRate,
      sgstRate: gst.sgstRate,
      igstRate: gst.igstRate,
      notes: `Generated from quotation ${q.quoteNumber}. Effective per-plate: ₹${effectivePerPlate.toLocaleString("en-IN")} (grand total ÷ ${guests} guests).`,
      terms: PAYMENT_TERMS_SENTENCE,
    });

    if (!inv.success || !inv.data) {
      await release();
      return { success: false, error: inv.error || "Could not create the invoice." };
    }
    const invData = inv.data as { id: string; totalAmount: number | string };
    const invoiceId = invData.id;

    // Installment schedule per the canonical PAYMENT_TERMS (30 / 50 / 20),
    // anchored on the event date. Amounts come from buildPaymentSchedule so the
    // split is identical to the quotation the customer accepted, and so the last
    // installment absorbs rounding — createInstallmentPlan rejects any drift from
    // the invoice total. Base it on the INVOICE total, not the quotation's.
    const grand = Number(invData.totalAmount);
    const installments = buildPaymentSchedule(grand);

    // Each term states how many days before the event it falls (null = due now).
    // Without an event date we fall back to relative offsets so the plan still
    // validates rather than refusing to create.
    const event = q.eventDate ? new Date(q.eventDate) : null;
    const planRows = PAYMENT_TERMS.map((term, idx) => ({
      label: `${term.label} (${term.pct}%) — ${term.dueHint}`,
      amount: installments[idx].amount,
      // Fallback spacing keeps the dates strictly increasing when there's no event date.
      dueDate: installmentDueDate(term.daysBeforeEvent, event, 15 * (idx + 1)),
    }));
    // The final installment's due date doubles as the invoice-level dueDate below.
    const balanceDue = planRows[planRows.length - 1].dueDate;

    const plan = await createInstallmentPlan(invoiceId, planRows);
    if (!plan.success) {
      // Roll back the just-created invoice so we don't leave one without a plan.
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
      await release();
      return { success: false, error: plan.error || "Could not create the installment plan." };
    }

    // Issue the invoice immediately. This booking-advance invoice exists to
    // collect the confirming advance, so it must be payable right away —
    // recordPayment rejects DRAFT invoices. Mark it SENT (no auto-email; the
    // slot-block / pay-link flow surfaces it to the customer separately).
    // Set the invoice-level dueDate to the FINAL installment date (not tomorrow):
    // the plan runs to the event, so a tomorrow due-date would let markOverdue
    // flip the WHOLE invoice OVERDUE once the advance date passes, overstating
    // overdue receivables by the not-yet-due later installments. Per-installment
    // urgency is tracked on the installments themselves.
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT", dueDate: balanceDue },
    });

    // Replace the sentinel with the real invoice id and mark the quotation CONVERTED
    // (terminal "won") so open-vs-won can be read from status, not just invoiceId.
    await prisma.salesQuotation.update({ where: { id: quotationId }, data: { invoiceId, status: "CONVERTED" } });

    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath("/invoices");
    return { success: true, data: { invoiceId } };
  } catch (e) {
    await release();
    return { success: false, error: e instanceof Error ? e.message : "Could not create the invoice." };
  }
}
