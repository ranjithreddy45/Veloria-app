import { describe, expect, it } from "vitest";
import { bookingBalance, isIssuedInvoice, NOT_ISSUED_INVOICE_STATUSES } from "./issued-invoices";

describe("issued invoice rule", () => {
  it("treats drafts and cancelled invoices as not issued", () => {
    expect([...NOT_ISSUED_INVOICE_STATUSES]).toEqual(["DRAFT", "CANCELLED"]);
    for (const s of ["DRAFT", "CANCELLED"]) expect(isIssuedInvoice(s)).toBe(false);
    for (const s of ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED"]) expect(isIssuedInvoice(s)).toBe(true);
  });

  it("sums balance due over issued invoices only, without float drift", () => {
    const r = bookingBalance([
      { status: "SENT", balanceDue: 0.1 },
      { status: "PARTIALLY_PAID", balanceDue: 0.2 },
      { status: "DRAFT", balanceDue: 50000 },
      { status: "CANCELLED", balanceDue: 0 },
    ]);
    expect(r).toEqual({ balanceDue: 0.3, issued: 2 });
  });
});
