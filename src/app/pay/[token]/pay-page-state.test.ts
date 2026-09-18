import { describe, it, expect } from "vitest";
import { payPageInvoice } from "./pay-page-state";
import { invoicePresentation } from "@/lib/finance/invoice-presentation";

// ============================================================
// /pay reads an invoice the way the invoice documents do: the same title and
// balance line, and the Pay button only while money is owed. A refunded
// invoice is a Tax Invoice with nothing due, and is never called "fully paid".
// ============================================================

const CASES = [
  { status: "SENT", balanceDue: 50000, payable: true, docTitle: "Proforma invoice" },
  { status: "PARTIALLY_PAID", balanceDue: 20000, payable: true, docTitle: "Proforma invoice" },
  { status: "OVERDUE", balanceDue: 20000, payable: true, docTitle: "Proforma invoice" },
  { status: "PAID", balanceDue: 0, payable: false, docTitle: "Tax invoice" },
  { status: "SENT", balanceDue: 0, payable: false, docTitle: "Tax invoice" },
  { status: "REFUNDED", balanceDue: 118000, payable: false, docTitle: "Tax invoice" },
  { status: "CANCELLED", balanceDue: 118000, payable: false, docTitle: "Proforma invoice" },
  { status: "DRAFT", balanceDue: 118000, payable: false, docTitle: "Proforma invoice" },
];

describe("payPageInvoice", () => {
  it.each(CASES)("$status with $balanceDue due: payable $payable, titled $docTitle", ({ status, balanceDue, payable, docTitle }) => {
    const page = payPageInvoice({ status, balanceDue });
    expect(page.payable).toBe(payable);
    expect(page.docTitle).toBe(docTitle);
    expect(page.closed === null).toBe(payable);
  });

  it("prints the invoice documents' title and balance line", () => {
    for (const { status, balanceDue } of CASES) {
      const doc = invoicePresentation({ status, balanceDue });
      const page = payPageInvoice({ status, balanceDue });
      expect(page.doc).toEqual(doc);
      expect(page.docTitle.toUpperCase()).toBe(doc.title);
    }
  });

  it("never calls a refunded, cancelled or draft invoice fully paid", () => {
    for (const status of ["REFUNDED", "CANCELLED", "DRAFT"]) {
      const { closed } = payPageInvoice({ status, balanceDue: 118000 });
      expect(closed?.settled).toBe(false);
      expect(`${closed?.title} ${closed?.body}`).not.toMatch(/fully paid/i);
    }
    expect(payPageInvoice({ status: "REFUNDED", balanceDue: 118000 }).closed?.title).toBe("This invoice has been refunded");
    expect(payPageInvoice({ status: "CANCELLED", balanceDue: 118000 }).closed?.title).toBe("This invoice has been cancelled");
    expect(payPageInvoice({ status: "DRAFT", balanceDue: 118000 }).closed?.title).toBe("This invoice isn't ready for payment");
  });

  it("a paid invoice, or an owed one with nothing left on it, is fully paid", () => {
    expect(payPageInvoice({ status: "PAID", balanceDue: 0 }).closed).toMatchObject({ settled: true, title: "This invoice is fully paid" });
    expect(payPageInvoice({ status: "PARTIALLY_PAID", balanceDue: 0 }).closed).toMatchObject({ settled: true });
  });
});
