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
 * installment plan mirrors the 10% / 50% / 40% payment terms, with due dates
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
  if (q.invoiceId)
    return { success: false, error: "An invoice already exists for this quotation." };

  const input = q.inputsJson as unknown as QuotationInput;
  const result: QuotationResult = (q.outputsJson as unknown as QuotationResult) || computeQuotation(input);
  const guests = Math.max(1, q.guestCount || input.guestCount || 1);

  // Per-plate line items: food is divided by the head count; fixed items stay whole.
  const lineItems = result.lines.map((l) => {
    if (l.particulars === "Food Plan") {
      const unit = Math.max(1, Math.round(l.amount / guests));
      return { description: `${l.particulars} — ${l.plan}`, quantity: guests, unitPrice: unit };
    }
    return { description: `${l.particulars} — ${l.plan}`, quantity: 1, unitPrice: Math.max(1, l.amount) };
  });
  if (lineItems.length === 0)
    return { success: false, error: "Quotation has no line items to invoice." };

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
    terms: "Payment terms: 10% to block the slot, 50% fifteen days before the event, balance two hours before the event.",
  });

  if (!inv.success || !inv.data) {
    return { success: false, error: inv.error || "Could not create the invoice." };
  }
  const invData = inv.data as { id: string; totalAmount: number | string };
  const invoiceId = invData.id;

  // 10 / 50 / 40 installment schedule anchored on the event date. Base the
  // split on the INVOICE total (not the quotation's) so the three installments
  // sum to it exactly — createInstallmentPlan rejects any drift.
  const grand = Number(invData.totalAmount);
  const block = Math.round(grand * 0.1);
  const mid = Math.round(grand * 0.5);
  const balance = grand - block - mid;

  const event = q.eventDate ? new Date(q.eventDate) : null;
  const midDue = event ? new Date(event) : new Date(Date.now() + 15 * 86400000);
  if (event) midDue.setDate(midDue.getDate() - 15);
  const balanceDue = event ? new Date(event) : new Date(Date.now() + 30 * 86400000);

  await createInstallmentPlan(invoiceId, [
    { label: "Booking advance (10%) — blocks the slot", amount: block, dueDate: new Date() },
    { label: "Part payment (50%) — 15 days before event", amount: mid, dueDate: midDue },
    { label: "Final balance (40%) — before the event", amount: balance, dueDate: balanceDue },
  ]);

  await prisma.salesQuotation.update({ where: { id: quotationId }, data: { invoiceId } });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/invoices");
  return { success: true, data: { invoiceId } };
}
