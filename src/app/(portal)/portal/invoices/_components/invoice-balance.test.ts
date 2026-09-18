import { describe, expect, it } from "vitest";
import { bookingBalance } from "@/lib/finance/issued-invoices";
import { invoicePresentation } from "@/lib/finance/invoice-presentation";
import { CANCELLED_BOOKING_CHECKOUT_ERROR } from "@/lib/holds/checkout-guard";
import { hasAmountDue, invoiceBalance, portalPayState } from "./invoice-balance";

describe("invoiceBalance: one invoice by finance's owed rule", () => {
  const owed: [string, number][] = [
    ["SENT", 100000],
    ["PARTIALLY_PAID", 40000],
    ["OVERDUE", 25000.5],
  ];

  it.each(owed)("a %s invoice is owed its balanceDue", (status, balanceDue) => {
    expect(invoiceBalance({ status, balanceDue })).toEqual({ kind: "owed", amount: balanceDue });
    expect(hasAmountDue({ status, balanceDue })).toBe(true);
  });

  it("an owed invoice with nothing left has nothing to pay", () => {
    expect(invoiceBalance({ status: "SENT", balanceDue: 0 })).toEqual({ kind: "owed", amount: 0 });
    expect(hasAmountDue({ status: "SENT", balanceDue: 0 })).toBe(false);
  });

  it("a paid invoice says it is paid, with nothing due", () => {
    expect(invoiceBalance({ status: "PAID", balanceDue: 0 })).toEqual({ kind: "paid", label: "Paid" });
    expect(hasAmountDue({ status: "PAID", balanceDue: 0 })).toBe(false);
  });

  it("a fully refunded invoice says it was refunded and is not due, though its balanceDue is back to the total", () => {
    // refundPayment on a fully paid invoice leaves it REFUNDED, paidAmount 0, balanceDue = totalAmount.
    expect(invoiceBalance({ status: "REFUNDED", balanceDue: 100000 })).toEqual({ kind: "refunded", label: "Refunded" });
    expect(hasAmountDue({ status: "REFUNDED", balanceDue: 100000 })).toBe(false);
  });

  it.each(["DRAFT", "CANCELLED"])("a %s invoice is not billed: nothing to show, nothing due", (status) => {
    expect(invoiceBalance({ status, balanceDue: 100000 })).toEqual({ kind: "none" });
    expect(hasAmountDue({ status, balanceDue: 100000 })).toBe(false);
  });

  it("a booking's invoice rows add up to the booking's balance due", () => {
    const rows = [
      { status: "SENT", balanceDue: 0.1 },
      { status: "PARTIALLY_PAID", balanceDue: 0.2 },
      { status: "OVERDUE", balanceDue: 30000.25 },
      { status: "PAID", balanceDue: 0 },
      { status: "REFUNDED", balanceDue: 50000 },
      { status: "CANCELLED", balanceDue: 20000 },
    ];
    const rowPaise = rows.reduce((sum, inv) => {
      const b = invoiceBalance(inv);
      return b.kind === "owed" ? sum + Math.round(b.amount * 100) : sum;
    }, 0);
    expect(rowPaise / 100).toBe(bookingBalance(rows).balanceDue);
    expect(rowPaise / 100).toBe(30000.55);
  });

  it.each(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"])(
    "a %s invoice reads the shared rule the team's screens and both invoice PDFs print",
    (status) => {
      const invoice = { status, balanceDue: 48250.75 };
      const shared = invoicePresentation(invoice);
      const balance = invoiceBalance(invoice);
      expect(balance.kind === "owed" ? balance.amount : 0).toBe(shared.owed);
      if (balance.kind === "paid" || balance.kind === "refunded") expect(balance.label).toBe(shared.balanceLabel);
      expect(hasAmountDue(invoice)).toBe(shared.owed > 0);
    }
  );
});

describe("portalPayState: the Pay button, and why it's missing", () => {
  it.each(["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED"])("an owed invoice on a %s booking can be paid", (bookingStatus) => {
    expect(portalPayState({ status: "SENT", balanceDue: 5000, bookingStatus })).toEqual({ payable: true, reason: null });
  });

  it("an owed invoice with no booking can be paid", () => {
    expect(portalPayState({ status: "OVERDUE", balanceDue: 5000, bookingStatus: null })).toEqual({ payable: true, reason: null });
    expect(portalPayState({ status: "OVERDUE", balanceDue: 5000 })).toEqual({ payable: true, reason: null });
  });

  it.each(["SENT", "PARTIALLY_PAID", "OVERDUE"])(
    "a %s invoice on a cancelled booking can't be paid, in the words the order route and the invoice link refuse with",
    (status) => {
      expect(portalPayState({ status, balanceDue: 5000, bookingStatus: "CANCELLED" })).toEqual({
        payable: false,
        reason: CANCELLED_BOOKING_CHECKOUT_ERROR,
      });
    }
  );

  it("an invoice with nothing owed offers no payment and has nothing to explain, whatever its booking", () => {
    for (const inv of [
      { status: "PAID", balanceDue: 0 },
      { status: "REFUNDED", balanceDue: 5000 },
      { status: "SENT", balanceDue: 0 },
      { status: "DRAFT", balanceDue: 5000 },
    ]) {
      expect(portalPayState({ ...inv, bookingStatus: "CANCELLED" })).toEqual({ payable: false, reason: null });
      expect(portalPayState({ ...inv, bookingStatus: "CONFIRMED" })).toEqual({ payable: false, reason: null });
    }
  });

  it("never offers payment on an invoice finance doesn't count as owed", () => {
    for (const status of ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"]) {
      const inv = { status, balanceDue: 1200 };
      expect(portalPayState({ ...inv, bookingStatus: "CONFIRMED" }).payable).toBe(hasAmountDue(inv));
    }
  });
});
