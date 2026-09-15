import { describe, it, expect, vi, beforeEach } from "vitest";

// The team's multi-venue grid gives the availability board's answer: a lapsed
// hold (window passed, no money against it) no longer blocks its slots, and the
// free slots it used to block name it in the board's words.

const db = vi.hoisted(() => ({
  venue: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  blackoutDate: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: async () => ({ user: { id: "rep-1", role: "SALES_EXEC" } }) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));

import { getCoordinatedSchedule } from "./multi-venue.actions";

const DAY = new Date("2026-10-02T00:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  db.venue.findMany.mockResolvedValue([
    { id: "venue-1", name: "Grand Hall", capacity: 500, isActive: true },
    { id: "venue-2", name: "Lawn", capacity: 800, isActive: true },
  ]);
  db.blackoutDate.findMany.mockResolvedValue([]);
});

describe("getCoordinatedSchedule and lapsed holds", () => {
  it("frees a lapsed hold's slots and names it there, while a confirmed booking still blocks", async () => {
    const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
    db.booking.findMany
      .mockResolvedValueOnce([
        { id: "hold-1", bookingNumber: "VG-2026-0100", eventName: "Held", timeSlot: "EVENING", venueId: "venue-1", venueGroupId: null, date: DAY, status: "HOLD", holdExpiresAt: expired },
        { id: "bk-2", bookingNumber: "VG-2026-0101", eventName: "Reception", timeSlot: "MORNING", venueId: "venue-2", venueGroupId: null, date: DAY, status: "CONFIRMED", holdExpiresAt: null },
      ])
      .mockResolvedValueOnce([{ id: "hold-1", status: "HOLD", holdExpiresAt: expired, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] }]);

    const res = await getCoordinatedSchedule(["venue-1", "venue-2"], DAY);
    if (!res.success) throw new Error(res.error);
    const [hall, lawn] = res.data;

    const label = "Lapsed hold · VG-2026-0100 (unpaid, slot free)";
    expect(hall.slots.EVENING).toEqual({ available: true, reason: label });
    expect(hall.slots.FULL_DAY).toEqual({ available: true, reason: label });
    expect(hall.slots.MORNING).toEqual({ available: true, reason: null });
    expect(hall.bookings).toEqual([]);

    expect(lawn.slots.MORNING.available).toBe(false);
    expect(lawn.slots.FULL_DAY.available).toBe(false);
    expect(lawn.slots.EVENING).toEqual({ available: true, reason: null });
  });
});
