import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// The session-free "looks open" check applies the same lapsed-hold decision as
// the team's availability board and the customer's calendar: a lapsed hold does
// not block, an expired hold with money still does, and when the lapsed lookup
// fails the holds keep blocking so nothing is over-promised.
// ============================================================

const db = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  blackoutFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: db.bookingFindMany },
    blackoutDate: { findMany: db.blackoutFindMany },
  },
}));

import { slotLikelyFree } from "./slot-availability-internal";

const DAY = new Date("2027-02-10T00:00:00.000Z");
const LONG_AGO = new Date("2020-01-01T00:00:00.000Z"); // hold window long passed
const FAR_AHEAD = new Date("2100-01-01T00:00:00.000Z"); // hold window still open

const unpaid = { status: "SENT", paidAmount: 0, payments: [] };
const partPaid = { status: "PARTIALLY_PAID", paidAmount: 1000, payments: [] };

beforeEach(() => {
  db.bookingFindMany.mockReset();
  db.blackoutFindMany.mockReset();
  db.blackoutFindMany.mockResolvedValue([]);
});

describe("slotLikelyFree", () => {
  it("a lapsed hold does not make the slot look taken", async () => {
    db.bookingFindMany
      .mockResolvedValueOnce([{ id: "lapsed", date: DAY, status: "HOLD", holdExpiresAt: LONG_AGO }])
      .mockResolvedValueOnce([{ id: "lapsed", status: "HOLD", holdExpiresAt: LONG_AGO, invoices: [unpaid] }]);

    expect(await slotLikelyFree("venue-1", DAY, "EVENING")).toBe(true);
  });

  it("an expired hold with a part payment still blocks — money protects the date", async () => {
    db.bookingFindMany
      .mockResolvedValueOnce([{ id: "paid", date: DAY, status: "HOLD", holdExpiresAt: LONG_AGO }])
      .mockResolvedValueOnce([{ id: "paid", status: "HOLD", holdExpiresAt: LONG_AGO, invoices: [unpaid, partPaid] }]);

    expect(await slotLikelyFree("venue-1", DAY, "EVENING")).toBe(false);
  });

  it("a live hold or a confirmed booking blocks without any money lookup", async () => {
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "live", date: DAY, status: "HOLD", holdExpiresAt: FAR_AHEAD },
      { id: "confirmed", date: DAY, status: "CONFIRMED", holdExpiresAt: null },
    ]);

    expect(await slotLikelyFree("venue-1", DAY, "FULL_DAY")).toBe(false);
    expect(db.bookingFindMany).toHaveBeenCalledTimes(1);
  });

  it("if the lapsed-hold lookup fails, holds keep blocking", async () => {
    db.bookingFindMany
      .mockResolvedValueOnce([{ id: "lapsed", date: DAY, status: "HOLD", holdExpiresAt: LONG_AGO }])
      .mockRejectedValueOnce(new Error("connection lost"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await slotLikelyFree("venue-1", DAY, "EVENING")).toBe(false);
    spy.mockRestore();
  });

  it("a blackout still blocks once lapsed holds are set aside", async () => {
    db.bookingFindMany
      .mockResolvedValueOnce([{ id: "lapsed", date: DAY, status: "HOLD", holdExpiresAt: LONG_AGO }])
      .mockResolvedValueOnce([{ id: "lapsed", status: "HOLD", holdExpiresAt: LONG_AGO, invoices: [unpaid] }]);
    db.blackoutFindMany.mockResolvedValueOnce([{ date: DAY }]);

    expect(await slotLikelyFree("venue-1", DAY, "EVENING")).toBe(false);
  });

  it("keeps the booking query's clash rules: requested slot or FULL_DAY, never CANCELLED", async () => {
    db.bookingFindMany.mockResolvedValueOnce([]);

    expect(await slotLikelyFree("venue-1", DAY, "MORNING")).toBe(true);
    const where = db.bookingFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ venueId: "venue-1", status: { notIn: ["CANCELLED"] } });
    expect(where.OR).toEqual([{ timeSlot: "MORNING" }, { timeSlot: "FULL_DAY" }]);
  });
});
