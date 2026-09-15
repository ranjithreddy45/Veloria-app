// ============================================================
// Finance's two invoice rules, in ONE place.
//   BILLED (isIssuedInvoice): issued to the customer. A DRAFT is unsent and a
//     CANCELLED invoice is void, so neither is billed. SENT, PARTIALLY_PAID,
//     PAID, OVERDUE and REFUNDED invoices are billed.
//   OWED (isCollectibleInvoice): money can still be collected against it:
//     SENT, PARTIALLY_PAID or OVERDUE, the statuses recordPayment takes money
//     in. Never a DRAFT (unsent), PAID (settled), CANCELLED (void) or REFUNDED
//     invoice: a full refund closes the invoice even though it restores
//     balanceDue to the total. A partial refund reopens the invoice as SENT,
//     PARTIALLY_PAID or OVERDUE, so the refunded amount is owed again.
// Invoiced figures count billed invoices; balance due, outstanding and overdue
// figures count owed ones. The team's screens, finance's reports and the
// customer app all use these, so both sides always show the same money.
// Pure: safe for server and client code.
// ============================================================

import type { InvoiceStatus } from "@prisma/client";

export const NOT_ISSUED_INVOICE_STATUSES = ["DRAFT", "CANCELLED"] as const satisfies readonly InvoiceStatus[];

const NOT_ISSUED = new Set<string>(NOT_ISSUED_INVOICE_STATUSES);

/** Billed: issued to the customer, so not an unsent DRAFT and not a void CANCELLED invoice. */
export function isIssuedInvoice(status: string): boolean {
  return !NOT_ISSUED.has(status);
}

/** The statuses an invoice can still be collected in. */
export const COLLECTIBLE_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const satisfies readonly InvoiceStatus[];

const COLLECTIBLE = new Set<string>(COLLECTIBLE_INVOICE_STATUSES);

/** Owed: SENT, PARTIALLY_PAID or OVERDUE. */
export function isCollectibleInvoice(status: string): boolean {
  return COLLECTIBLE.has(status);
}

/**
 * One booking's invoices (or one customer's) by the two rules, added in paise
 * to avoid floating-point drift:
 *   balanceDue: the sum of Invoice.balanceDue over OWED invoices;
 *   issued:     how many invoices are BILLED. 0 means nothing is billed yet, so
 *               a zero balance does not mean "settled".
 */
export function bookingBalance(
  invoices: readonly { status: string; balanceDue: number }[]
): { balanceDue: number; issued: number } {
  let paise = 0;
  let issued = 0;
  for (const inv of invoices) {
    if (isIssuedInvoice(inv.status)) issued++;
    if (isCollectibleInvoice(inv.status)) paise += Math.round(inv.balanceDue * 100);
  }
  return { balanceDue: paise / 100, issued };
}
