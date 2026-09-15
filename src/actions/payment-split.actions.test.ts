import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// createSplitRazorpayOrder applies the invoice link's hold rules, in its words:
// a LAPSED hold is refused before any open order is reused, and once the window
// has passed a NEW order is refused unless money that doesn't depend on a
// checkout's grace is against the booking. Reopening this share's own open
// order is still allowed: it starts no new grace.
// ============================================================

const { db, ordersCreate } = vi.hoisted(() => ({
  db: {
    paymentSplit: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    invoice: { findUnique: vi.fn() },
    payment: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  ordersCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn() }));
vi.mock("@/lib/payments/razorpay-creds", () => ({
  razorpayConfigured: () => true,
  razorpayKeyId: () => "rzp_test_key",
  razorpayKeySecret: () => "rzp_test_secret",
}));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate };
  },
}));

import { createSplitRazorpayOrder } from "./payment-split.actions";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { HOLD_LAPSED_CHECKOUT_ERROR, HOLD_WINDOW_CLOSED_CHECKOUT_ERROR } from "@/lib/holds/checkout-guard";

const TOKEN = "tok_abcdefghijklmnop1234";
const hoursAgo = (hrs: number) => new Date(Date.now() - hrs * 60 * 60 * 1000);
const hoursAhead = (hrs: number) => new Date(Date.now() + hrs * 60 * 60 * 1000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

const unpaid = { status: "SENT", paidAmount: 0, payments: [] };

function split(overrides: Record<string, unknown> = {}) {
  return {
    id: "split-1",
    token: TOKEN,
    status: "PENDING",
    expiresAt: hoursAhead(24 * 7),
    amountPaise: 500000,
    invoiceId: "inv-1",
    parentLinkId: "inv-1",
    razorpayOrderId: null,
    payerName: "Ravi",
    ...overrides,
  };
}

function invoiceWith(booking: Record<string, unknown> | null) {
  return { id: "inv-1", invoiceNumber: "INV-2026-0001", status: "SENT", balanceDue: 20000, booking };
}

const NEW_ORDER = { success: true, data: { orderId: "order_new", amount: 500000, currency: "INR", keyId: "rzp_test_key" } };

beforeEach(() => {
  vi.resetAllMocks();
  db.paymentSplit.findUnique.mockResolvedValue(split());
  db.paymentSplit.findMany.mockResolvedValue([{ amountPaise: 500000, status: "PENDING", expiresAt: hoursAhead(24 * 7) }]);
  db.paymentSplit.update.mockResolvedValue({});
  db.payment.create.mockResolvedValue({ id: "pay-new" });
  db.$transaction.mockImplementation(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops));
  ordersCreate.mockResolvedValue({ id: "order_new" });
});

describe("createSplitRazorpayOrder and hold windows", () => {
  it("reads the booking's hold facts: status, window and money on every invoice", async () => {
    db.invoice.findUnique.mockResolvedValue(invoiceWith(null));

    expect(await createSplitRazorpayOrder(TOKEN)).toEqual(NEW_ORDER);
    expect(db.invoice.findUnique.mock.calls[0][0].select.booking).toEqual({ select: HOLD_FACTS_SELECT });
  });

  it("refuses a lapsed hold with the invoice link's words, before reusing an open order", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_old" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith({ id: "b1", status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid] }));

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({ success: false, error: HOLD_LAPSED_CHECKOUT_ERROR });
    expect(HOLD_LAPSED_CHECKOUT_ERROR).toBe("This hold has lapsed, so the date is no longer reserved. Please start again.");
    expect(db.payment.findFirst).not.toHaveBeenCalled();
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("refuses a NEW order after the window, even while another payer's checkout is still in its grace", async () => {
    db.invoice.findUnique.mockResolvedValue(
      invoiceWith({
        id: "b1",
        status: "HOLD",
        holdExpiresAt: minutesAgo(5),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      })
    );

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("still lets this payer reopen their own checkout, started before the window closed", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(
      invoiceWith({
        id: "b1",
        status: "HOLD",
        holdExpiresAt: minutesAgo(5),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(9) }] }],
      })
    );
    db.payment.findFirst.mockResolvedValue({ amount: 5000 });

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({ success: true, data: { orderId: "order_open", amount: 500000, currency: "INR", keyId: "rzp_test_key" } });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    { label: "inside its window", booking: { status: "HOLD", holdExpiresAt: hoursAhead(2), invoices: [unpaid] } },
    {
      label: "past its window with money on another invoice",
      booking: { status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid, { status: "PARTIALLY_PAID", paidAmount: 10000, payments: [] }] },
    },
    {
      label: "past its window with a payment proof awaiting verification",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAgo(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: hoursAgo(3), createdAt: hoursAgo(3) }] }],
      },
    },
    { label: "already confirmed", booking: { status: "CONFIRMED", holdExpiresAt: hoursAgo(48), invoices: [unpaid] } },
    { label: "with no hold window", booking: { status: "HOLD", holdExpiresAt: null, invoices: [unpaid] } },
  ])("opens a new order for a booking $label", async ({ booking }) => {
    db.invoice.findUnique.mockResolvedValue(invoiceWith({ id: "b1", ...booking }));

    expect(await createSplitRazorpayOrder(TOKEN)).toEqual(NEW_ORDER);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    expect(db.payment.create).toHaveBeenCalledTimes(1);
  });

  it("a cancelled booking keeps its own message", async () => {
    db.invoice.findUnique.mockResolvedValue(invoiceWith({ id: "b1", status: "CANCELLED", holdExpiresAt: hoursAgo(2), invoices: [unpaid] }));

    expect(await createSplitRazorpayOrder(TOKEN)).toEqual({
      success: false,
      error: "This booking has been cancelled and the date is no longer reserved. Please contact the host.",
    });
    expect(ordersCreate).not.toHaveBeenCalled();
  });
});
