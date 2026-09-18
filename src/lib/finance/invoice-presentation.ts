// ============================================================
// What one invoice prints, in ONE place: the amount still owed on it, its
// balance line and its document title. The team's booking page, invoice list
// and invoice detail, the team's print PDF, the customer portal (screens and
// PDF) and the customer app's invoice document all read these, so the team and
// the customer see the same money facts about the same invoice.
//
//   OWED (finance's owed rule, issued-invoices.ts): SENT, PARTIALLY_PAID or
//     OVERDUE. The owed amount is bookingBalance() over this one invoice, so a
//     booking's invoice rows add up to its "Balance due"; the balance line is
//     that amount.
//   NOT OWED: PAID, REFUNDED, CANCELLED, DRAFT. Nothing is due, whatever
//     balanceDue holds (a full refund puts it back to the invoice total), and
//     the balance line says why: "Paid", "Refunded", "Cancelled" or "Draft".
//   TITLE (the team's rule): "TAX INVOICE" once the invoice is paid in full,
//     read as balanceDue <= 0 or status PAID, and "PROFORMA INVOICE" until then.
//     REFUNDED is also "TAX INVOICE": refundPayment only closes an invoice as
//     REFUNDED when it had been paid in full, when this rule already titled it
//     a Tax Invoice, and the balanceDue the refund restores must not turn it
//     back into a Proforma. Every other status is titled exactly as before.
// The rules need only status and balanceDue; the Paid row prints the stored
// paidAmount as it is. Pure: no Prisma and no server-only imports.
// ============================================================

import type { InvoiceStatus } from "@prisma/client";
import { formatINR } from "@/lib/utils";
import { bookingBalance, COLLECTIBLE_INVOICE_STATUSES, isCollectibleInvoice } from "@/lib/finance/issued-invoices";

/** A printed invoice's title. */
export type InvoiceDocumentTitle = "TAX INVOICE" | "PROFORMA INVOICE";

/** Why an invoice's balance line reads as it does. */
export type InvoiceBalanceKind = "owed" | "paid" | "refunded" | "cancelled" | "draft";

type NotOwedStatus = Exclude<InvoiceStatus, (typeof COLLECTIBLE_INVOICE_STATUSES)[number]>;
type NotOwedLine = { kind: Exclude<InvoiceBalanceKind, "owed">; label: string };

/**
 * The balance line of every invoice that is not owed. Typed against the
 * schema's InvoiceStatus: a status added there must be placed here (or in the
 * owed rule) before this compiles.
 */
const NOT_OWED: Record<NotOwedStatus, NotOwedLine> = {
  PAID: { kind: "paid", label: "Paid" },
  REFUNDED: { kind: "refunded", label: "Refunded" },
  CANCELLED: { kind: "cancelled", label: "Cancelled" },
  DRAFT: { kind: "draft", label: "Draft" },
};

function notOwedLine(status: string): NotOwedLine {
  if (Object.prototype.hasOwnProperty.call(NOT_OWED, status)) return NOT_OWED[status as NotOwedStatus];
  // A status the schema does not define: not owed, named in words.
  return { kind: "draft", label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") };
}

/**
 * The team's title rule: "TAX INVOICE" once the invoice is paid in full
 * (balanceDue <= 0 or status PAID), "PROFORMA INVOICE" until then. A REFUNDED
 * invoice was paid in full before its refund, so it stays a Tax Invoice.
 */
export function invoiceDocumentTitle(inv: { status: string; balanceDue: number }): InvoiceDocumentTitle {
  return inv.balanceDue <= 0 || inv.status === "PAID" || inv.status === "REFUNDED"
    ? "TAX INVOICE"
    : "PROFORMA INVOICE";
}

export interface InvoicePresentation {
  kind: InvoiceBalanceKind;
  /** Still owed on this invoice: bookingBalance() over it, so its balanceDue when owed and 0 otherwise. */
  owed: number;
  /** The balance line: the owed amount (formatINR) when owed, otherwise "Paid", "Refunded", "Cancelled" or "Draft". */
  balanceLabel: string;
  /**
   * How the balance line reads: "due" while money is owed; "clear" when an owed
   * invoice has nothing left or the invoice is paid; "muted" when it was
   * refunded, cancelled or never sent.
   */
  tone: "due" | "clear" | "muted";
  /** The document title by the team's rule (invoiceDocumentTitle). */
  title: InvoiceDocumentTitle;
}

export function invoicePresentation(inv: { status: string; balanceDue: number }): InvoicePresentation {
  const title = invoiceDocumentTitle(inv);
  if (isCollectibleInvoice(inv.status)) {
    const owed = bookingBalance([inv]).balanceDue;
    return { kind: "owed", owed, balanceLabel: formatINR(owed), tone: owed > 0 ? "due" : "clear", title };
  }
  const { kind, label } = notOwedLine(inv.status);
  return { kind, owed: 0, balanceLabel: label, tone: kind === "paid" ? "clear" : "muted", title };
}
