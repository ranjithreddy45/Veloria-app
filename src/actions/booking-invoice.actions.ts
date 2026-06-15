"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { createInvoice, createInstallmentPlan } from "@/actions/invoice.actions";
import { computeQuotation, type QuotationInput, type QuotationResult } from "@/lib/sales/quotation-calc";

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
 * installment plan mirrors the 20% / 60% / 20% payment terms, with due dates
 * anchored on the event date.
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
  if (!q.bookingId)
    return { success: false, error: "Block the slot first — the invoice attaches to that booking." };
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

    // Per-plate line items: food is divided by the head count (2-decimal unit
    // price so guests × unit reconstructs the food total exactly — no whole-
    // rupee drift on fractional overrides). Fixed items stay whole. Drop any
    // non-positive line rather than clamping it to +₹1 (which would overcharge).
    const lineItems = result.lines
      .filter((l) => l.amount > 0)
      .map((l) => {
        if (l.particulars === "Food Plan") {
          const unit = round2(l.amount / guests);
          return { description: `${l.particulars} — ${l.plan}`, quantity: guests, unitPrice: unit };
        }
        return { description: `${l.particulars} — ${l.plan}`, quantity: 1, unitPrice: l.amount };
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
      bookingId: q.bookingId,
      dueDate: dueNow,
      lineItems,
      discountPercent: Number(q.discountPct) || 0,
      // Planner's 5% tax, split as intra-state CGST + SGST.
      cgstRate: 2.5,
      sgstRate: 2.5,
      igstRate: 0,
      notes: `Generated from quotation ${q.quoteNumber}. Effective per-plate: ₹${effectivePerPlate.toLocaleString("en-IN")} (grand total ÷ ${guests} guests).`,
      terms: "Payment terms: 20% to block the slot, 60% fifteen days before the event, balance two hours before the event.",
    });

    if (!inv.success || !inv.data) {
      await release();
      return { success: false, error: inv.error || "Could not create the invoice." };
    }
    const invData = inv.data as { id: string; totalAmount: number | string };
    const invoiceId = invData.id;

    // 20 / 60 / 20 installment schedule anchored on the event date. Base the
    // split on the INVOICE total (not the quotation's) so the three installments
    // sum to it exactly — createInstallmentPlan rejects any drift.
    const grand = Number(invData.totalAmount);
    const block = Math.round(grand * 0.2);
    const mid = Math.round(grand * 0.6);
    const balance = grand - block - mid;

    // Part payment falls 15 days before the event; the final balance falls
    // 2 hours before the event start. Without an event date we fall back to
    // relative offsets so the plan still validates.
    const event = q.eventDate ? new Date(q.eventDate) : null;
    const midDue = event ? new Date(event) : new Date(Date.now() + 15 * 86400000);
    if (event) midDue.setDate(midDue.getDate() - 15);
    const balanceDue = event
      ? new Date(event.getTime() - 2 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 86400000);

    const plan = await createInstallmentPlan(invoiceId, [
      { label: "Booking advance (20%) — blocks the slot", amount: block, dueDate: new Date() },
      { label: "Part payment (60%) — 15 days before event", amount: mid, dueDate: midDue },
      { label: "Final balance (20%) — 2 hours before event", amount: balance, dueDate: balanceDue },
    ]);
    if (!plan.success) {
      // Roll back the just-created invoice so we don't leave one without a plan.
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
      await release();
      return { success: false, error: plan.error || "Could not create the installment plan." };
    }

    // Replace the sentinel with the real invoice id.
    await prisma.salesQuotation.update({ where: { id: quotationId }, data: { invoiceId } });

    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath("/invoices");
    return { success: true, data: { invoiceId } };
  } catch (e) {
    await release();
    return { success: false, error: e instanceof Error ? e.message : "Could not create the invoice." };
  }
}
