import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// POST /api/payments/create-order (the portal's Razorpay checkout) applies the
// public pay links' hold rules and words: no checkout on a lapsed hold, and no
// NEW checkout once the hold's window has passed unless money that doesn't rely
// on a checkout's 15-minute grace is already against the booking. Otherwise
// every portal order would restart that grace and keep an expired hold's date.
// Auth, Prisma and Razorpay are mocked; the hold rules are real.
// ============================================================

const { authMock, db, ordersCreate } = vi.hoisted(() => ({
  authMock: vi.fn(),
  db: {
    invoice: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    contact: { findMany: vi.fn() },
    payment: { create: vi.fn() },
  },
  ordersCreate: vi.fn(),
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true, remaining: 9, resetIn: 60 }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/payments/razorpay-creds", () => ({
  razorpayKeyId: () => "rzp_test_key",
  razorpayKeySecret: () => "rzp_test_secret",
}));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate };
  },
}));

import { POST } from "./route";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { HOLD_LAPSED_CHECKOUT_ERROR, HOLD_WINDOW_CLOSED_CHECKOUT_ERROR } from "@/lib/holds/checkout-guard";

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

const unpaid = { status: "SENT", paidAmount: 0, payments: [] };
const lapsedHold = { id: "b1", status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid] };

function invoiceWith(booking: Record<string, unknown> | null) {
  return { id: "inv-1", invoiceNumber: "INV-2026-0001", balanceDue: 5000, status: "SENT", contactId: "c-host", booking };
}

function order(body: Record<string, unknown> = { invoiceId: "inv-1", amount: 5000 }) {
  const request = new Request("https://app.test/api/payments/create-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // A portal customer who owns the invoice.
  authMock.mockResolvedValue({ user: { id: "u-host", role: "CLIENT" } });
  db.user.findUnique.mockResolvedValue({ email: "host@example.com" });
  db.contact.findMany.mockResolvedValue([{ id: "c-host" }]);
  ordersCreate.mockResolvedValue({ id: "order_1" });
  db.payment.create.mockResolvedValue({ id: "pay-1" });
});

describe("POST /api/payments/create-order and holds", () => {
  it("reads the booking's hold facts: status, window and money on every invoice", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    await order();

    expect(db.invoice.findUnique.mock.calls[0][0].select.booking).toEqual({ select: HOLD_FACTS_SELECT });
  });

  it("refuses a lapsed hold with the pay links' words, before touching the gateway", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(lapsedHold));

    const res = await order();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: HOLD_LAPSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("refuses a NEW checkout once the window has passed, even while an earlier checkout is in its grace", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(
      invoiceWith({
        id: "b1",
        status: "HOLD",
        holdExpiresAt: minutesAgo(5),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      })
    );

    const res = await order();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    { label: "on hold inside its window", booking: { status: "HOLD", holdExpiresAt: hoursAhead(2), invoices: [unpaid] } },
    {
      label: "on hold inside its window with a checkout already open",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAhead(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      },
    },
    {
      label: "on hold past its window with money on another invoice",
      booking: { status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid, { status: "PARTIALLY_PAID", paidAmount: 10000, payments: [] }] },
    },
    {
      label: "on hold past its window with a payment proof awaiting verification",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAgo(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: hoursAgo(3), createdAt: hoursAgo(3) }] }],
      },
    },
    { label: "already confirmed", booking: { status: "CONFIRMED", holdExpiresAt: hoursAgo(48), invoices: [unpaid] } },
    { label: "on hold with no window", booking: { status: "HOLD", holdExpiresAt: null, invoices: [unpaid] } },
  ])("lets a booking $label pay", async ({ booking }) => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith({ id: "b1", ...booking }));

    const res = await order();

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    expect(db.payment.create).toHaveBeenCalledTimes(1);
  });

  it("an invoice without a booking is unaffected", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    const res = await order();

    expect(res.status).toBe(200);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
  });

  it("someone who doesn't own the invoice still gets 'not found', whatever the hold's state", async () => {
    db.contact.findMany.mockResolvedValueOnce([{ id: "someone-else" }]);
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(lapsedHold));

    const res = await order();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: "Invoice not found" });
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("staff paying through this route are refused the same way", async () => {
    authMock.mockResolvedValue({ user: { id: "u-staff", role: "ACCOUNTANT" } });
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(lapsedHold));

    const res = await order();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: HOLD_LAPSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
  });
});
