import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// getPublicPaymentOutcome reports whether the paid-for booking is live, so the
// /pay outcome offers "Open your event in the app" and "Add to calendar" only
// for a booking that is on. A payment on a cancelled booking is marked
// CANCELLED, gets no calendar link, and says the team knows only when the
// team's alert about that payment is on record. Prisma is mocked.
// ============================================================

const { db } = vi.hoisted(() => ({
  db: {
    payment: { findFirst: vi.fn() },
    activityLog: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn() }));

import { getPublicPaymentOutcome } from "./outcome.actions";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { PAID_WITHOUT_SLOT_ACTION } from "@/lib/holds/paid-without-slot";

const IDS = { razorpayOrderId: "order_Abc123XYZ", razorpayPaymentId: "pay_Abc123XYZ" };

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

function bookingRow(status: string, over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    status,
    holdExpiresAt: null,
    eventName: "Reception",
    date: new Date("2026-12-10T00:00:00.000Z"),
    // The payment just captured is on this invoice.
    invoices: [{ status: "PARTIALLY_PAID", paidAmount: 5000, payments: [{ status: "COMPLETED", receiptUploadedAt: null, createdAt: new Date() }] }],
    ...over,
  };
}

function paymentRow(booking: Record<string, unknown> | null) {
  return {
    id: "payment-db-1",
    amount: 5000,
    receiptNumber: "RCPT-2026-0007",
    paidAt: new Date("2026-09-16T09:00:00.000Z"),
    invoice: { invoiceNumber: "INV-2026-0001", status: "PARTIALLY_PAID", balanceDue: 5000, booking },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-calendar-secret";
});

describe("getPublicPaymentOutcome: is the booking live?", () => {
  it("reads the booking's hold facts, so a HOLD is judged by the one hold rule", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("CONFIRMED")));

    await getPublicPaymentOutcome(IDS);

    const select = db.payment.findFirst.mock.calls[0][0].select.invoice.select.booking.select;
    expect(select).toMatchObject({ ...HOLD_FACTS_SELECT, eventName: true, date: true });
  });

  it.each(["TENTATIVE", "CONFIRMED", "IN_PROGRESS"])("a %s booking is LIVE, with a calendar link", async (status) => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow(status)));

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success && res.data.booking?.state).toBe("LIVE");
    expect(res.success && res.data.booking?.calendarUrl).toMatch(/^\/api\/guest\/calendar\/b1\?t=/);
    expect(db.activityLog.findFirst).not.toHaveBeenCalled();
  });

  it("a HOLD with this payment against it is LIVE", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("HOLD", { holdExpiresAt: hoursAgo(1) })));

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success && res.data.booking?.state).toBe("LIVE");
  });

  it("a cancelled booking is CANCELLED, with no calendar link, and the team's alert on record says so", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("CANCELLED")));
    db.activityLog.findFirst.mockResolvedValueOnce({ id: "log-1" });

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.booking).toMatchObject({ state: "CANCELLED", teamAlerted: true, calendarUrl: null, statusLabel: "Cancelled" });
    expect(db.activityLog.findFirst.mock.calls[0][0].where).toEqual({
      entityType: "Payment",
      entityId: "payment-db-1",
      action: PAID_WITHOUT_SLOT_ACTION.PAYMENT_ON_CANCELLED_BOOKING,
    });
  });

  it("a cancelled booking with no alert on record doesn't claim the team was told", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("CANCELLED")));
    db.activityLog.findFirst.mockResolvedValueOnce(null);

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success && res.data.booking).toMatchObject({ state: "CANCELLED", teamAlerted: false });
  });

  it("an alert lookup that fails still returns the receipt, without claiming the team was told", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("CANCELLED")));
    db.activityLog.findFirst.mockRejectedValueOnce(new Error("db down"));

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success).toBe(true);
    expect(res.success && res.data.booking).toMatchObject({ state: "CANCELLED", teamAlerted: false });
    expect(res.success && res.data.receiptNumber).toBe("RCPT-2026-0007");
  });

  it("a completed event is INACTIVE, with no calendar link", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(bookingRow("COMPLETED")));

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success && res.data.booking).toMatchObject({ state: "INACTIVE", calendarUrl: null });
  });

  it("an invoice with no booking has no booking in the outcome", async () => {
    db.payment.findFirst.mockResolvedValueOnce(paymentRow(null));

    const res = await getPublicPaymentOutcome(IDS);

    expect(res.success && res.data.booking).toBeNull();
  });
});
