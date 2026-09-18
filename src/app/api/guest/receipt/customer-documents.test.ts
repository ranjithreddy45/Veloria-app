import { describe, it, expect } from "vitest";
import { formatINR } from "@/lib/utils";
import { LEGACY_INVOICE_TERMS } from "@/lib/constants";
import { PAYMENT_TERMS_LINES } from "@/lib/sales/quotation-calc";
import {
  escapeHtml,
  invoiceDocumentTitle,
  renderInvoiceHtml,
  renderReceiptHtml,
  type InvoiceDocumentData,
} from "./customer-documents";

const shown = (n: number) => escapeHtml(formatINR(n));

describe("receipt document", () => {
  const html = renderReceiptHtml({
    receiptNumber: "RCP-2026-0007",
    amount: 102469.13,
    methodLabel: "Online payment",
    statusLabel: "Received",
    paidAt: new Date("2026-09-02T09:15:00.000Z"),
    transactionId: "pay_ABC<script>",
    customerName: "Priya <b>Sharma</b>",
    invoiceNumber: "INV-2026-0042",
    invoiceTotal: 512345.67,
    invoicePaid: 102469.13,
    invoiceBalanceDue: 409876.54,
    eventName: "Wedding & Reception",
    eventDate: new Date("2026-12-12T00:00:00.000Z"),
    bookingNumber: "VG-B-0042",
    venueName: "Grand Hall",
    generatedAt: new Date("2026-09-16T04:00:00.000Z"),
  });

  it("prints the stored payment and invoice figures with the team's formatter", () => {
    expect(html).toContain(shown(102469.13));
    expect(html).toContain(shown(512345.67));
    expect(html).toContain(shown(409876.54));
    expect(html).toContain("RCP-2026-0007");
    expect(html).toContain("INV-2026-0042");
    expect(html).toContain("PAYMENT RECEIPT");
  });

  it("escapes every customer-supplied value", () => {
    expect(html).toContain("pay_ABC&lt;script&gt;");
    expect(html).toContain("Priya &lt;b&gt;Sharma&lt;/b&gt;");
    expect(html).toContain("Wedding &amp; Reception");
    expect(html).not.toContain("pay_ABC<script>");
    expect(html).not.toContain("<b>Sharma</b>");
  });
});

describe("invoice document (mirrors the team's print page)", () => {
  const base: InvoiceDocumentData = {
    invoiceNumber: "INV-2026-0042",
    status: "PARTIALLY_PAID",
    statusLabel: "Partly paid",
    issueDate: new Date("2026-09-01T06:00:00.000Z"),
    dueDate: new Date("2026-10-01T00:00:00.000Z"),
    subtotal: 500000,
    discountPercent: 2.5,
    discountAmount: 12500,
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 0,
    cgstAmount: 12187.5,
    sgstAmount: 12187.5,
    igstAmount: 0,
    totalAmount: 511875,
    paidAmount: 102375,
    balanceDue: 409500,
    notes: "Hall + dinner <for 400>",
    terms: LEGACY_INVOICE_TERMS,
    gstin: null,
    placeOfSupply: "Karnataka",
    sacCode: "996332",
    contact: { firstName: "Priya", lastName: "Sharma", company: null, address: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", email: "priya@example.com", phone: "+91 98765 43210" },
    booking: { bookingNumber: "VG-B-0042", eventName: "Wedding", eventType: "WEDDING", date: new Date("2026-12-12T00:00:00.000Z"), venueName: "Grand Hall" },
    lineItems: [{ description: "Hall rental", quantity: 1, unitPrice: 500000, amount: 500000 }],
  };

  it("is a Proforma until paid in full, then a Tax Invoice (the team's rule)", () => {
    expect(invoiceDocumentTitle({ status: "PARTIALLY_PAID", balanceDue: 10 })).toBe("PROFORMA INVOICE");
    expect(invoiceDocumentTitle({ status: "SENT", balanceDue: 0 })).toBe("TAX INVOICE");
    expect(invoiceDocumentTitle({ status: "PAID", balanceDue: 5 })).toBe("TAX INVOICE");
  });

  it("prints each stored total, tax and balance exactly once, unchanged", () => {
    const html = renderInvoiceHtml(base);
    for (const n of [base.subtotal, base.discountAmount, base.totalAmount, base.paidAmount, base.balanceDue]) expect(html).toContain(shown(n));
    expect(html).toContain("CGST (2.5%)");
    expect(html).toContain("SGST (2.5%)");
    expect(html).not.toContain("IGST");
    expect(html).toContain("Discount (2.5%)");
    expect(html).toContain("PROFORMA INVOICE");
    expect(html).toContain("Partly paid");
    expect(html).toContain("Hall + dinner &lt;for 400&gt;");
  });

  it("drops the retired default terms, keeps custom terms, and shows payment terms only while money is due", () => {
    const proforma = renderInvoiceHtml(base);
    expect(proforma).not.toContain("Late payments may attract interest");
    expect(proforma).toContain(escapeHtml(PAYMENT_TERMS_LINES[0]));

    const paid = renderInvoiceHtml({ ...base, status: "PAID", paidAmount: 511875, balanceDue: 0, terms: "Custom & binding" });
    expect(paid).toContain("TAX INVOICE");
    expect(paid).toContain("Custom &amp; binding");
    expect(paid).not.toContain(escapeHtml(PAYMENT_TERMS_LINES[0]));
    expect(paid).toContain("computer-generated tax invoice");
  });

  it("shows IGST instead of CGST/SGST for an interstate invoice", () => {
    const html = renderInvoiceHtml({ ...base, cgstAmount: 0, sgstAmount: 0, cgstRate: 0, sgstRate: 0, igstRate: 5, igstAmount: 24375 });
    expect(html).toContain("IGST (5%)");
    expect(html).toContain(shown(24375));
    expect(html).not.toContain("CGST");
  });
});
