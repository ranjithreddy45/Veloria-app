import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Report money figures follow finance's two invoice rules
// (src/lib/finance/issued-invoices.ts): invoiced and revenue count BILLED
// invoices (a DRAFT is unsent, a CANCELLED one void); outstanding and balance
// count OWED ones (SENT, PARTIALLY_PAID, OVERDUE), so a fully refunded invoice
// is billed but not owed.
// Prisma and auth are mocked; the real server actions run.
// ============================================================

const { db, authMock } = vi.hoisted(() => ({
  db: {
    booking: { findMany: vi.fn() },
    contact: { findUnique: vi.fn() },
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    invoiceLineItem: { findMany: vi.fn() },
  },
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));

import { NOT_ISSUED_INVOICE_STATUSES } from "@/lib/finance/issued-invoices";
import { getClientLedger, getGSTReport, getRevenueBreakdownReport, getSettlementReport } from "./report.actions";

beforeEach(() => {
  for (const table of Object.values(db)) for (const fn of Object.values(table)) fn.mockReset();
  authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
});

describe("getSettlementReport", () => {
  it("invoices billed invoices and counts as outstanding only what the customer still owes", async () => {
    db.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        eventName: "Wedding",
        status: "CONFIRMED",
        invoices: [
          { status: "PARTIALLY_PAID", totalAmount: 100000, balanceDue: 70000, payments: [{ amount: 30000 }] },
          { status: "PAID", totalAmount: 10000, balanceDue: 0, payments: [{ amount: 10000 }] },
          { status: "DRAFT", totalAmount: 50000, balanceDue: 50000, payments: [] },
          { status: "CANCELLED", totalAmount: 20000, balanceDue: 0, payments: [] },
          // Paid, then fully refunded: billed, but its restored balance is not owed.
          { status: "REFUNDED", totalAmount: 40000, balanceDue: 40000, payments: [] },
        ],
      },
      // Two ₹10,000 payments, one refunded: the invoice reopens and the refunded ₹10,000 is owed again.
      {
        id: "b2",
        eventName: "Sangeet",
        status: "CONFIRMED",
        invoices: [{ status: "OVERDUE", totalAmount: 60000, balanceDue: 50000, payments: [{ amount: 10000 }] }],
      },
      { id: "b3", eventName: "Birthday", status: "HOLD", invoices: [{ status: "DRAFT", totalAmount: 25000, balanceDue: 25000, payments: [] }] },
    ]);

    const res = await getSettlementReport("12m");
    if (!res.success) throw new Error(res.error);

    expect(res.data.bookings).toEqual([
      { bookingId: "b1", eventName: "Wedding", invoiced: 150000, paid: 40000, outstanding: 70000, status: "CONFIRMED" },
      { bookingId: "b2", eventName: "Sangeet", invoiced: 60000, paid: 10000, outstanding: 50000, status: "CONFIRMED" },
      { bookingId: "b3", eventName: "Birthday", invoiced: 0, paid: 0, outstanding: 0, status: "HOLD" },
    ]);
    expect(res.data).toMatchObject({ totalInvoiced: 210000, totalPaid: 50000, totalOutstanding: 120000 });
    expect(db.booking.findMany.mock.calls[0][0].select.invoices.select).toMatchObject({ status: true, balanceDue: true });
  });
});

describe("getClientLedger", () => {
  it("bills issued invoices, and the balance is only what the customer still owes", async () => {
    db.contact.findUnique.mockResolvedValue({ firstName: "Priya", lastName: "Sharma", email: "priya@example.com" });
    db.invoice.findMany.mockResolvedValue([
      { id: "i1", invoiceNumber: "INV-001", totalAmount: 100000, balanceDue: 75000, status: "PARTIALLY_PAID", issueDate: new Date("2026-08-01T06:00:00Z") },
      { id: "i2", invoiceNumber: "INV-002", totalAmount: 50000, balanceDue: 50000, status: "DRAFT", issueDate: new Date("2026-08-02T06:00:00Z") },
      { id: "i3", invoiceNumber: "INV-003", totalAmount: 20000, balanceDue: 0, status: "CANCELLED", issueDate: new Date("2026-08-03T06:00:00Z") },
      { id: "i4", invoiceNumber: "INV-004", totalAmount: 15000, balanceDue: 0, status: "PAID", issueDate: new Date("2026-08-04T06:00:00Z") },
      // Paid, then fully refunded: billed, but its restored balance is not owed.
      { id: "i5", invoiceNumber: "INV-005", totalAmount: 30000, balanceDue: 30000, status: "REFUNDED", issueDate: new Date("2026-08-05T06:00:00Z") },
    ]);
    db.payment.findMany.mockResolvedValue([
      { id: "p1", amount: 25000, method: "UPI", paidAt: new Date("2026-08-05T06:00:00Z") },
      { id: "p2", amount: 15000, method: "CASH", paidAt: new Date("2026-08-06T06:00:00Z") },
    ]);

    const res = await getClientLedger("c1");
    if (!res.success) throw new Error(res.error);

    expect(res.data.invoices.map((i) => i.number)).toEqual(["INV-001", "INV-004", "INV-005"]);
    expect(res.data).toMatchObject({ totalInvoiced: 145000, totalPaid: 40000, balance: 75000 });
    expect(db.invoice.findMany.mock.calls[0][0].where).toEqual({ contactId: "c1" });
    expect(db.invoice.findMany.mock.calls[0][0].select).toMatchObject({ status: true, balanceDue: true });
  });
});

describe("revenue breakdown and GST reports", () => {
  it("read issued invoices only, through finance's shared list of non-issued statuses", async () => {
    db.invoiceLineItem.findMany.mockResolvedValue([{ description: "Venue Rental", amount: 1000 }]);
    db.invoice.findMany.mockResolvedValue([]);

    await getRevenueBreakdownReport("12m");
    await getGSTReport("12m");

    const notIssued = { notIn: ["DRAFT", "CANCELLED"] };
    expect([...NOT_ISSUED_INVOICE_STATUSES]).toEqual(notIssued.notIn);
    expect(db.invoiceLineItem.findMany.mock.calls[0][0].where.invoice.status).toEqual(notIssued);
    expect(db.invoice.findMany.mock.calls[0][0].where.status).toEqual(notIssued);
  });
});
