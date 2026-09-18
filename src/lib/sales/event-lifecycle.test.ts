import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The daily lifecycle sweep closes a past event only when nothing is owed, by
// finance's shared owed rule (bookingBalance): an unsent draft or a fully
// refunded invoice never holds an event open; a balance on a sent, partially
// paid or overdue invoice does. Prisma and notifications are stubbed.
// ============================================================

const { db, notifyAwait } = vi.hoisted(() => ({
  db: {
    booking: { updateMany: vi.fn(), findMany: vi.fn() },
    beo: { findFirst: vi.fn() },
  },
  notifyAwait: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait }));

import { sweepEventLifecycle } from "./event-lifecycle";

const pastEvent = (id: string, invoices: { status: string; balanceDue: number }[]) => ({
  id,
  bookingNumber: `VG-${id}`,
  eventName: `Event ${id}`,
  guestCount: 150,
  createdById: "rep-1",
  invoices,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.booking.updateMany.mockResolvedValue({ count: 1 });
  db.beo.findFirst.mockResolvedValue({ status: "PUBLISHED" });
});

describe("sweepEventLifecycle: final payment gate", () => {
  it("completes an event whose only balances sit on a draft or a fully refunded invoice", async () => {
    db.booking.findMany.mockResolvedValue([
      pastEvent("settled", [
        { status: "PAID", balanceDue: 0 },
        { status: "DRAFT", balanceDue: 45000 },
        { status: "REFUNDED", balanceDue: 100000 },
        { status: "CANCELLED", balanceDue: 0 },
      ]),
    ]);

    const res = await sweepEventLifecycle();

    expect(res).toMatchObject({ autoCompleted: 1, nudged: 0 });
    expect(db.booking.findMany.mock.calls[0][0].select.invoices).toEqual({ select: { status: true, balanceDue: true } });
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "settled", status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
      data: { status: "COMPLETED" },
    });
  });

  it("keeps an event with a balance still owed open, and tells the rep why", async () => {
    db.booking.findMany.mockResolvedValue([
      pastEvent("owing", [
        { status: "PAID", balanceDue: 0 },
        { status: "OVERDUE", balanceDue: 20000 },
      ]),
    ]);

    const res = await sweepEventLifecycle();

    expect(res).toMatchObject({ autoCompleted: 0, nudged: 1 });
    expect(notifyAwait).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("final payment not cleared") })
    );
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1); // only the event-day CONFIRMED → IN_PROGRESS flip
  });
});
