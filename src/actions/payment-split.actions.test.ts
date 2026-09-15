import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// createSplitRazorpayOrder applies the invoice link's hold rules, in its words:
// a LAPSED hold is refused before any open order is reused, and once the window
// has passed a NEW order is refused unless money that doesn't depend on a
// checkout's grace is against the booking. Reopening this share's own open
// order starts no new grace, so it is allowed only while that order has at least
// four minutes of its 15-minute protection left, and the checkout is told to
// close a minute before the protection ends.
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
// Each test freezes the clock at the moment this file loaded, so the protection
// left on an open order is exact, and the it.each tables (built with the real
// clock while tests are collected) still sit where they say relative to it.
const NOW = new Date();
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

/** A HOLD whose only protection is this share's checkout, started at `createdAt`. */
function keptByCheckout(holdExpiresAt: Date, createdAt: Date) {
  return {
    id: "b1",
    status: "HOLD",
    holdExpiresAt,
    invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt }] }],
  };
}

const NEW_ORDER = { success: true, data: { orderId: "order_new", amount: 500000, currency: "INR", keyId: "rzp_test_key" } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db.paymentSplit.findUnique.mockResolvedValue(split());
  db.paymentSplit.findMany.mockResolvedValue([{ amountPaise: 500000, status: "PENDING", expiresAt: hoursAhead(24 * 7) }]);
  db.paymentSplit.update.mockResolvedValue({});
  db.payment.create.mockResolvedValue({ id: "pay-new" });
  db.$transaction.mockImplementation(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops));
  ordersCreate.mockResolvedValue({ id: "order_new" });
});

afterEach(() => {
  vi.useRealTimers();
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
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(minutesAgo(5), minutesAgo(3))));

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("still lets this payer reopen their own checkout, started before the window closed, for the protection it has left", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(minutesAgo(5), minutesAgo(9))));
    db.payment.findFirst.mockResolvedValue({ amount: 5000, createdAt: minutesAgo(9) });

    const res = await createSplitRazorpayOrder(TOKEN);

    // 6 of the order's 15 minutes are left: its checkout closes a minute before they run out.
    expect(res).toEqual({
      success: true,
      data: { orderId: "order_open", amount: 500000, currency: "INR", keyId: "rzp_test_key", checkoutTimeoutSeconds: 300 },
    });
    expect(db.payment.findFirst.mock.calls[0][0].select).toMatchObject({ amount: true, createdAt: true });
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

describe("createSplitRazorpayOrder reopening this share's open order", () => {
  it("reopens an order with exactly four minutes of protection left, for three minutes", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(minutesAgo(5), minutesAgo(11))));
    db.payment.findFirst.mockResolvedValue({ amount: 5000, createdAt: minutesAgo(11) });

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({
      success: true,
      data: { orderId: "order_open", amount: 500000, currency: "INR", keyId: "rzp_test_key", checkoutTimeoutSeconds: 180 },
    });
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("past the window, refuses rather than reopen an order with under four minutes left, in the invoice link's words", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(minutesAgo(5), minutesAgo(12))));
    db.payment.findFirst.mockResolvedValue({ amount: 5000, createdAt: minutesAgo(12) });

    const res = await createSplitRazorpayOrder(TOKEN);

    expect(res).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(db.paymentSplit.update).not.toHaveBeenCalled();
  });

  it("inside the window, opens a new order instead of reopening one with under four minutes left", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(hoursAhead(2), minutesAgo(12))));
    db.payment.findFirst.mockResolvedValue({ amount: 5000, createdAt: minutesAgo(12) });

    const res = await createSplitRazorpayOrder(TOKEN);

    // A new order gets the full protection, so no shortened timeout comes back.
    expect(res).toEqual(NEW_ORDER);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    expect(db.payment.create).toHaveBeenCalledTimes(1);
    expect(db.paymentSplit.update).toHaveBeenCalledWith({ where: { id: "split-1" }, data: { razorpayOrderId: "order_new" } });
  });

  it("an open order for a different amount is never reopened; past the window no new order opens either", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith(keptByCheckout(minutesAgo(5), minutesAgo(2))));
    db.payment.findFirst.mockResolvedValue({ amount: 4000, createdAt: minutesAgo(2) });

    expect(await createSplitRazorpayOrder(TOKEN)).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("a stale open order on a confirmed booking is replaced by a new order", async () => {
    db.paymentSplit.findUnique.mockResolvedValue(split({ razorpayOrderId: "order_open" }));
    db.invoice.findUnique.mockResolvedValue(invoiceWith({ id: "b1", status: "CONFIRMED", holdExpiresAt: null, invoices: [unpaid] }));
    db.payment.findFirst.mockResolvedValue({ amount: 5000, createdAt: minutesAgo(30) });

    expect(await createSplitRazorpayOrder(TOKEN)).toEqual(NEW_ORDER);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
  });
});
