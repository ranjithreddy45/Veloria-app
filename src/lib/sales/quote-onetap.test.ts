import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// finalizeOneTapBlock runs after a one-tap quote advance is captured, from the
// capture path and again from the customer's confirm call. It must:
//  - release a lapsed hold on the slot first, so it can't cost a paid customer
//    their date;
//  - when the slot is genuinely taken, leave the payment recorded and alert the
//    quote's owner and admins once per payment, however often it runs.
// publicSlotScarcity must not show a lapsed hold's slot as busy.
// Prisma and the framework are stubbed; the lapsed-hold rules and the alert
// helper are real (releaseLapsedHoldsForSlot has its own tests).
// ============================================================

type ActivityRow = { action: string; entityType: string; entityId: string; userId: string };

const h = vi.hoisted(() => ({
  activity: [] as ActivityRow[],
  db: {
    quoteShareLink: { findUnique: vi.fn() },
    salesQuotation: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    salesQuotationTransition: { create: vi.fn() },
    contact: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    booking: { findMany: vi.fn(), update: vi.fn() },
    blackoutDate: { findMany: vi.fn() },
    invoice: { update: vi.fn() },
    payment: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    venue: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    booking: { findMany: vi.fn(), create: vi.fn() },
    $executeRaw: vi.fn(),
    activityLog: { findFirst: vi.fn(), create: vi.fn() },
  },
  releaseForSlot: vi.fn(),
  generateBookingNumber: vi.fn(),
  maybeConfirm: vi.fn(),
  notifyAwait: vi.fn(),
  reportSystemFailure: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: h.reportSystemFailure }));
vi.mock("@/lib/notify", () => ({ notifyAwait: h.notifyAwait }));
vi.mock("@/actions/booking.actions", () => ({ generateBookingNumber: h.generateBookingNumber }));
vi.mock("@/lib/sales/confirm-booking", () => ({ maybeConfirmBookingOnPayment: h.maybeConfirm }));
vi.mock("@/lib/lead-capture", () => ({ getSystemUserId: async () => "sys-admin" }));
vi.mock("@/lib/holds/release-lapsed-holds", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  releaseLapsedHoldsForSlot: h.releaseForSlot,
}));

import { finalizeOneTapBlock, publicSlotScarcity } from "./quote-onetap";
import { slotLabel } from "@/lib/sales/slot";

const DAY = new Date("2026-10-02T00:00:00.000Z");

const LINK = {
  id: "link-1",
  primaryQuotationId: "q-1",
  venueId: "venue-1",
  eventDate: DAY,
  timeSlot: "EVENING",
  payInvoiceId: "inv-1",
  createdById: "rep-link",
};

const QUOTE = {
  id: "q-1",
  status: "APPROVED",
  bookingId: null,
  venueId: "venue-1",
  eventDate: DAY,
  timeSlot: "EVENING",
  guestCount: 200,
  grandTotal: 100000,
  quoteNumber: "VG-Q-00012",
  occasion: "Wedding",
  clientName: "Asha Rao",
  clientPhone: "9999999999",
  clientEmail: "asha@example.com",
  contactId: "contact-1",
  invoiceId: "inv-1",
  createdById: "rep-q",
};

const uniqueViolation = (target: unknown) => Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } });

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
  h.db.quoteShareLink.findUnique.mockResolvedValue(LINK);
  h.db.salesQuotation.findUnique.mockResolvedValue(QUOTE);
  h.db.salesQuotation.updateMany.mockResolvedValue({ count: 1 });
  h.db.salesQuotation.update.mockResolvedValue({});
  h.db.salesQuotationTransition.create.mockResolvedValue({});
  h.db.invoice.update.mockResolvedValue({});
  h.db.payment.findMany.mockResolvedValue([
    { id: "pay-1", amount: 20000, receiptNumber: "RCP-2026-0042", invoice: { invoiceNumber: "INV-2026-0007" } },
  ]);
  h.db.venue.findUnique.mockResolvedValue({ name: "Grand Hall" });
  h.db.user.findMany.mockResolvedValue([
    { id: "rep-q", role: "SALES_EXEC", isActive: true },
    { id: "rep-link", role: "SALES_EXEC", isActive: true },
  ]);
  h.db.booking.findMany.mockResolvedValue([]);
  h.db.blackoutDate.findMany.mockResolvedValue([]);
  h.tx.booking.findMany.mockResolvedValue([]);
  h.tx.booking.create.mockResolvedValue({ id: "bk-new" });
  h.releaseForSlot.mockResolvedValue(0);
  h.generateBookingNumber.mockResolvedValueOnce("VG-2026-0100").mockResolvedValue("VG-2026-0101");
  h.maybeConfirm.mockResolvedValue(undefined);
  h.notifyAwait.mockResolvedValue(undefined);
  h.reportSystemFailure.mockResolvedValue(undefined);
});

describe("finalizeOneTapBlock: the slot is taken after the customer paid", () => {
  it("leaves the payment recorded and alerts the quote's owners and admins once, however often finalize runs", async () => {
    h.tx.booking.findMany.mockResolvedValue([{ id: "someone-else", date: DAY }]);

    const fromCapture = await finalizeOneTapBlock("link-1");
    const fromConfirmCall = await finalizeOneTapBlock("link-1");
    const retried = await finalizeOneTapBlock("link-1");

    for (const res of [fromCapture, fromConfirmCall, retried]) expect(res).toEqual({ success: false, error: "SLOT_TAKEN" });

    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
    const alert = h.reportSystemFailure.mock.calls[0][0] as { title: string; detail: string; actionUrl: string };
    expect(alert.title).toBe("Paid quote VG-Q-00012: slot taken, no booking created");
    expect(alert.detail).toContain("Asha Rao paid ₹20,000 (receipt RCP-2026-0042) on quote VG-Q-00012");
    expect(alert.detail).toContain(`Grand Hall, 2 October 2026, ${slotLabel("EVENING")}`);
    expect(alert.detail).toContain("The payment is recorded on invoice INV-2026-0007.");
    expect(alert.detail).toContain("Re-book the customer on another date or hall, or refund the payment.");
    expect(alert.actionUrl).toBe("/quotations/q-1");

    const told = h.notifyAwait.mock.calls.map(([n]) => (n as { userId: string }).userId).sort();
    expect(told).toEqual(["rep-link", "rep-q"]);
    expect(h.activity).toEqual([expect.objectContaining({ action: "alerted_one_tap_slot_taken", entityType: "Payment", entityId: "pay-1" })]);

    // The captured payment is never touched and no booking was created or linked.
    expect(h.db.payment.update).not.toHaveBeenCalled();
    expect(h.db.payment.updateMany).not.toHaveBeenCalled();
    expect(h.db.payment.delete).not.toHaveBeenCalled();
    expect(h.db.invoice.update).not.toHaveBeenCalled();
    expect(h.tx.booking.create).not.toHaveBeenCalled();
  });

  it("treats a unique violation on the active-slot index as taken too", async () => {
    h.tx.booking.create.mockRejectedValue(uniqueViolation("Booking_active_slot_key"));

    expect(await finalizeOneTapBlock("link-1")).toEqual({ success: false, error: "SLOT_TAKEN" });
    expect(h.reportSystemFailure).toHaveBeenCalledTimes(1);
  });

  it("sends nothing while the advance invoice has no completed payment", async () => {
    h.tx.booking.findMany.mockResolvedValue([{ id: "someone-else", date: DAY }]);
    h.db.payment.findMany.mockResolvedValue([]);

    expect(await finalizeOneTapBlock("link-1")).toEqual({ success: false, error: "SLOT_TAKEN" });
    expect(h.reportSystemFailure).not.toHaveBeenCalled();
    expect(h.notifyAwait).not.toHaveBeenCalled();
  });

  it("retries a booking-number collision with a fresh number instead of calling the slot taken", async () => {
    h.tx.booking.create.mockRejectedValueOnce(uniqueViolation(["bookingNumber"])).mockResolvedValue({ id: "bk-new" });

    expect(await finalizeOneTapBlock("link-1")).toEqual({ success: true, data: { bookingId: "bk-new" } });
    expect(h.tx.booking.create).toHaveBeenCalledTimes(2);
    const second = h.tx.booking.create.mock.calls[1][0] as { data: { bookingNumber: string } };
    expect(second.data.bookingNumber).toBe("VG-2026-0101");
    expect(h.reportSystemFailure).not.toHaveBeenCalled();
  });
});

describe("finalizeOneTapBlock: a lapsed hold on the slot", () => {
  it("is released before the booking transaction, so the paid customer gets the date", async () => {
    h.releaseForSlot.mockResolvedValue(1);

    expect(await finalizeOneTapBlock("link-1")).toEqual({ success: true, data: { bookingId: "bk-new" } });
    expect(h.releaseForSlot).toHaveBeenCalledWith("venue-1", DAY, "EVENING");
    expect(h.releaseForSlot.mock.invocationCallOrder[0]).toBeLessThan(h.db.$transaction.mock.invocationCallOrder[0]);
    expect(h.db.invoice.update).toHaveBeenCalledWith({ where: { id: "inv-1" }, data: { bookingId: "bk-new" } });
    expect(h.maybeConfirm).toHaveBeenCalledWith("inv-1");
  });

  it("a failed release is logged, and the transaction's clash check still decides", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.releaseForSlot.mockRejectedValue(new Error("connection lost"));
    h.tx.booking.findMany.mockResolvedValue([{ id: "still-held", date: DAY }]);

    expect(await finalizeOneTapBlock("link-1")).toEqual({ success: false, error: "SLOT_TAKEN" });
    expect(spy).toHaveBeenCalledWith("[FINALIZE_ONETAP_LAPSED_RELEASE_ERROR]", expect.any(Error));
    spy.mockRestore();
  });
});

describe("publicSlotScarcity", () => {
  it("shows a lapsed hold's slot as free and a paid hold's slot as busy", async () => {
    const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
    h.db.booking.findMany
      .mockResolvedValueOnce([
        { id: "lapsed", date: DAY, timeSlot: "EVENING", status: "HOLD", holdExpiresAt: expired },
        { id: "paid", date: DAY, timeSlot: "MORNING", status: "HOLD", holdExpiresAt: expired },
      ])
      .mockResolvedValueOnce([
        { id: "lapsed", status: "HOLD", holdExpiresAt: expired, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] },
        { id: "paid", status: "HOLD", holdExpiresAt: expired, invoices: [{ status: "PARTIALLY_PAID", paidAmount: 20000, payments: [] }] },
      ]);

    const slots = await publicSlotScarcity("venue-1", DAY);

    expect(Object.fromEntries(slots.map((s) => [s.slot, s.free]))).toEqual({
      MORNING: false,
      AFTERNOON: true,
      EVENING: true,
      FULL_DAY: false,
    });
  });
});
