// ============================================================
// Finance's "issued invoice" rule, in ONE place.
// A DRAFT invoice is unsent and a CANCELLED invoice is void, so neither is
// billed to the customer. The team booking page, event profitability and the
// customer app all use this, so both sides always show the same money.
// Pure: safe for server and client code.
// ============================================================

export const NOT_ISSUED_INVOICE_STATUSES = ["DRAFT", "CANCELLED"] as const;

const NOT_ISSUED = new Set<string>(NOT_ISSUED_INVOICE_STATUSES);

export function isIssuedInvoice(status: string): boolean {
  return !NOT_ISSUED.has(status);
}

/**
 * Balance due on one booking: the sum of Invoice.balanceDue over its issued
 * invoices, added in paise to avoid floating-point drift.
 */
export function bookingBalance(
  invoices: readonly { status: string; balanceDue: number }[]
): { balanceDue: number; issued: number } {
  let paise = 0;
  let issued = 0;
  for (const inv of invoices) {
    if (!isIssuedInvoice(inv.status)) continue;
    issued++;
    paise += Math.round(inv.balanceDue * 100);
  }
  return { balanceDue: paise / 100, issued };
}
