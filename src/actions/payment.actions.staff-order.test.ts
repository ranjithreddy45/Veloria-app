import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// The team's payment actions.
//
// createRazorpayOrder applies the pay links' hold rule: no checkout on a lapsed
// hold, and no NEW checkout once the hold's window has passed unless money that
// doesn't rely on a checkout's 15-minute grace is already against the booking.
// The team is told to extend the hold or start a new one.
//
// generatePaymentLink creates a pay link only for an owed invoice (SENT,
// PARTIALLY_PAID or OVERDUE): never a draft, and never a refunded invoice whose
// refund put balanceDue back.
// ============================================================

const { db, ordersCreate, authMock } = vi.hoisted(() => ({
  db: {
    invoice: { findUnique: vi.fn() },
    payment: { create: vi.fn() },
  },
  ordersCreate: vi.fn(),
  authMock: vi.fn(),
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
  notifyCustomerOfPayment: vi.fn(),
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

import { createRazorpayOrder, generatePaymentLink } from "./payment.actions";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { STAFF_HOLD_CHECKOUT_ERROR } from "@/lib/holds/checkout-guard";

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

const unpaid = { status: "SENT", paidAmount: 0, payments: [] };

function invoiceWith(booking: Record<string, unknown> | null, over: Record<string, unknown> = {}) {
  return { id: "inv-1", invoiceNumber: "INV-2026-0001", balanceDue: 5000, status: "SENT", booking, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "staff-1", role: "ACCOUNTANT" } });
  ordersCreate.mockResolvedValue({ id: "order_1" });
  db.payment.create.mockResolvedValue({ id: "pay-1" });
});

describe("the team's createRazorpayOrder and holds", () => {
  it("reads the booking's hold facts: status, window and money on every invoice", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    await createRazorpayOrder("inv-1", 5000);

    expect(db.invoice.findUnique.mock.calls[0][0].select.booking).toEqual({ select: HOLD_FACTS_SELECT });
  });

  it("refuses a lapsed hold before touching the gateway, and tells the team to extend it or start a new one", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(
      invoiceWith({ id: "b1", status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid] })
    );

    const res = await createRazorpayOrder("inv-1", 5000);

    expect(res).toEqual({ success: false, error: STAFF_HOLD_CHECKOUT_ERROR.HOLD_LAPSED });
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

    const res = await createRazorpayOrder("inv-1", 5000);

    expect(res).toEqual({ success: false, error: STAFF_HOLD_CHECKOUT_ERROR.HOLD_WINDOW_CLOSED });
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    { label: "on hold inside its window", booking: { status: "HOLD", holdExpiresAt: hoursAhead(2), invoices: [unpaid] } },
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
  ])("lets the team take a payment on a booking $label", async ({ booking }) => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith({ id: "b1", ...booking }));

    const res = await createRazorpayOrder("inv-1", 5000);

    expect(res.success).toBe(true);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
    expect(ordersCreate.mock.calls[0][0].amount).toBe(500000);
    expect(db.payment.create).toHaveBeenCalledTimes(1);
  });

  it("an invoice without a booking is unaffected", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null));

    expect((await createRazorpayOrder("inv-1", 5000)).success).toBe(true);
    expect(ordersCreate).toHaveBeenCalledTimes(1);
  });

  it("still refuses a paid invoice with its existing message", async () => {
    db.invoice.findUnique.mockResolvedValueOnce(invoiceWith(null, { status: "PAID", balanceDue: 0 }));

    expect(await createRazorpayOrder("inv-1", 5000)).toEqual({ success: false, error: "Cannot create payment for this invoice" });
    expect(ordersCreate).not.toHaveBeenCalled();
  });
});

describe("generatePaymentLink only for an owed invoice", () => {
  function linkInvoice(status: string, balanceDue: number) {
    return {
      id: "inv-1",
      invoiceNumber: "INV-2026-0001",
      totalAmount: 118000,
      balanceDue,
      status,
      contact: { firstName: "Priya", lastName: "Sharma", email: "priya@example.com", phone: "9876543210" },
    };
  }

  it.each([
    { status: "DRAFT", error: "This invoice is still a draft. Send it to the customer before creating a payment link." },
    { status: "REFUNDED", error: "This invoice has been refunded and is closed, so a payment link can't be created for it." },
  ])("refuses a $status invoice, though its balanceDue is set", async ({ status, error }) => {
    db.invoice.findUnique.mockResolvedValueOnce(linkInvoice(status, 118000));

    expect(await generatePaymentLink("inv-1")).toEqual({ success: false, error });
  });

  it.each(["PAID", "CANCELLED"])("still refuses a %s invoice with its existing message", async (status) => {
    db.invoice.findUnique.mockResolvedValueOnce(linkInvoice(status, 0));

    expect(await generatePaymentLink("inv-1")).toEqual({ success: false, error: `Cannot generate link for ${status} invoice` });
  });

  it.each(["SENT", "PARTIALLY_PAID", "OVERDUE"])("creates a link for a %s invoice with a balance", async (status) => {
    db.invoice.findUnique.mockResolvedValueOnce(linkInvoice(status, 50000));

    const res = await generatePaymentLink("inv-1", { percent: 100 });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amount).toBe(50000);
      expect(res.data.shortUrl).toMatch(/\/pay\/inv-1\?amt=50000$/);
    }
  });
});
