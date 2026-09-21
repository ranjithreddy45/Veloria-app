// ============================================================
// "Opened but not paid": has a shared quotation already converted?
//
// This is the SAME rule the quote-radar recovery sweep applies
// (lib/quote-radar/silent-nudge.ts, isConverted), restated over rows that are
// already loaded so the home screen can decide for a whole page of links with
// two batched queries instead of two queries per link. Change both together.
//
//   converted = the quotation has a booking, OR its invoice (the link's own
//   pay invoice, else the quotation's) is PAID, has nothing left due, or has
//   had any money paid against it.
// Pure.
// ============================================================

/** Placeholder the one-tap flow writes while an invoice is being created. */
const PENDING = "__pending__";

export interface LinkRefs {
  primaryQuotationId: string | null;
  payInvoiceId: string | null;
}

export interface QuotationRefs {
  bookingId: string | null;
  invoiceId: string | null;
}

export interface InvoiceMoney {
  status: string;
  balanceDue: number;
  paidAmount: number;
}

/** The invoice id that decides conversion for a link, or null when there is none. */
export function decidingInvoiceId(link: LinkRefs, quotation: QuotationRefs | undefined): string | null {
  const own = link.payInvoiceId && link.payInvoiceId !== PENDING ? link.payInvoiceId : null;
  if (own) return own;
  // The sweep only falls back to the quotation's invoice when the link carries
  // no pay-invoice id at all (a pending placeholder counts as carrying one).
  if (link.payInvoiceId) return null;
  const viaQuote = quotation?.invoiceId && quotation.invoiceId !== PENDING ? quotation.invoiceId : null;
  return viaQuote;
}

export function isShareLinkConverted(
  link: LinkRefs,
  quotation: QuotationRefs | undefined,
  invoice: InvoiceMoney | undefined
): boolean {
  if (quotation?.bookingId) return true;
  if (!invoice) return false;
  return invoice.status === "PAID" || invoice.balanceDue <= 0 || invoice.paidAmount > 0;
}
