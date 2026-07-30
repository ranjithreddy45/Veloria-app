"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
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
  if (!q.contactId)
    return { success: false, error: "Link a customer/contact to the quotation first." };
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

    const effectivePerPlate = Math.round(result.grandTotal / guests);
    const dueNow = new Date();
    dueNow.setDate(dueNow.getDate() + 1);

    const inv = await createInvoice({
      contactId: q.contactId,
      // May be null in the proforma-first flow (slot blocked later); the invoice
      // is linked to the booking when the slot is blocked after the advance.
      bookingId: q.bookingId ?? undefined,
      dueDate: dueNow,
      lineItems,
      discountPercent: Number(q.discountPct) || 0,
      // Planner's 5% tax, split as intra-state CGST + SGST.
      cgstRate: 2.5,
      sgstRate: 2.5,
      igstRate: 0,
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
