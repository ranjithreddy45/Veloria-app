import { describe, it, expect, vi, beforeEach } from "vitest";

// The release module talks to the database only through these calls. They are
// stubbed so the tests pin WHICH holds may be cancelled and HOW the cancel is
// guarded — the part that once destroyed paid bookings.
const db = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  bookingCount: vi.fn(),
  bookingUpdateMany: vi.fn(),
  publicHoldFindMany: vi.fn(),
  publicHoldUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: db.bookingFindMany, count: db.bookingCount, updateMany: db.bookingUpdateMany },
    publicHold: { findMany: db.publicHoldFindMany, updateMany: db.publicHoldUpdateMany },
  },
}));

import { findLapsedHoldIds, releaseLapsedHolds, releaseLapsedHoldsForSlot } from "./release-lapsed-holds";
import { lapsedHoldWhere } from "./lapsed-hold";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-16T05:00:00.000Z");
const FUTURE = new Date("2026-09-16T13:00:00.000Z");

const unpaid = { status: "SENT", paidAmount: 0, payments: [] };
const partPaid = { status: "PARTIALLY_PAID", paidAmount: 1000, payments: [] };

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.bookingCount.mockResolvedValue(0);
  db.bookingUpdateMany.mockResolvedValue({ count: 1 });
  db.publicHoldFindMany.mockResolvedValue([]);
  db.publicHoldUpdateMany.mockImplementation(async (args: { where: { bookingId: { in: string[] } } }) => ({ count: args.where.bookingId.in.length }));
});

describe("releaseLapsedHolds (frequent-lane sweep)", () => {
  it("releases an unpaid expired hold with the full money guard in the UPDATE, and expires its PublicHold", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "b1", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid] }]);

    const res = await releaseLapsedHolds(NOW);

    expect(res.released).toBe(1);
    expect(db.bookingUpdateMany).toHaveBeenCalledWith({ where: { id: "b1", ...lapsedHoldWhere(NOW) }, data: { status: "CANCELLED" } });
    expect(db.publicHoldUpdateMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["b1"] }, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "EXPIRED" },
    });
    expect(res.publicHoldsExpired).toBe(1);
  });

  it("never writes to a paid hold, even if the query were to return one", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "paid", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid, partPaid] }]);

    const res = await releaseLapsedHolds(NOW);

    expect(res.released).toBe(0);
    expect(res.disagreements).toBe(1);
    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
  });

  it("a payment landing between read and write wins: no cancel, PublicHold untouched", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "race", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid] }]);
    db.bookingUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await releaseLapsedHolds(NOW);

    expect(res.released).toBe(0);
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
  });

  it("reports expired holds kept because of money", async () => {
    db.bookingFindMany.mockResolvedValueOnce([]);
    db.bookingCount.mockResolvedValueOnce(2);
    const res = await releaseLapsedHolds(NOW);
    expect(res.skippedWithMoney).toBe(2);
  });

  it("catches up a PublicHold whose booking was already cancelled without money", async () => {
    db.bookingFindMany
      .mockResolvedValueOnce([]) // no lapsed HOLD bookings left
      .mockResolvedValueOnce([{ id: "gone" }]); // cancelled, unpaid bookings among the stale rows
    db.publicHoldFindMany.mockResolvedValueOnce([{ bookingId: "gone" }, { bookingId: "paid-cancelled" }]);

    const res = await releaseLapsedHolds(NOW);

    const lookup = db.bookingFindMany.mock.calls[1][0] as { where: Record<string, unknown> };
    expect(lookup.where).toMatchObject({ id: { in: ["gone", "paid-cancelled"] }, status: "CANCELLED" });
    expect(lookup.where.invoices).toBeDefined();
    expect(db.publicHoldUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ bookingId: { in: ["gone"] } }) }));
    expect(res.publicHoldsExpired).toBe(1);
  });
});

describe("releaseLapsedHoldsForSlot (before placing a new hold)", () => {
  it("releases only lapsed, conflicting holds on the same UTC day", async () => {
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "same-day", status: "HOLD", holdExpiresAt: PAST, date: new Date("2026-10-02T00:00:00.000Z"), invoices: [unpaid] },
      { id: "paid", status: "HOLD", holdExpiresAt: PAST, date: new Date("2026-10-02T00:00:00.000Z"), invoices: [partPaid] },
    ]);

    const released = await releaseLapsedHoldsForSlot("venue-1", new Date("2026-10-02T00:00:00.000Z"), "MORNING", NOW);

    expect(released).toBe(1);
    const query = db.bookingFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(query.where).toMatchObject({ venueId: "venue-1", status: "HOLD", timeSlot: { in: ["MORNING", "FULL_DAY"] } });
    expect(db.bookingUpdateMany).toHaveBeenCalledTimes(1);
    expect(db.bookingUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: "same-day" } });
  });

  it("never releases the booking that is being moved into the slot", async () => {
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "moving", status: "HOLD", holdExpiresAt: PAST, date: new Date("2026-10-02T00:00:00.000Z"), invoices: [unpaid] },
    ]);

    const released = await releaseLapsedHoldsForSlot("venue-1", new Date("2026-10-02T00:00:00.000Z"), "FULL_DAY", NOW, "moving");

    expect(released).toBe(0);
    const query = db.bookingFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(query.where).toMatchObject({ id: { not: "moving" }, status: "HOLD", venueId: "venue-1" });
    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
  });

  it("without an excluded booking the query is unchanged", async () => {
    db.bookingFindMany.mockResolvedValueOnce([]);
    await releaseLapsedHoldsForSlot("venue-1", new Date("2026-10-02T00:00:00.000Z"), "EVENING", NOW);
    const query = db.bookingFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(query.where.id).toBeUndefined();
  });

  it("a FULL_DAY request considers every slot", async () => {
    db.bookingFindMany.mockResolvedValueOnce([]);
    await releaseLapsedHoldsForSlot("venue-1", new Date("2026-10-02T00:00:00.000Z"), "FULL_DAY", NOW);
    const query = db.bookingFindMany.mock.calls[0][0] as { where: { timeSlot: { in: string[] } } };
    expect([...query.where.timeSlot.in].sort()).toEqual(["AFTERNOON", "EVENING", "FULL_DAY", "MORNING"]);
  });
});

describe("findLapsedHoldIds (read paths)", () => {
  it("does not touch the database when nothing is past its window", async () => {
    const ids = await findLapsedHoldIds(
      [
        { id: "live", status: "HOLD", holdExpiresAt: FUTURE },
        { id: "confirmed", status: "CONFIRMED", holdExpiresAt: PAST },
      ],
      NOW
    );
    expect(ids.size).toBe(0);
    expect(db.bookingFindMany).not.toHaveBeenCalled();
  });

  it("returns lapsed holds and leaves paid ones blocking", async () => {
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "lapsed", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid] },
      { id: "paid", status: "HOLD", holdExpiresAt: PAST, invoices: [partPaid] },
    ]);
    const ids = await findLapsedHoldIds(
      [
        { id: "lapsed", status: "HOLD", holdExpiresAt: PAST },
        { id: "paid", status: "HOLD", holdExpiresAt: PAST },
      ],
      NOW
    );
    expect([...ids]).toEqual(["lapsed"]);
  });

  it("on a database error, holds keep blocking", async () => {
    db.bookingFindMany.mockRejectedValueOnce(new Error("connection lost"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ids = await findLapsedHoldIds([{ id: "x", status: "HOLD", holdExpiresAt: PAST }], NOW);
    expect(ids.size).toBe(0);
    spy.mockRestore();
  });
});
