import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The old customer portal follows finance's invoice rules
// (src/lib/finance/issued-invoices.ts): it lists BILLED invoices only (never a
// draft or a void cancelled one), states the balance by the OWED rule, and
// takes a payment proof only against an invoice the customer still owes.
// Prisma, auth and the identity resolver are stubbed; the real actions run.
// ============================================================

const { db, authMock } = vi.hoisted(() => ({
  db: {
    booking: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    invoice: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
  },
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => false }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: async () => ["c1"] }));
vi.mock("@/lib/portal-invite", () => ({ createPortalInvite: vi.fn(), acceptPortalInvite: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/sales/receipt", () => ({ isSafeReceiptDataUrl: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getPortalBooking, getPortalDashboard, getPortalInvoice, getPortalInvoices, submitPaymentProof } from "./portal.actions";

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "CLIENT" } });
});

describe("getPortalDashboard", () => {
  it("counts pending invoices by the owed rule", async () => {
    db.booking.count.mockResolvedValue(1);
    db.invoice.count.mockResolvedValue(2);
    db.payment.aggregate.mockResolvedValue({ _sum: { amount: 25000 } });
    db.booking.findFirst.mockResolvedValue(null);
    db.booking.findMany.mockResolvedValue([]);

    const res = await getPortalDashboard("u1");

    expect(res.pendingInvoices).toBe(2);
    expect(db.invoice.count.mock.calls[0][0].where).toEqual({
      contactId: { in: ["c1"] },
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    });
  });
});

describe("getPortalBooking", () => {
  it("lists billed invoices only and gives the balance the customer still owes", async () => {
    db.booking.findFirst.mockResolvedValue({
      id: "b1",
      bookingNumber: "VG-2026-0001",
      eventName: "Wedding",
      eventType: "Wedding",
      date: new Date("2026-12-01T00:00:00Z"),
      timeSlot: "EVENING",
      startTime: null,
      endTime: null,
      guestCount: 300,
      specialRequests: null,
      status: "CONFIRMED",
      totalAmount: 500000,
      createdAt: new Date("2026-08-01T00:00:00Z"),
      venue: { id: "v1", name: "Grand Hall", description: null, capacity: 500, amenities: [] },
      contact: { firstName: "Asha", lastName: "Rao", email: null, phone: null },
      createdBy: null,
      // What the query returns once drafts and cancelled invoices are left out.
      invoices: [
        { id: "i1", invoiceNumber: "INV-1", totalAmount: 300000, paidAmount: 100000, balanceDue: 200000, status: "PARTIALLY_PAID", dueDate: new Date("2026-11-01T00:00:00Z") },
        // Paid, then fully refunded: its balance was restored, but nothing is owed on it.
        { id: "i2", invoiceNumber: "INV-2", totalAmount: 50000, paidAmount: 0, balanceDue: 50000, status: "REFUNDED", dueDate: new Date("2026-10-01T00:00:00Z") },
      ],
    });

    const booking = await getPortalBooking("u1", "b1");

    expect(db.booking.findFirst.mock.calls[0][0].include.invoices.where).toEqual({ status: { notIn: ["DRAFT", "CANCELLED"] } });
    expect(booking?.invoices.map((i) => i.invoiceNumber)).toEqual(["INV-1", "INV-2"]);
    expect(booking?.balanceDue).toBe(200000);
  });
});

describe("getPortalInvoices and getPortalInvoice", () => {
  it("never list a draft or a cancelled invoice", async () => {
    db.invoice.findMany.mockResolvedValue([]);

    await getPortalInvoices("u1");

    expect(db.invoice.findMany.mock.calls[0][0].where).toEqual({
      contactId: { in: ["c1"] },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    });
  });

  it("never open a draft, even by its id", async () => {
    db.invoice.findFirst.mockResolvedValue(null);

    expect(await getPortalInvoice("u1", "inv-draft")).toBeNull();
    expect(db.invoice.findFirst.mock.calls[0][0].where).toEqual({
      id: "inv-draft",
      contactId: { in: ["c1"] },
      status: { not: "DRAFT" },
    });
  });
});

describe("submitPaymentProof", () => {
  const proof = { invoiceId: "i2", amount: 50000, method: "UPI" as const, receiptUrl: "data:image/png;base64,AAAA" };

  it("refuses a proof against a fully refunded invoice, whatever balance it shows", async () => {
    db.invoice.findFirst.mockResolvedValue({ id: "i2", status: "REFUNDED", balanceDue: 50000, invoiceNumber: "INV-2" });

    const res = await submitPaymentProof("u1", proof);

    expect(res.success).toBe(false);
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("refuses a draft as if it did not exist", async () => {
    db.invoice.findFirst.mockResolvedValue({ id: "i3", status: "DRAFT", balanceDue: 50000, invoiceNumber: "INV-3" });

    const res = await submitPaymentProof("u1", { ...proof, invoiceId: "i3" });

    expect(res).toEqual({ success: false, error: "Invoice not found." });
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("takes a proof against an invoice the customer still owes", async () => {
    db.invoice.findFirst.mockResolvedValue({ id: "i1", status: "PARTIALLY_PAID", balanceDue: 200000, invoiceNumber: "INV-1" });
    db.payment.create.mockResolvedValue({ id: "p1" });
    db.user.findMany.mockResolvedValue([]);

    const res = await submitPaymentProof("u1", { ...proof, invoiceId: "i1" });

    expect(res).toEqual({ success: true, data: { id: "p1" } });
    expect(db.payment.create).toHaveBeenCalledTimes(1);
  });
});
