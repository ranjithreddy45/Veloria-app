import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// A Razorpay capture that lands on a booking cancelled while the customer paid
// (a checkout left open past its hold's release) is still recorded, and the
// team is alerted exactly once: only the call that credited the payment checks,
// never a webhook re-delivery or the losing side of the verify/webhook race.
// ============================================================

const h = vi.hoisted(() => ({
  db: {
    payment: { findFirst: vi.fn(), findUnique: vi.fn() },
    quoteShareLink: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    payment: { updateMany: vi.fn() },
    invoice: { update: vi.fn() },
    installment: { findMany: vi.fn(), update: vi.fn() },
  },
  alertPaymentOnCancelledBooking: vi.fn(),
  maybeConfirmBookingOnPayment: vi.fn(),
  settleConfiguratorPayment: vi.fn(),
  settleSplitOnCapture: vi.fn(),
  postPaymentReceived: vi.fn(),
  finalizeOneTapBlock: vi.fn(),
  notifyCustomer: vi.fn(),
  reportSystemFailure: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/lib/sales/confirm-booking", () => ({ maybeConfirmBookingOnPayment: h.maybeConfirmBookingOnPayment }));
vi.mock("@/lib/public/settle-configurator", () => ({ settleConfiguratorPayment: h.settleConfiguratorPayment }));
vi.mock("@/lib/finance/receivables", () => ({ postPaymentReceived: h.postPaymentReceived }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: h.reportSystemFailure }));
vi.mock("@/lib/finance/receipt-number", () => ({ allocateReceiptNumber: async () => "RCP-2026-0001" }));
vi.mock("@/lib/sales/quote-onetap", () => ({ finalizeOneTapBlock: h.finalizeOneTapBlock }));
vi.mock("@/lib/payments/split-payments", () => ({ settleSplitOnCapture: h.settleSplitOnCapture }));
vi.mock("@/lib/customer-notify", () => ({ notifyCustomer: h.notifyCustomer }));
vi.mock("@/lib/holds/paid-without-slot", () => ({ alertPaymentOnCancelledBooking: h.alertPaymentOnCancelledBooking }));

import { applyRazorpayCapture } from "./apply-capture";

const PENDING_PAYMENT = { id: "pay-1", amount: 5000, invoiceId: "inv-1", status: "PENDING" };

beforeEach(() => {
  vi.resetAllMocks();
  h.db.$transaction.mockImplementation(async (fn: (tx: typeof h.tx) => unknown) => fn(h.tx));
  h.db.payment.findUnique.mockResolvedValue(null); // the customer notice finds nothing to send
  h.db.quoteShareLink.findFirst.mockResolvedValue(null);
  h.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  h.tx.invoice.update.mockResolvedValueOnce({ totalAmount: 25000, paidAmount: 5000 }).mockResolvedValue({});
  h.tx.installment.findMany.mockResolvedValue([]);
  h.postPaymentReceived.mockResolvedValue(undefined);
  h.settleSplitOnCapture.mockResolvedValue(undefined);
  h.settleConfiguratorPayment.mockResolvedValue(undefined);
  h.maybeConfirmBookingOnPayment.mockResolvedValue(undefined);
  h.alertPaymentOnCancelledBooking.mockResolvedValue(true);
});

describe("applyRazorpayCapture and a booking cancelled while the customer paid", () => {
  it("records the money, runs auto-confirm (HOLD bookings only), then checks for a cancelled booking once", async () => {
    h.db.payment.findFirst.mockResolvedValue(PENDING_PAYMENT);

    const res = await applyRazorpayCapture({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_rzp_1" });

    expect(res).toEqual({ ok: true, invoiceId: "inv-1", alreadyProcessed: false });
    expect(h.tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1" }, data: { paidAmount: { increment: 5000 } } })
    );
    expect(h.alertPaymentOnCancelledBooking).toHaveBeenCalledTimes(1);
    expect(h.alertPaymentOnCancelledBooking).toHaveBeenCalledWith("pay-1");
    expect(h.maybeConfirmBookingOnPayment.mock.invocationCallOrder[0]).toBeLessThan(
      h.alertPaymentOnCancelledBooking.mock.invocationCallOrder[0]
    );
  });

  it("a webhook re-delivery for a payment already completed neither credits nor alerts again", async () => {
    h.db.payment.findFirst.mockResolvedValue({ ...PENDING_PAYMENT, status: "COMPLETED" });

    const res = await applyRazorpayCapture({ razorpayOrderId: "order_1" });

    expect(res).toEqual({ ok: true, invoiceId: "inv-1", alreadyProcessed: true });
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.alertPaymentOnCancelledBooking).not.toHaveBeenCalled();
  });

  it("the path that loses the verify/webhook race does not alert", async () => {
    h.db.payment.findFirst.mockResolvedValue(PENDING_PAYMENT);
    h.tx.payment.updateMany.mockResolvedValue({ count: 0 });

    const res = await applyRazorpayCapture({ razorpayOrderId: "order_1" });

    expect(res).toEqual({ ok: true, invoiceId: "inv-1", alreadyProcessed: true });
    expect(h.alertPaymentOnCancelledBooking).not.toHaveBeenCalled();
  });
});
