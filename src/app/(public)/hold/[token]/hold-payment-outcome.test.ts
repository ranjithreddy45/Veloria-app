import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The paid /hold page reads the booking's outcome the way the /pay result does:
// outcomeBookingState over the booking's hold facts, and "the team has been
// told" only when the alert about a completed payment on the hold's token
// invoice is on record. Prisma is mocked; the rules are real.
// ============================================================

const { db } = vi.hoisted(() => ({
  db: {
    publicHold: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    activityLog: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn() }));

import { getHoldPaymentOutcome } from "./hold-payment-outcome";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { PAID_WITHOUT_SLOT_ACTION } from "@/lib/holds/paid-without-slot";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const tokenPaid = {
  id: "inv-token",
  status: "PAID",
  paidAmount: 5000,
  payments: [{ id: "pay-token", status: "COMPLETED", receiptUploadedAt: null, createdAt: hoursAgo(1) }],
};
const otherInvoice = {
  id: "inv-other",
  status: "PARTIALLY_PAID",
  paidAmount: 20000,
  payments: [{ id: "pay-other", status: "COMPLETED", receiptUploadedAt: null, createdAt: hoursAgo(30) }],
};

function booking(status: string, over: Record<string, unknown> = {}) {
  return { id: "b1", status, holdExpiresAt: hoursAgo(2), invoices: [tokenPaid], ...over };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.publicHold.findUnique.mockResolvedValue({ bookingId: "b1", invoiceId: "inv-token" });
});

describe("getHoldPaymentOutcome", () => {
  it("finds the booking by the hold's token and reads its hold facts, with payment ids", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking("HOLD"));

    await getHoldPaymentOutcome("hold-token-123", NOW);

    expect(db.publicHold.findUnique.mock.calls[0][0].where).toEqual({ token: "hold-token-123" });
    expect(db.booking.findUnique.mock.calls[0][0].where).toEqual({ id: "b1" });
    const select = db.booking.findUnique.mock.calls[0][0].select;
    expect(select).toMatchObject({ id: true, status: true, holdExpiresAt: true });
    expect(select.invoices.select).toMatchObject({ ...HOLD_FACTS_SELECT.invoices.select, id: true });
    expect(select.invoices.select.payments.select).toEqual({ ...HOLD_FACTS_SELECT.invoices.select.payments.select, id: true });
  });

  it("a HOLD with the token paid is LIVE, and no alert is looked up", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking("HOLD"));

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "LIVE", teamAlerted: false });
    expect(db.activityLog.findFirst).not.toHaveBeenCalled();
  });

  it.each(["TENTATIVE", "CONFIRMED", "IN_PROGRESS"])("a %s booking is LIVE", async (status) => {
    db.booking.findUnique.mockResolvedValueOnce(booking(status));

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "LIVE", teamAlerted: false });
  });

  it("a cancelled booking is CANCELLED, and the team's alert about the token payment on record says so", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking("CANCELLED", { invoices: [tokenPaid, otherInvoice] }));
    db.activityLog.findFirst.mockResolvedValueOnce({ id: "log-1" });

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "CANCELLED", teamAlerted: true });
    expect(db.activityLog.findFirst.mock.calls[0][0].where).toEqual({
      entityType: "Payment",
      entityId: "pay-token",
      action: PAID_WITHOUT_SLOT_ACTION.PAYMENT_ON_CANCELLED_BOOKING,
    });
  });

  it("a cancelled booking with no alert on record doesn't claim the team was told", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking("CANCELLED"));
    db.activityLog.findFirst.mockResolvedValueOnce(null);

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "CANCELLED", teamAlerted: false });
  });

  it("a cancelled booking with no completed payment on the token invoice looks nothing up", async () => {
    db.booking.findUnique.mockResolvedValueOnce(
      booking("CANCELLED", { invoices: [{ id: "inv-token", status: "SENT", paidAmount: 0, payments: [] }, otherInvoice] })
    );

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "CANCELLED", teamAlerted: false });
    expect(db.activityLog.findFirst).not.toHaveBeenCalled();
  });

  it("a completed event is INACTIVE", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking("COMPLETED"));

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toEqual({ state: "INACTIVE", teamAlerted: false });
  });

  it("a hold with no booking has no outcome", async () => {
    db.publicHold.findUnique.mockResolvedValueOnce({ bookingId: null, invoiceId: null });

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toBeNull();
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it("a database error gives no outcome rather than a guess", async () => {
    db.booking.findUnique.mockRejectedValueOnce(new Error("db down"));

    expect(await getHoldPaymentOutcome("hold-token-123", NOW)).toBeNull();
  });
});
