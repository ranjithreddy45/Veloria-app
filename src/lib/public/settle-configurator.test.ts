import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// A paid configurator advance must not be blocked by a LAPSED hold on its slot:
// the shared release runs before the clash-guarded transaction. A hold that
// gained money is kept, so the transaction refuses and the refund/re-offer
// alert fires — and a failing release never swallows that alert.
// ============================================================

const { db, mocks } = vi.hoisted(() => {
  const database = {
    publicQuoteDraft: { findFirst: vi.fn(), updateMany: vi.fn() },
    contact: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    booking: { findMany: vi.fn(), create: vi.fn() },
    invoice: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    db: database,
    mocks: {
      reportSystemFailure: vi.fn(),
      publicConfiguratorSlotFree: vi.fn(),
      generateBookingNumber: vi.fn(),
      maybeConfirmBookingOnPayment: vi.fn(),
      getSystemUserId: vi.fn(),
      releaseLapsedHoldsForSlot: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: mocks.reportSystemFailure }));
vi.mock("@/actions/public-hold.actions", () => ({ publicConfiguratorSlotFree: mocks.publicConfiguratorSlotFree }));
vi.mock("@/actions/booking.actions", () => ({ generateBookingNumber: mocks.generateBookingNumber }));
vi.mock("@/lib/sales/confirm-booking", () => ({ maybeConfirmBookingOnPayment: mocks.maybeConfirmBookingOnPayment }));
vi.mock("@/lib/lead-capture", () => ({ getSystemUserId: mocks.getSystemUserId }));
vi.mock("@/lib/holds/release-lapsed-holds", () => ({ releaseLapsedHoldsForSlot: mocks.releaseLapsedHoldsForSlot }));

import { settleConfiguratorPayment } from "./settle-configurator";

const EVENT_DAY = new Date("2027-03-05T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.publicQuoteDraft.findFirst.mockResolvedValue({
    id: "draft-1",
    customerName: "Asha Rao",
    customerPhone: "+919800000000",
    customerEmail: "asha@example.com",
    occasion: "Reception",
    venueId: "venue-1",
    eventDate: EVENT_DAY,
    timeSlot: "5pm to 10pm",
    guestCount: 250,
    grandTotal: 500000,
    advanceAmount: 100000,
  });
  db.publicQuoteDraft.updateMany.mockResolvedValue({ count: 1 });
  db.contact.findFirst.mockResolvedValue({ id: "contact-1" });
  db.booking.findMany.mockResolvedValue([]);
  db.booking.create.mockResolvedValue({ id: "booking-1" });
  db.invoice.update.mockResolvedValue({});
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  mocks.publicConfiguratorSlotFree.mockResolvedValue(true);
  mocks.generateBookingNumber.mockResolvedValue("VG-2026-0001");
  mocks.maybeConfirmBookingOnPayment.mockResolvedValue(undefined);
  mocks.getSystemUserId.mockResolvedValue("system-user");
  mocks.releaseLapsedHoldsForSlot.mockResolvedValue(1);
  mocks.reportSystemFailure.mockResolvedValue(undefined);
});

describe("settleConfiguratorPayment", () => {
  it("releases lapsed holds on the paid slot before the clash-guarded transaction", async () => {
    await settleConfiguratorPayment("invoice-1");

    expect(mocks.releaseLapsedHoldsForSlot).toHaveBeenCalledWith("venue-1", EVENT_DAY, "EVENING");
    expect(mocks.releaseLapsedHoldsForSlot.mock.invocationCallOrder[0]).toBeLessThan(db.$transaction.mock.invocationCallOrder[0]);
    expect(db.booking.create).toHaveBeenCalledTimes(1);
    expect(db.invoice.update).toHaveBeenCalledWith({ where: { id: "invoice-1" }, data: { bookingId: "booking-1" } });
    expect(mocks.maybeConfirmBookingOnPayment).toHaveBeenCalledWith("invoice-1");
    expect(mocks.reportSystemFailure).not.toHaveBeenCalled();
  });

  it("a hold that gained money is kept: the clash check refuses and the refund alert fires", async () => {
    mocks.releaseLapsedHoldsForSlot.mockResolvedValueOnce(0);
    db.booking.findMany.mockResolvedValueOnce([{ date: EVENT_DAY }]);

    await settleConfiguratorPayment("invoice-1");

    expect(db.booking.create).not.toHaveBeenCalled();
    expect(mocks.reportSystemFailure).toHaveBeenCalledTimes(1);
    expect(mocks.reportSystemFailure.mock.calls[0][0].title).toContain("slot was just taken");
  });

  it("a failing release is logged and the alert path still runs", async () => {
    mocks.releaseLapsedHoldsForSlot.mockRejectedValueOnce(new Error("connection lost"));
    db.booking.findMany.mockResolvedValueOnce([{ date: EVENT_DAY }]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await settleConfiguratorPayment("invoice-1");

    expect(spy).toHaveBeenCalledWith("[SETTLE_CONFIGURATOR_LAPSED_RELEASE_ERROR]", expect.any(Error));
    spy.mockRestore();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.reportSystemFailure).toHaveBeenCalledTimes(1);
    expect(mocks.reportSystemFailure.mock.calls[0][0].title).toContain("slot was just taken");
  });
});
