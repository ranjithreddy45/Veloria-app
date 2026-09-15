import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// createPublicRazorpayOrder must not open a checkout for a hold that has
// LAPSED (window passed, no money on any invoice, no checkout in flight): the
// team's availability board and the customer's calendar already show that date
// as free. Nor may it open a NEW checkout once the window has passed unless
// money that doesn't depend on a checkout's grace is already against the
// booking: every order restarts that grace, so the hold would never lapse.
//
// recordPayment and verifyPaymentProof send the customer's payment notice once,
// after the payment has committed, without waiting for delivery.
// ============================================================

const { db, tx, ordersCreate, authMock, notifyCustomerOfPayment } = vi.hoisted(() => ({
  db: {
    invoice: { findUnique: vi.fn() },
    payment: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    payment: { create: vi.fn(), updateMany: vi.fn() },
    invoice: { update: vi.fn() },
  },
  ordersCreate: vi.fn(),
  authMock: vi.fn(),
  notifyCustomerOfPayment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/velos/triggers", () => ({ velosOnPaymentCollected: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates/payment-received", () => ({ paymentReceivedEmail: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/sales/confirm-booking", () => ({ maybeConfirmBookingOnPayment: vi.fn() }));
vi.mock("@/lib/payments/apply-capture", () => ({
  applyRazorpayCapture: vi.fn(),
  allocatePaidAmountToInstallments: vi.fn(),
  notifyCustomerOfPayment,
}));
vi.mock("@/lib/payments/razorpay-creds", () => ({
  razorpayKeyId: () => "rzp_test_key",
  razorpayKeySecret: () => "rzp_test_secret",
  razorpayConfigured: () => true,
  razorpayWebhookSecret: () => "rzp_test_webhook",
}));
vi.mock("@/lib/finance/receivables", () => ({ postPaymentReceived: vi.fn() }));
vi.mock("@/lib/finance/receipt-number", () => ({ allocateReceiptNumber: vi.fn() }));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate };
  },
}));

import { createPublicRazorpayOrder, recordPayment, verifyPaymentProof } from "./payment.actions";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { HOLD_WINDOW_CLOSED_CHECKOUT_ERROR } from "@/lib/holds/checkout-guard";

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

const unpaidToken = { status: "SENT", paidAmount: 0, payments: [] };

function invoiceWith(booking: Record<string, unknown> | null) {
  return { id: "inv-1", invoiceNumber: "INV-2026-0001", balanceDue: 5000, status: "SENT", booking };
}

beforeEach(() => {
  vi.clearAllMocks();
  ordersCreate.mockResolvedValue({ id: "order_1" });
  db.payment.create.mockResolvedValue({ id: "pay-1" });
});

describe("createPublicRazorpayOrder and lapsed holds", () => {
  it("reads the booking's hold facts: status, window and money on every invoice", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    await createPublicRazorpayOrder("inv-1", 5000);

    expect(db.invoice.findUnique.mock.calls[0][0].select.booking).toEqual({ select: HOLD_FACTS_SELECT });
  });

  it("refuses a lapsed hold before touching the gateway", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(
      invoiceWith({ id: "b1", status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaidToken] })
    );

    const res = await createPublicRazorpayOrder("inv-1", 5000);

    expect(res).toEqual({
      success: false,
      error: "This hold has lapsed, so the date is no longer reserved. Please start again.",
    });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    { label: "inside its window", booking: { status: "HOLD", holdExpiresAt: hoursAhead(2), invoices: [unpaidToken] } },
    {
      label: "inside its window with a checkout already open",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAhead(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      },
    },
    {
      label: "past its window with money on another invoice",
      booking: { status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaidToken, { status: "PARTIALLY_PAID", paidAmount: 10000, payments: [] }] },
    },
    {
      label: "past its window with a payment proof awaiting verification",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAgo(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: hoursAgo(3), createdAt: hoursAgo(3) }] }],
      },
    },
    {
      label: "past its window with a payment processing at the gateway",
      booking: {
        status: "HOLD",
        holdExpiresAt: hoursAgo(2),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PROCESSING", receiptUploadedAt: null, createdAt: hoursAgo(1) }] }],
      },
    },
    { label: "already confirmed", booking: { status: "CONFIRMED", holdExpiresAt: hoursAgo(48), invoices: [unpaidToken] } },
    { label: "with no hold window", booking: { status: "HOLD", holdExpiresAt: null, invoices: [unpaidToken] } },
  ])("lets a booking $label pay", async ({ booking }) => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith({ id: "b1", ...booking }));

    const res = await createPublicRazorpayOrder("inv-1", 5000);

    expect(res.success).toBe(true);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    expect(db.payment.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a NEW checkout once the window has passed, even while an earlier checkout is in its grace", async () => {
    // Before this rule every new order restarted the 15-minute grace, so
    // reopening checkout could hold an expired date indefinitely.
    db.invoice.findUnique.mockResolvedValueOnce(
      invoiceWith({
        id: "b1",
        status: "HOLD",
        holdExpiresAt: minutesAgo(5),
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      })
    );

    const res = await createPublicRazorpayOrder("inv-1", 5000);

    expect(res).toEqual({ success: false, error: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("still refuses a cancelled booking with its existing message", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(
      invoiceWith({ id: "b1", status: "CANCELLED", holdExpiresAt: hoursAgo(2), invoices: [unpaidToken] })
    );

    const res = await createPublicRazorpayOrder("inv-1", 5000);

    expect(res).toEqual({
      success: false,
      error: "This hold has expired and the date is no longer reserved. Please request a fresh link.",
    });
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("an invoice without a booking is unaffected", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    const res = await createPublicRazorpayOrder("inv-1", 5000);

    expect(res.success).toBe(true);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
  });
});

// ---- Customer payment notices, and money only against owed invoices -------

describe("recordPayment and verifyPaymentProof", () => {
  const events: string[] = [];
  const proof = { id: "pay-proof", status: "PENDING", receiptUrl: "https://example.com/proof.png", receiptNumber: null, amount: 5000 };

  beforeEach(() => {
    events.length = 0;
    authMock.mockResolvedValue({ user: { id: "staff-1", role: "ACCOUNTANT" } });
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => {
      const result = await fn(tx);
      events.push("commit");
      return result;
    });
    // Never settles: the actions must not wait for the notice to be delivered.
    notifyCustomerOfPayment.mockImplementation(() => {
      events.push("notice");
      return new Promise<number>(() => {});
    });
  });

  it("recordPayment tells the customer once, after the payment commits, without waiting for delivery", async () => {
    db.invoice.findUnique
      .mockResolvedValueOnce({ id: "inv-1", totalAmount: 10000, paidAmount: 5000, balanceDue: 5000, status: "PARTIALLY_PAID", dueDate: null })
      .mockResolvedValueOnce(null); // the receipt e-mail lookup
    tx.payment.create.mockResolvedValueOnce({ id: "pay-manual" });
    tx.invoice.update.mockResolvedValueOnce({ totalAmount: 10000, paidAmount: 10000 }).mockResolvedValueOnce({});

    const res = await recordPayment({ invoiceId: "inv-1", amount: 5000, method: "CASH" });

    expect(res.success).toBe(true);
    expect(notifyCustomerOfPayment).toHaveBeenCalledTimes(1);
    expect(notifyCustomerOfPayment).toHaveBeenCalledWith("pay-manual");
    expect(events).toEqual(["commit", "notice"]);
  });

  it("recordPayment sends no notice when the payment does not commit", async () => {
    db.invoice.findUnique.mockResolvedValueOnce({ id: "inv-1", totalAmount: 10000, paidAmount: 5000, balanceDue: 5000, status: "PARTIALLY_PAID", dueDate: null });
    tx.payment.create.mockResolvedValueOnce({ id: "pay-manual" });
    tx.invoice.update.mockResolvedValueOnce({ totalAmount: 10000, paidAmount: 10500 }); // another payment landed first

    const res = await recordPayment({ invoiceId: "inv-1", amount: 5000, method: "CASH" });

    expect(res.success).toBe(false);
    expect(notifyCustomerOfPayment).not.toHaveBeenCalled();
  });

  it.each([
    { status: "DRAFT", error: "Invoice must be sent before a payment can be recorded" },
    { status: "REFUNDED", error: "Invoice must be sent before a payment can be recorded" },
    { status: "PAID", error: "Invoice is already fully paid" },
    { status: "CANCELLED", error: "Cannot record payment for cancelled invoice" },
  ])("recordPayment refuses a $status invoice (not owed)", async ({ status, error }) => {
    db.invoice.findUnique.mockResolvedValueOnce({ id: "inv-1", totalAmount: 10000, paidAmount: 0, balanceDue: 10000, status, dueDate: null });

    expect(await recordPayment({ invoiceId: "inv-1", amount: 5000, method: "CASH" })).toEqual({ success: false, error });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("verifyPaymentProof tells the customer once, after the verification commits", async () => {
    db.payment.findUnique.mockResolvedValueOnce({ ...proof, invoice: { id: "inv-1", status: "SENT" } });
    tx.payment.updateMany.mockResolvedValueOnce({ count: 1 });
    tx.invoice.update.mockResolvedValueOnce({ totalAmount: 10000, paidAmount: 5000 }).mockResolvedValueOnce({});

    const res = await verifyPaymentProof("pay-proof");

    expect(res.success).toBe(true);
    expect(notifyCustomerOfPayment).toHaveBeenCalledTimes(1);
    expect(notifyCustomerOfPayment).toHaveBeenCalledWith("pay-proof");
    expect(events).toEqual(["commit", "notice"]);
  });

  it("verifying a proof someone else just verified sends no second notice", async () => {
    db.payment.findUnique.mockResolvedValueOnce({ ...proof, invoice: { id: "inv-1", status: "SENT" } });
    tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await verifyPaymentProof("pay-proof")).toEqual({ success: false, error: "This payment was just verified by someone else" });
    expect(notifyCustomerOfPayment).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "REFUNDED"])("verifyPaymentProof refuses a proof on a %s invoice (not owed)", async (status) => {
    db.payment.findUnique.mockResolvedValueOnce({ ...proof, invoice: { id: "inv-1", status } });

    const res = await verifyPaymentProof("pay-proof");

    expect(res.success).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(notifyCustomerOfPayment).not.toHaveBeenCalled();
  });
});
