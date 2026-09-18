import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bookingBalance,
  COLLECTIBLE_INVOICE_STATUSES,
  isCollectibleInvoice,
  isIssuedInvoice,
  NOT_ISSUED_INVOICE_STATUSES,
} from "./issued-invoices";

// Every InvoiceStatus the schema defines, so a new status cannot slip past both rules unclassified.
const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
const INVOICE_STATUSES = (/^enum InvoiceStatus \{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, "").trim())
  .filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s));

describe("the billed rule (isIssuedInvoice)", () => {
  it("bills every invoice except an unsent draft and a void cancelled one", () => {
    expect([...NOT_ISSUED_INVOICE_STATUSES]).toEqual(["DRAFT", "CANCELLED"]);
    expect(INVOICE_STATUSES.filter(isIssuedInvoice)).toEqual(["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED"]);
  });
});

describe("the owed rule (isCollectibleInvoice)", () => {
  it("owes only an invoice money can still be collected against", () => {
    expect([...COLLECTIBLE_INVOICE_STATUSES]).toEqual(["SENT", "PARTIALLY_PAID", "OVERDUE"]);
    expect(INVOICE_STATUSES.filter(isCollectibleInvoice)).toEqual(["SENT", "PARTIALLY_PAID", "OVERDUE"]);
    for (const s of ["DRAFT", "PAID", "CANCELLED", "REFUNDED"]) expect(isCollectibleInvoice(s)).toBe(false);
  });

  it("covers every InvoiceStatus in the schema, and everything owed is billed", () => {
    // A new status must be placed in (or out of) both rules on purpose: update this list when it is.
    expect(INVOICE_STATUSES).toEqual(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"]);
    expect(INVOICE_STATUSES.filter((s) => isCollectibleInvoice(s) && !isIssuedInvoice(s))).toEqual([]);
  });
});

describe("bookingBalance: owed balance, billed count", () => {
  // One invoice in each state the invoice, payment and refund paths leave it in.
  const cases: [string, { status: string; balanceDue: number }, { balanceDue: number; issued: number }][] = [
    ["a draft is neither billed nor owed", { status: "DRAFT", balanceDue: 100000 }, { balanceDue: 0, issued: 0 }],
    ["a sent invoice is owed in full", { status: "SENT", balanceDue: 100000 }, { balanceDue: 100000, issued: 1 }],
    ["a partially paid invoice owes what is left", { status: "PARTIALLY_PAID", balanceDue: 70000 }, { balanceDue: 70000, issued: 1 }],
    ["an overdue invoice is owed", { status: "OVERDUE", balanceDue: 30000 }, { balanceDue: 30000, issued: 1 }],
    ["a paid invoice is billed with nothing owed", { status: "PAID", balanceDue: 0 }, { balanceDue: 0, issued: 1 }],
    ["a cancelled invoice is void, even with a balance left on it", { status: "CANCELLED", balanceDue: 100000 }, { balanceDue: 0, issued: 0 }],
    // refundPayment, no cash left on a fully paid invoice: REFUNDED, with balanceDue restored to the total.
    ["a fully refunded invoice was billed but is not owed", { status: "REFUNDED", balanceDue: 100000 }, { balanceDue: 0, issued: 1 }],
    // refundPayment, cash still on the invoice: PARTIALLY_PAID, and the refunded amount is owed again.
    ["a partially refunded invoice owes the refunded amount again", { status: "PARTIALLY_PAID", balanceDue: 60000 }, { balanceDue: 60000, issued: 1 }],
    // refundPayment, the only payment on a part-paid invoice refunded: SENT, or OVERDUE once past due.
    ["a part-paid invoice whose payment was refunded is owed again", { status: "OVERDUE", balanceDue: 100000 }, { balanceDue: 100000, issued: 1 }],
  ];

  it.each(cases)("%s", (_name, invoice, expected) => {
    expect(bookingBalance([invoice])).toEqual(expected);
  });

  it("adds a booking's owed balances in paise and counts every billed invoice", () => {
    expect(
      bookingBalance([
        { status: "SENT", balanceDue: 0.1 },
        { status: "PARTIALLY_PAID", balanceDue: 0.2 },
        { status: "PAID", balanceDue: 0 },
        { status: "REFUNDED", balanceDue: 5000 },
        { status: "DRAFT", balanceDue: 50000 },
        { status: "CANCELLED", balanceDue: 0 },
      ])
    ).toEqual({ balanceDue: 0.3, issued: 4 });
  });

  it("is zero with nothing billed, so the customer app can say there are no invoices yet", () => {
    expect(bookingBalance([])).toEqual({ balanceDue: 0, issued: 0 });
    expect(bookingBalance([{ status: "DRAFT", balanceDue: 250000 }])).toEqual({ balanceDue: 0, issued: 0 });
  });
});
