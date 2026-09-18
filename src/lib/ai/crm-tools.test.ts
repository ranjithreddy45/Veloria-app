import { describe, it, expect, vi, beforeEach } from "vitest";

// The AI assistant's availability tool must give the team availability board's
// answer: the date's UTC day (Booking.date and BlackoutDate.date are @db.Date),
// blackouts block, and a lapsed hold (window passed, no money) does not.

const db = vi.hoisted(() => ({
  venue: { findFirst: vi.fn(), findUnique: vi.fn() },
  booking: { findMany: vi.fn() },
  blackoutDate: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("./openai-client", () => ({ chatCompletionWithSystem: vi.fn() }));
vi.mock("./system-prompt", () => ({ buildEmailSystemPrompt: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));

import { executeCRMTool } from "./crm-tools";

const DAY = new Date("2026-10-02T00:00:00.000Z");
const NEXT_DAY = new Date("2026-10-03T00:00:00.000Z");
const expired = () => new Date(Date.now() - 2 * 60 * 60 * 1000);

async function check(args: Record<string, unknown> = {}) {
  const out = await executeCRMTool("checkVenueAvailability", { venueId: "venue-1", date: "2026-10-02", timeSlot: "EVENING", ...args });
  return JSON.parse(out) as { venue?: string; available?: boolean; reason?: string | null; note?: string; error?: string };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.venue.findUnique.mockResolvedValue({ name: "Grand Hall" });
  db.booking.findMany.mockResolvedValue([]);
  db.blackoutDate.findMany.mockResolvedValue([]);
});

describe("checkVenueAvailability (AI tool)", () => {
  it("scans the date's UTC day for bookings and blackouts", async () => {
    expect(await check()).toMatchObject({ venue: "Grand Hall", available: true, reason: null });
    expect(db.booking.findMany.mock.calls[0][0].where).toMatchObject({ venueId: "venue-1", date: { gte: DAY, lt: NEXT_DAY } });
    expect(db.blackoutDate.findMany.mock.calls[0][0].where).toMatchObject({ venueId: "venue-1", date: { gte: DAY, lt: NEXT_DAY } });
  });

  it("a lapsed hold does not block the slot, and the answer names it", async () => {
    const past = expired();
    db.booking.findMany
      .mockResolvedValueOnce([{ id: "hold-1", bookingNumber: "VG-2026-0100", eventName: "Held date", timeSlot: "EVENING", status: "HOLD", holdExpiresAt: past, date: DAY }])
      .mockResolvedValueOnce([{ id: "hold-1", status: "HOLD", holdExpiresAt: past, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] }]);

    const res = await check();

    expect(res).toMatchObject({ available: true, reason: null });
    expect(res.note).toContain("VG-2026-0100");
  });

  it("a hold with money still blocks after its window", async () => {
    const past = expired();
    db.booking.findMany
      .mockResolvedValueOnce([{ id: "hold-2", bookingNumber: "VG-2026-0102", eventName: "Paid hold", timeSlot: "FULL_DAY", status: "HOLD", holdExpiresAt: past, date: DAY }])
      .mockResolvedValueOnce([{ id: "hold-2", status: "HOLD", holdExpiresAt: past, invoices: [{ status: "PARTIALLY_PAID", paidAmount: 20000, payments: [] }] }]);

    const res = await check();

    expect(res.available).toBe(false);
    expect(res.reason).toContain("Paid hold");
  });

  it("a whole-day blackout blocks the slot", async () => {
    db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, timeSlot: null, reason: "Maintenance" }]);

    expect(await check()).toMatchObject({ available: false, reason: "Blacked out: Maintenance" });
  });

  it("another slot's blackout leaves a partial slot free but blocks FULL_DAY", async () => {
    db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, timeSlot: "MORNING", reason: "Pooja" }]);

    expect((await check({ timeSlot: "EVENING" })).available).toBe(true);
    expect((await check({ timeSlot: "FULL_DAY" })).available).toBe(false);
  });

  it("rejects an unknown slot", async () => {
    expect((await check({ timeSlot: "NIGHT" })).error).toContain("Invalid time slot");
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
});
