import { describe, it, expect, vi, beforeEach } from "vitest";

// The public OTA feed must say what the team's availability board says: a
// lapsed hold (window passed, no money against it) does not occupy its slot,
// while a hold with money does. It still emits only date, slot and status.

const db = vi.hoisted(() => ({
  venue: { findFirst: vi.fn() },
  booking: { findMany: vi.fn() },
  blackoutDate: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { buildAvailabilityJson } from "./feed";

const DAY = new Date("2026-10-02T00:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  db.venue.findFirst.mockResolvedValue({ id: "venue-1", name: "Grand Hall", capacity: 500 });
  db.blackoutDate.findMany.mockResolvedValue([]);
});

describe("OTA availability feed and lapsed holds", () => {
  it("offers a lapsed hold's slot as AVAILABLE, keeps a paid hold BOOKED, and emits nothing else", async () => {
    const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
    db.booking.findMany
      .mockResolvedValueOnce([
        { id: "lapsed", date: DAY, timeSlot: "EVENING", status: "HOLD", holdExpiresAt: expired },
        { id: "paid", date: DAY, timeSlot: "MORNING", status: "HOLD", holdExpiresAt: expired },
      ])
      .mockResolvedValueOnce([
        { id: "lapsed", status: "HOLD", holdExpiresAt: expired, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] },
        { id: "paid", status: "HOLD", holdExpiresAt: expired, invoices: [{ status: "PARTIALLY_PAID", paidAmount: 20000, payments: [] }] },
      ]);

    const feed = await buildAvailabilityJson("venue-1", DAY, DAY);
    if (!feed) throw new Error("expected a feed");

    expect(Object.fromEntries(feed.slots.map((s) => [s.timeSlot, s.status]))).toEqual({
      MORNING: "BOOKED",
      AFTERNOON: "AVAILABLE",
      EVENING: "AVAILABLE",
      FULL_DAY: "BOOKED",
    });
    for (const s of feed.slots) expect(Object.keys(s).sort()).toEqual(["date", "status", "timeSlot"]);
  });
});
