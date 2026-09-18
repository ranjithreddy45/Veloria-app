import { prisma } from "@/lib/prisma";
import { getHostScope, getHostUser, isStaffUser, staffCan } from "@/lib/guest/host-scope";
import { PAYMENT_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { decideDocumentAccess, money, paymentMethodLabel } from "../guest-money";
import { renderReceiptHtml } from "../customer-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// GET /api/guest/receipt/<paymentId>: one payment's receipt, print-to-PDF.
// /api/guest/** skips middleware, so access is decided here, by the same rules
// as the customer screens (guest-money.decideDocumentAccess):
//   - signed in, and the payment's invoice belongs to a booking in the viewer's
//     scope (getHostScope), or to their own contact when it has no booking yet
//   - the payment was actually received (COMPLETED)
//   - staff preview additionally needs invoices:read and payments:read, the
//     permissions of the team screens that already show this payment and its
//     invoice, checked as the team side checks them (staffCan: effective
//     permissions, so a role override that revokes one refuses here too)
// Anything else answers 404, so guessing ids reveals nothing.
// ============================================================

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const user = await getHostUser();
  if (!user) return plain("Please sign in to the Veloria Grand app to download this.", 401);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      receiptNumber: true,
      paidAt: true,
      transactionId: true,
      invoice: {
        select: {
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
          bookingId: true,
          contactId: true,
          contact: { select: { firstName: true, lastName: true } },
          booking: { select: { bookingNumber: true, eventName: true, date: true, venue: { select: { name: true } } } },
        },
      },
    },
  });
  if (!payment) return plain("We couldn't find that document.", 404);

  const inv = payment.invoice;
  const scope = await getHostScope(inv.bookingId ?? undefined);
  const decision = decideDocumentAccess({
    scope,
    kind: "receipt",
    record: { bookingId: inv.bookingId, contactId: inv.contactId, invoiceStatus: inv.status, paymentStatus: payment.status },
    can: (permission) => isStaffUser(user) && staffCan(user, permission),
  });
  if (!decision.allow) return plain(decision.message, decision.status);

  const html = renderReceiptHtml({
    receiptNumber: payment.receiptNumber,
    amount: money(payment.amount),
    methodLabel: paymentMethodLabel(payment.method),
    statusLabel: customerLabel(PAYMENT_STATUS_LABEL, payment.status),
    paidAt: payment.paidAt,
    transactionId: payment.transactionId,
    customerName: `${inv.contact.firstName} ${inv.contact.lastName ?? ""}`.trim(),
    invoiceNumber: inv.invoiceNumber,
    invoiceTotal: money(inv.totalAmount),
    invoicePaid: money(inv.paidAmount),
    invoiceBalanceDue: money(inv.balanceDue),
    invoiceStatus: inv.status,
    eventName: inv.booking?.eventName ?? null,
    eventDate: inv.booking?.date ?? null,
    bookingNumber: inv.booking?.bookingNumber ?? null,
    venueName: inv.booking?.venue?.name ?? null,
    generatedAt: new Date(),
  });

  // Inline so Safari renders the page (with its Save as PDF button) instead of
  // saving an extension-less file.
  const safeName = (payment.receiptNumber ?? payment.id).replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="Receipt-${safeName}.html"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
