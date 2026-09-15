import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/utils";
import { customerLabel, INVOICE_STATUS_LABEL } from "@/lib/customer-app/status-labels";
import { bookingBalance } from "./issued-invoices";
import { invoiceDocumentTitle, invoicePresentation } from "./invoice-presentation";

// Every InvoiceStatus the schema defines, so a new status cannot slip past unplaced.
const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
const INVOICE_STATUSES = (/^enum InvoiceStatus \{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, "").trim())
  .filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s));

/** The title rule all three invoice documents printed before REFUNDED was placed. */
const previousTitle = (inv: { status: string; balanceDue: number }) =>
  inv.balanceDue <= 0 || inv.status === "PAID" ? "TAX INVOICE" : "PROFORMA INVOICE";

describe("invoicePresentation: one invoice's owed amount, balance line and title", () => {
  it("places every InvoiceStatus in the schema", () => {
    // A new status needs a balance line and a title on purpose: update this table when it gets them.
    const placed = Object.fromEntries(
      INVOICE_STATUSES.map((status) => [status, invoicePresentation({ status, balanceDue: 100000 })])
    );
    expect(placed).toEqual({
      DRAFT: { kind: "draft", owed: 0, balanceLabel: "Draft", tone: "muted", title: "PROFORMA INVOICE" },
      SENT: { kind: "owed", owed: 100000, balanceLabel: formatINR(100000), tone: "due", title: "PROFORMA INVOICE" },
      PARTIALLY_PAID: { kind: "owed", owed: 100000, balanceLabel: formatINR(100000), tone: "due", title: "PROFORMA INVOICE" },
      PAID: { kind: "paid", owed: 0, balanceLabel: "Paid", tone: "clear", title: "TAX INVOICE" },
      OVERDUE: { kind: "owed", owed: 100000, balanceLabel: formatINR(100000), tone: "due", title: "PROFORMA INVOICE" },
      CANCELLED: { kind: "cancelled", owed: 0, balanceLabel: "Cancelled", tone: "muted", title: "PROFORMA INVOICE" },
      REFUNDED: { kind: "refunded", owed: 0, balanceLabel: "Refunded", tone: "muted", title: "TAX INVOICE" },
    });
  });

  it("an owed invoice owes its balanceDue, added in paise like bookingBalance", () => {
    expect(invoicePresentation({ status: "OVERDUE", balanceDue: 25000.5 })).toMatchObject({
      kind: "owed",
      owed: 25000.5,
      balanceLabel: formatINR(25000.5),
      tone: "due",
    });
    expect(invoicePresentation({ status: "PARTIALLY_PAID", balanceDue: 0.1 + 0.2 }).owed).toBe(0.3);
  });

  it("an owed invoice with nothing left reads clear, titled by the team's rule", () => {
    expect(invoicePresentation({ status: "SENT", balanceDue: 0 })).toEqual({
      kind: "owed",
      owed: 0,
      balanceLabel: formatINR(0),
      tone: "clear",
      title: "TAX INVOICE",
    });
  });

  it("a fully refunded invoice owes nothing, says Refunded and keeps its Tax Invoice title", () => {
    // refundPayment on a fully paid invoice: REFUNDED, paidAmount 0, balanceDue back to the total.
    const refunded = invoicePresentation({ status: "REFUNDED", balanceDue: 511875 });
    expect(refunded).toEqual({ kind: "refunded", owed: 0, balanceLabel: "Refunded", tone: "muted", title: "TAX INVOICE" });
    // The title it had once paid in full, under the same rule.
    expect(refunded.title).toBe(previousTitle({ status: "PAID", balanceDue: 0 }));
  });

  it("a cancelled or draft invoice owes nothing, whatever its stored balance", () => {
    expect(invoicePresentation({ status: "CANCELLED", balanceDue: 20000 })).toMatchObject({ owed: 0, balanceLabel: "Cancelled", tone: "muted" });
    expect(invoicePresentation({ status: "DRAFT", balanceDue: 20000 })).toMatchObject({ owed: 0, balanceLabel: "Draft", tone: "muted" });
  });

  it("titles every status but REFUNDED exactly as the documents did before", () => {
    const balances = [-1, 0, 0.004, 1, 100000];
    for (const status of INVOICE_STATUSES.filter((s) => s !== "REFUNDED")) {
      for (const balanceDue of balances) {
        expect(invoiceDocumentTitle({ status, balanceDue })).toBe(previousTitle({ status, balanceDue }));
      }
    }
    for (const balanceDue of balances) expect(invoiceDocumentTitle({ status: "REFUNDED", balanceDue })).toBe("TAX INVOICE");
  });

  it("a booking's invoice rows add up to its balance due", () => {
    const rows = [
      { status: "SENT", balanceDue: 0.1 },
      { status: "PARTIALLY_PAID", balanceDue: 0.2 },
      { status: "OVERDUE", balanceDue: 30000.25 },
      { status: "PAID", balanceDue: 0 },
      { status: "REFUNDED", balanceDue: 50000 },
      { status: "CANCELLED", balanceDue: 20000 },
      { status: "DRAFT", balanceDue: 10000 },
    ];
    const paise = rows.reduce((sum, inv) => sum + Math.round(invoicePresentation(inv).owed * 100), 0);
    expect(paise / 100).toBe(bookingBalance(rows).balanceDue);
    expect(paise / 100).toBe(30000.55);
  });

  it("uses the customer app's words for a closed invoice, so the portal and the team say the same", () => {
    for (const status of ["PAID", "REFUNDED", "CANCELLED"]) {
      expect(invoicePresentation({ status, balanceDue: 0 }).balanceLabel).toBe(customerLabel(INVOICE_STATUS_LABEL, status));
    }
  });

  it("reads a status the schema does not define as not owed, named in words", () => {
    expect(invoicePresentation({ status: "ON_HOLD", balanceDue: 5000 })).toMatchObject({ owed: 0, balanceLabel: "On hold", tone: "muted" });
  });
});
