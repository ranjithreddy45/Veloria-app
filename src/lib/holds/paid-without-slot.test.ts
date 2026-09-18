import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// A captured payment with no live booking behind it must reach a person, once
// per payment: the browser verify call, the webhook, a webhook re-delivery and
// a retried finalize can all get here. The money itself is never touched.
// Prisma and the notification helpers are stubbed; the lapsed-hold and slot
// rules are real.
// ============================================================

type ActivityRow = { action: string; entityType: string; entityId: string; userId: string };

const h = vi.hoisted(() => ({
  activity: [] as ActivityRow[],
  db: {
    $transaction: vi.fn(),
    payment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
    blackoutDate: { findMany: vi.fn() },
    venue: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
  tx: {
    $executeRaw: vi.fn(),
    activityLog: { findFirst: vi.fn(), create: vi.fn() },
  },
  notifyAwait: vi.fn(),
  reportSystemFailure: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: h.notifyAwait }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: h.reportSystemFailure }));

import { alertOneTapPaidSlotTaken, alertPaymentOnCancelledBooking, PAID_WITHOUT_SLOT_ACTION } from "./paid-without-slot";
import { slotLabel } from "@/lib/sales/slot";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-16T08:00:00.000Z");
const DAY = new Date("2026-10-02T00:00:00.000Z");

type AdminAlert = { area: string; title: string; detail: string; actionUrl: string };
const adminAlert = (i = 0) => h.reportSystemFailure.mock.calls[i][0] as AdminAlert;

function capture(opts: { paymentStatus?: string; bookingStatus?: string } = {}) {
  return {
    id: "pay-1",
    amount: 5000,
    status: opts.paymentStatus ?? "COMPLETED",
    receiptNumber: "RCP-2026-0042",
    invoice: {
      id: "inv-1",
      invoiceNumber: "INV-2026-0007",
      booking: {
        id: "bk-1",
        bookingNumber: "VG-2026-0101",
        status: opts.bookingStatus ?? "CANCELLED",
        date: DAY,
        timeSlot: "EVENING",
        venueId: "venue-1",
        createdById: "rep-1",
        venue: { name: "Grand Hall" },
        contact: { firstName: "Asha", lastName: "Rao" },
      },
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.activity.length = 0;
  h.db.$transaction.mockImplementation(async (fn: (tx: typeof h.tx) => unknown) => fn(h.tx));
  h.tx.$executeRaw.mockResolvedValue(1);
  h.tx.activityLog.findFirst.mockImplementation(
    async ({ where }: { where: { entityType: string; entityId: string; action: string } }) =>
      h.activity.find((a) => a.entityType === where.entityType && a.entityId === where.entityId && a.action === where.action) ?? null
  );
  h.tx.activityLog.create.mockImplementation(async ({ data }: { data: ActivityRow }) => {
    h.activity.push(data);
    return data;
  });
  h.db.booking.findMany.mockResolvedValue([]);
  h.db.blackoutDate.findMany.mockResolvedValue([]);
  h.db.user.findMany.mockResolvedValue([{ id: "rep-1", role: "SALES_EXEC", isActive: true }]);
  h.notifyAwait.mockResolvedValue(undefined);
  h.reportSystemFailure.mockResolvedValue(undefined);
});

describe("alertPaymentOnCancelledBooking", () => {
  it("tells the booking owner and admins what happened and what to do, when the slot is still free", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());

    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(true);

    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    const alert = adminAlert();
    expect(alert.area).toBe("Payments — ACTION NEEDED");
    expect(alert.title).toBe("Payment received on cancelled booking VG-2026-0101");
    expect(alert.detail).toContain("Asha Rao paid ₹5,000 (receipt RCP-2026-0042) on invoice INV-2026-0007");
    expect(alert.detail).toContain(`for booking VG-2026-0101 (Grand Hall, 2 October 2026, ${slotLabel("EVENING")})`);
    expect(alert.detail).toContain("The payment is recorded; the booking was not confirmed.");
    expect(alert.detail).toContain("The slot is still free: re-book the customer");
    expect(alert.detail).toContain("or refund the payment.");
    expect(alert.actionUrl).toBe("/bookings/bk-1");

    expect(h.notifyAwait).toHaveBeenCalledTimes(1);
    expect(h.notifyAwait).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "rep-1", type: "SYSTEM", title: alert.title, message: alert.detail, actionUrl: "/bookings/bk-1" })
    );
    // The once-only claim: an advisory lock on the payment and an audit row.
    expect(h.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(h.activity).toEqual([
      expect.objectContaining({ action: PAID_WITHOUT_SLOT_ACTION.PAYMENT_ON_CANCELLED_BOOKING, entityType: "Payment", entityId: "pay-1", userId: "rep-1" }),
    ]);
    // Never touches the money or the booking.
    expect(h.db.payment.update).not.toHaveBeenCalled();
    expect(h.db.payment.updateMany).not.toHaveBeenCalled();
    expect(h.db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("alerts once per payment: the other capture path, a webhook re-delivery or a retry sends nothing more", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());

    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(true);
    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(false);
    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(false);

    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    expect(h.notifyAwait).toHaveBeenCalledTimes(1);
  });

  it("says the slot is no longer free when another booking now holds it", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());
    h.db.booking.findMany.mockResolvedValue([{ id: "bk-2", status: "CONFIRMED", holdExpiresAt: null, date: DAY, timeSlot: "FULL_DAY" }]);

    await alertPaymentOnCancelledBooking("pay-1", NOW);

    expect(adminAlert().detail).toContain("The slot is no longer free: offer the customer another date or hall, or refund the payment.");
  });

  it("says the slot is no longer free when it has been blacked out", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());
    h.db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, timeSlot: null }]);

    await alertPaymentOnCancelledBooking("pay-1", NOW);

    expect(adminAlert().detail).toContain("The slot is no longer free");
  });

  it("does not count a lapsed hold on the slot as taking it", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());
    h.db.booking.findMany
      .mockResolvedValueOnce([{ id: "hold-9", status: "HOLD", holdExpiresAt: PAST, date: DAY, timeSlot: "EVENING" }])
      .mockResolvedValueOnce([{ id: "hold-9", status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] }]);

    await alertPaymentOnCancelledBooking("pay-1", NOW);

    expect(adminAlert().detail).toContain("The slot is still free");
  });

  it("does nothing for a booking that is not cancelled, or a payment that has not completed", async () => {
    for (const bookingStatus of ["HOLD", "CONFIRMED", "TENTATIVE"]) {
      h.db.payment.findUnique.mockResolvedValue(capture({ bookingStatus }));
      expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(false);
    }
    h.db.payment.findUnique.mockResolvedValue(capture({ paymentStatus: "PENDING" }));
    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(false);

    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.reportSystemFailure).not.toHaveBeenCalled();
    expect(h.notifyAwait).not.toHaveBeenCalled();
  });

  it("still alerts when the once-only claim itself fails (a duplicate beats silence)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.db.payment.findUnique.mockResolvedValue(capture());
    h.db.$transaction.mockRejectedValueOnce(new Error("connection lost"));

    expect(await alertPaymentOnCancelledBooking("pay-1", NOW)).toBe(true);

    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[PAID_WITHOUT_SLOT_CLAIM_ERROR]", expect.any(Error));
    spy.mockRestore();
  });

  it("an owner who is an admin hears it once, through the admin alert", async () => {
    h.db.payment.findUnique.mockResolvedValue(capture());
    h.db.user.findMany.mockResolvedValue([{ id: "rep-1", role: "ADMIN", isActive: true }]);

    await alertPaymentOnCancelledBooking("pay-1", NOW);

    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    expect(h.notifyAwait).not.toHaveBeenCalled();
  });
});

describe("alertOneTapPaidSlotTaken", () => {
  const input = {
    quotationId: "q-1",
    quoteNumber: "VG-Q-00012",
    customerName: "Asha Rao",
    invoiceId: "inv-1",
    venueId: "venue-1",
    date: DAY,
    timeSlot: "EVENING",
    ownerIds: ["rep-q", "rep-link", null],
  };

  beforeEach(() => {
    h.db.venue.findUnique.mockResolvedValue({ name: "Grand Hall" });
    h.db.user.findMany.mockResolvedValue([
      { id: "rep-q", role: "SALES_EXEC", isActive: true },
      { id: "rep-link", role: "SALES_HEAD", isActive: true },
    ]);
  });

  it("alerts the quote's owners and admins with the quote, customer, hall, date, slot, amount and next step, once per payment", async () => {
    h.db.payment.findMany.mockResolvedValue([
      { id: "pay-a", amount: 20000, receiptNumber: "RCP-2026-0042", invoice: { invoiceNumber: "INV-2026-0007" } },
    ]);

    expect(await alertOneTapPaidSlotTaken(input)).toBe(1);
    expect(await alertOneTapPaidSlotTaken(input)).toBe(0); // webhook re-delivery or a retried confirm

    expect(h.db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { invoiceId: "inv-1", status: "COMPLETED" } }));
    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    const alert = adminAlert();
    expect(alert.title).toBe("Paid quote VG-Q-00012: slot taken, no booking created");
    expect(alert.detail).toContain("Asha Rao paid ₹20,000 (receipt RCP-2026-0042) on quote VG-Q-00012");
    expect(alert.detail).toContain(`for Grand Hall, 2 October 2026, ${slotLabel("EVENING")}, but that slot was already taken`);
    expect(alert.detail).toContain("The payment is recorded on invoice INV-2026-0007.");
    expect(alert.detail).toContain("Re-book the customer on another date or hall, or refund the payment.");
    expect(alert.actionUrl).toBe("/quotations/q-1");

    const told = h.notifyAwait.mock.calls.map(([n]) => (n as { userId: string }).userId).sort();
    expect(told).toEqual(["rep-link", "rep-q"]);
    expect(h.activity).toEqual([
      expect.objectContaining({ action: PAID_WITHOUT_SLOT_ACTION.ONE_TAP_SLOT_TAKEN, entityType: "Payment", entityId: "pay-a" }),
    ]);
  });

  it("alerts separately for each completed payment on the advance invoice", async () => {
    h.db.payment.findMany.mockResolvedValue([
      { id: "pay-a", amount: 10000, receiptNumber: null, invoice: { invoiceNumber: "INV-2026-0007" } },
      { id: "pay-b", amount: 10000, receiptNumber: null, invoice: { invoiceNumber: "INV-2026-0007" } },
    ]);

    expect(await alertOneTapPaidSlotTaken(input)).toBe(2);
    expect(h.reportSystemFailure).toHaveBeenCalledTimes(2);
  });

  it("sends nothing while the advance has not been paid", async () => {
    h.db.payment.findMany.mockResolvedValue([]);

    expect(await alertOneTapPaidSlotTaken(input)).toBe(0);
    expect(h.reportSystemFailure).not.toHaveBeenCalled();
    expect(h.notifyAwait).not.toHaveBeenCalled();
  });
});
