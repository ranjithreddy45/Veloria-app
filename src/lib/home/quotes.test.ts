import { describe, it, expect } from "vitest";
import { decidingInvoiceId, isShareLinkConverted } from "./quotes";

const unpaid = { status: "SENT", balanceDue: 50000, paidAmount: 0 };

describe("decidingInvoiceId", () => {
  it("prefers the link's own pay invoice", () => {
    expect(decidingInvoiceId({ primaryQuotationId: "q", payInvoiceId: "inv-link" }, { bookingId: null, invoiceId: "inv-q" })).toBe("inv-link");
  });

  it("falls back to the quotation's invoice only when the link carries none", () => {
    expect(decidingInvoiceId({ primaryQuotationId: "q", payInvoiceId: null }, { bookingId: null, invoiceId: "inv-q" })).toBe("inv-q");
  });

  it("treats a pending placeholder as no invoice, with no fallback, like the recovery sweep", () => {
    expect(decidingInvoiceId({ primaryQuotationId: "q", payInvoiceId: "__pending__" }, { bookingId: null, invoiceId: "inv-q" })).toBeNull();
    expect(decidingInvoiceId({ primaryQuotationId: "q", payInvoiceId: null }, { bookingId: null, invoiceId: "__pending__" })).toBeNull();
  });
});

describe("isShareLinkConverted", () => {
  const link = { primaryQuotationId: "q", payInvoiceId: null };

  it("is converted once the quotation has a booking", () => {
    expect(isShareLinkConverted(link, { bookingId: "b", invoiceId: null }, undefined)).toBe(true);
  });

  it("is converted when any money has been paid, or nothing is left due", () => {
    expect(isShareLinkConverted(link, undefined, { ...unpaid, paidAmount: 1 })).toBe(true);
    expect(isShareLinkConverted(link, undefined, { ...unpaid, balanceDue: 0 })).toBe(true);
    expect(isShareLinkConverted(link, undefined, { ...unpaid, status: "PAID" })).toBe(true);
  });

  it("is still open with an unpaid invoice or none at all", () => {
    expect(isShareLinkConverted(link, { bookingId: null, invoiceId: "i" }, unpaid)).toBe(false);
    expect(isShareLinkConverted(link, undefined, undefined)).toBe(false);
  });
});
