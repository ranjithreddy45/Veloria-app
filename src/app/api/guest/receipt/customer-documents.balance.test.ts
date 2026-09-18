import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/utils";
import { invoicePresentation } from "@/lib/finance/invoice-presentation";
import { PAYMENT_TERMS_LINES } from "@/lib/sales/quotation-calc";
import {
  escapeHtml,
  renderInvoiceHtml,
  renderReceiptHtml,
  type InvoiceDocumentData,
  type ReceiptDocumentData,
} from "./customer-documents";

// The customer app's invoice and receipt documents print the title and the
// balance line by the shared rules (src/lib/finance/invoice-presentation.ts),
// the same ones as the team's print page and the portal PDF.

const shown = (n: number) => escapeHtml(formatINR(n));
/** The "Balance due" row: its label and what it prints. */
const balanceRow = (html: string) => /<div class="row balance">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";

const invoice: InvoiceDocumentData = {
  invoiceNumber: "INV-2026-0042",
  status: "PARTIALLY_PAID",
  statusLabel: "Partly paid",
  issueDate: new Date("2026-09-01T06:00:00.000Z"),
  dueDate: new Date("2026-10-01T00:00:00.000Z"),
  subtotal: 500000,
  discountPercent: 0,
  discountAmount: 0,
  cgstRate: 2.5,
  sgstRate: 2.5,
  igstRate: 0,
  cgstAmount: 12500,
  sgstAmount: 12500,
  igstAmount: 0,
  totalAmount: 525000,
  paidAmount: 105000,
  balanceDue: 420000,
  notes: null,
  terms: null,
  gstin: null,
  placeOfSupply: "Karnataka",
  sacCode: "996332",
  contact: { firstName: "Priya", lastName: "Sharma", company: null, address: null, city: null, state: null, pincode: null, email: null, phone: null },
  booking: null,
  lineItems: [{ description: "Hall rental", quantity: 1, unitPrice: 500000, amount: 500000 }],
};

describe("invoice document: title and balance line by the shared rules", () => {
  it("prints what is still owed on an owed invoice", () => {
    const html = renderInvoiceHtml(invoice);
    expect(balanceRow(html)).toContain(`class="v due">${shown(420000)}<`);
    expect(html).toContain("<h2>PROFORMA INVOICE</h2>");
  });

  it("says Paid on a paid invoice", () => {
    const html = renderInvoiceHtml({ ...invoice, status: "PAID", statusLabel: "Paid", paidAmount: 525000, balanceDue: 0 });
    expect(balanceRow(html)).toContain('class="v clear">Paid<');
    expect(html).toContain("<h2>TAX INVOICE</h2>");
  });

  it("keeps a fully refunded invoice a Tax Invoice that says Refunded, never the balance the refund restored", () => {
    // refundPayment on a fully paid invoice: REFUNDED, paidAmount 0, balanceDue back to the total.
    const html = renderInvoiceHtml({ ...invoice, status: "REFUNDED", statusLabel: "Refunded", paidAmount: 0, balanceDue: 525000 });
    expect(html).toContain("<h2>TAX INVOICE</h2>");
    expect(html).not.toContain("PROFORMA INVOICE");
    expect(balanceRow(html)).toContain('class="v muted">Refunded<');
    expect(balanceRow(html)).not.toContain(shown(525000));
    expect(html).not.toContain(escapeHtml(PAYMENT_TERMS_LINES[0]));
    expect(html).toContain("computer-generated tax invoice");
  });

  it("says Cancelled on a cancelled invoice, titled as before", () => {
    const html = renderInvoiceHtml({ ...invoice, status: "CANCELLED", statusLabel: "Cancelled", paidAmount: 0, balanceDue: 525000 });
    expect(balanceRow(html)).toContain('class="v muted">Cancelled<');
    expect(html).toContain("<h2>PROFORMA INVOICE</h2>");
  });

  it.each(["SENT", "PARTIALLY_PAID", "OVERDUE", "PAID", "REFUNDED", "CANCELLED"])(
    "a %s invoice prints the shared title and balance line",
    (status) => {
      const html = renderInvoiceHtml({ ...invoice, status });
      const shared = invoicePresentation({ status, balanceDue: invoice.balanceDue });
      expect(html).toContain(`<h2>${shared.title}</h2>`);
      expect(balanceRow(html)).toContain(`class="v ${shared.tone}">${escapeHtml(shared.balanceLabel)}<`);
    }
  );
});

describe("receipt document: the invoice's balance line", () => {
  const receipt: ReceiptDocumentData = {
    receiptNumber: "RCP-2026-0007",
    amount: 525000,
    methodLabel: "Online payment",
    statusLabel: "Refunded",
    paidAt: new Date("2026-09-02T09:15:00.000Z"),
    transactionId: null,
    customerName: "Priya Sharma",
    invoiceNumber: "INV-2026-0042",
    invoiceTotal: 525000,
    invoicePaid: 0,
    invoiceBalanceDue: 525000,
    eventName: null,
    eventDate: null,
    bookingNumber: null,
    venueName: null,
    generatedAt: new Date("2026-09-16T04:00:00.000Z"),
  };

  it("follows the owed rule when given the invoice status: a refunded invoice is not due", () => {
    const row = balanceRow(renderReceiptHtml({ ...receipt, invoiceStatus: "REFUNDED" }));
    expect(row).toContain('class="v muted">Refunded<');
    expect(row).not.toContain(shown(525000));
  });

  it("prints what is still owed on an owed invoice", () => {
    const row = balanceRow(
      renderReceiptHtml({ ...receipt, statusLabel: "Received", invoicePaid: 105000, invoiceBalanceDue: 420000, invoiceStatus: "PARTIALLY_PAID" })
    );
    expect(row).toContain(`class="v due">${shown(420000)}<`);
  });

  it("prints the stored balance, as before, while the route does not pass the status", () => {
    expect(balanceRow(renderReceiptHtml(receipt))).toContain(`class="v due">${shown(525000)}<`);
  });
});
