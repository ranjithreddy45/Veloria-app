import { prisma } from "@/lib/prisma";
import { getHostScope, getHostUser, isStaffUser, staffCan } from "@/lib/guest/host-scope";
import { INVOICE_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { decideDocumentAccess, money } from "../../receipt/guest-money";
import { renderInvoiceHtml } from "../../receipt/customer-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// GET /api/guest/invoice/<invoiceId>: the customer's copy of an invoice,
// print-to-PDF, laid out like the team's /invoices/<id>/pdf page and printed
// from the same stored fields. /api/guest/** skips middleware, so access is
// decided here (guest-money.decideDocumentAccess): the invoice must belong to a
// booking in the viewer's scope, or to their own contact when it has no booking
// yet, and must not be a DRAFT. Staff preview additionally needs invoices:read,
// which already opens this invoice on the team side, by the viewer's effective
// permissions (staffCan: role overrides count, admins pass).
// Everything else is a 404.
// ============================================================

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const user = await getHostUser();
  if (!user) return plain("Please sign in to the Veloria Grand app to download this.", 401);

  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      subtotal: true,
      discountPercent: true,
      discountAmount: true,
      cgstRate: true,
      sgstRate: true,
      igstRate: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      totalAmount: true,
      paidAmount: true,
      balanceDue: true,
      notes: true,
      terms: true,
      gstin: true,
      placeOfSupply: true,
      sacCode: true,
      bookingId: true,
      contactId: true,
      contact: {
        select: {
          firstName: true,
          lastName: true,
          company: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          email: true,
          phone: true,
        },
      },
      booking: {
        select: { bookingNumber: true, eventName: true, eventType: true, date: true, venue: { select: { name: true } } },
      },
      lineItems: { orderBy: { order: "asc" }, select: { description: true, quantity: true, unitPrice: true, amount: true } },
    },
  });
  if (!inv) return plain("We couldn't find that document.", 404);

  const scope = await getHostScope(inv.bookingId ?? undefined);
  const decision = decideDocumentAccess({
    scope,
    kind: "invoice",
    record: { bookingId: inv.bookingId, contactId: inv.contactId, invoiceStatus: inv.status },
    can: (permission) => isStaffUser(user) && staffCan(user, permission),
  });
  if (!decision.allow) return plain(decision.message, decision.status);

  const html = renderInvoiceHtml({
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    statusLabel: customerLabel(INVOICE_STATUS_LABEL, inv.status),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subtotal: money(inv.subtotal),
    discountPercent: money(inv.discountPercent),
    discountAmount: money(inv.discountAmount),
    cgstRate: money(inv.cgstRate),
    sgstRate: money(inv.sgstRate),
    igstRate: money(inv.igstRate),
    cgstAmount: money(inv.cgstAmount),
    sgstAmount: money(inv.sgstAmount),
    igstAmount: money(inv.igstAmount),
    totalAmount: money(inv.totalAmount),
    paidAmount: money(inv.paidAmount),
    balanceDue: money(inv.balanceDue),
    notes: inv.notes,
    terms: inv.terms,
    gstin: inv.gstin,
    placeOfSupply: inv.placeOfSupply,
    sacCode: inv.sacCode,
    contact: inv.contact,
    booking: inv.booking
      ? {
          bookingNumber: inv.booking.bookingNumber,
          eventName: inv.booking.eventName,
          eventType: inv.booking.eventType,
          date: inv.booking.date,
          venueName: inv.booking.venue?.name ?? null,
        }
      : null,
    lineItems: inv.lineItems.map((li) => ({
      description: li.description,
      quantity: money(li.quantity),
      unitPrice: money(li.unitPrice),
      amount: money(li.amount),
    })),
  });

  const safeName = inv.invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="Invoice-${safeName}.html"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
