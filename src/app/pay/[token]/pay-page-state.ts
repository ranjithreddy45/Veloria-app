import {
  invoicePresentation,
  type InvoiceBalanceKind,
  type InvoicePresentation,
} from "@/lib/finance/invoice-presentation";

// ============================================================
// /pay/<invoice>: what the page shows for an invoice — pure.
// ------------------------------------------------------------
// The page reads the invoice the way the invoice documents do
// (src/lib/finance/invoice-presentation.ts), so the customer sees the title,
// balance line and payable state the team's invoice screens and PDFs show:
//   - "Tax invoice" once paid in full (or refunded after being paid in full),
//     "Proforma invoice" until then;
//   - the Pay button only while money is owed: SENT, PARTIALLY_PAID or OVERDUE
//     with a balance left;
//   - otherwise what the balance line says: fully paid, refunded, cancelled or
//     not sent yet. A refunded invoice is never called "fully paid", even
//     though its refund put balanceDue back.
// ============================================================

export interface ClosedInvoiceCopy {
  /** Paid in full (a thank-you); otherwise the customer may need help, so contact buttons show. */
  settled: boolean;
  title: string;
  body: string;
}

export function closedInvoiceCopy(kind: InvoiceBalanceKind): ClosedInvoiceCopy {
  switch (kind) {
    case "owed": // owed, but nothing is left on it
    case "paid":
      return { settled: true, title: "This invoice is fully paid", body: "Thank you! Nothing more is due." };
    case "refunded":
      return {
        settled: false,
        title: "This invoice has been refunded",
        body: "Nothing is due on it. If you have a question about the refund, please contact us.",
      };
    case "cancelled":
      return {
        settled: false,
        title: "This invoice has been cancelled",
        body: "Nothing is due on it. If you think this is a mistake, please contact us.",
      };
    case "draft":
      return {
        settled: false,
        title: "This invoice isn't ready for payment",
        body: "It hasn't been sent yet, so nothing can be paid on it. Please contact us for an updated link.",
      };
  }
}

export interface PayPageInvoice {
  doc: InvoicePresentation;
  /** "Tax invoice" or "Proforma invoice", as the invoice documents title it. */
  docTitle: string;
  /** Show the Pay button: the invoice is owed and money is left on it. */
  payable: boolean;
  /** What to show instead of the Pay button; null when payable. */
  closed: ClosedInvoiceCopy | null;
}

export function payPageInvoice(inv: { status: string; balanceDue: number }): PayPageInvoice {
  const doc = invoicePresentation(inv);
  const payable = doc.kind === "owed" && doc.owed > 0;
  return {
    doc,
    docTitle: doc.title === "TAX INVOICE" ? "Tax invoice" : "Proforma invoice",
    payable,
    closed: payable ? null : closedInvoiceCopy(doc.kind),
  };
}
