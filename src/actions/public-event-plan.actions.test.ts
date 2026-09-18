import { beforeEach, describe, expect, it, vi } from "vitest";
import { SLOT_HOURS, SLOT_LABEL, TIME_SLOTS, slotScheduleStartMin, type TimeSlotEnum } from "@/lib/sales/slot";
import { getPublicEventPlan } from "./public-event-plan.actions";

// ============================================================
// The countdown on /event/<token> runs to when the event starts in India: the
// booking's day (@db.Date, UTC midnight of the Indian calendar day) at the
// slot's start from the team's one slot definition (src/lib/sales/slot.ts),
// the same start the team's event-day schedule uses (eventStartUtc in
// src/lib/ops/schedule.ts). It used to put Indian hours on the UTC clock, so an
// Evening event counted down to 11:30 pm in India.
// Prisma, request headers and the menu loaders are stubbed.
// ============================================================

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { eventOperation: { findFirst } } }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("@/../auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => false }));
vi.mock("@/lib/ops/beo-content", () => ({
  loadBookingMenu: vi.fn(async () => null),
  loadBookingServices: vi.fn(async () => ({})),
  buildDefaultRunOfShow: vi.fn(() => []),
}));

const TOKEN = "evt_abcdefghijklmnop";
const DAY = new Date("2026-10-10T00:00:00.000Z"); // @db.Date: UTC midnight of 10 Oct in India

async function planFor(timeSlot: TimeSlotEnum) {
  findFirst.mockResolvedValueOnce({
    bookingId: "booking-1",
    booking: {
      eventName: "Priya & Arjun's wedding",
      eventType: "Wedding",
      date: DAY,
      timeSlot,
      guestCount: 200,
      status: "CONFIRMED",
      venue: { name: "Grand Hall" },
      contact: { firstName: "Priya" },
      createdBy: { name: "Asha", phone: null },
    },
  });
  const res = await getPublicEventPlan(TOKEN);
  if (!res.success) throw new Error(res.error);
  return res.data;
}

describe("getPublicEventPlan: when the event starts", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("counts down to an Evening event at 5:00 pm in India, 11:30 UTC", async () => {
    const plan = await planFor("EVENING");
    expect(plan.eventAtISO).toBe("2026-10-10T11:30:00.000Z");
    expect(plan.eventDateISO).toBe("2026-10-10");
    expect(plan.slotLabel).toBe(SLOT_LABEL.EVENING);
  });

  it("starts every slot at the team's schedule start in India, on the booking's own day", async () => {
    for (const slot of TIME_SLOTS) {
      const plan = await planFor(slot);
      const start = new Date(plan.eventAtISO).getTime();
      expect(start, slot).toBe(DAY.getTime() + (slotScheduleStartMin(slot) - 330) * 60_000);
      const hours = SLOT_HOURS[slot];
      if (hours) expect(start, slot).toBe(DAY.getTime() + (hours.startMin - 330) * 60_000);
      expect(plan.eventAtISO.slice(0, 10), slot).toBe(plan.eventDateISO);
    }
  });

  it("says which slots have hours, so a planning anchor is never shown as a start time", async () => {
    // Morning and Full Day have no hours set by the team: their start is only the ops anchor.
    expect((await planFor("MORNING")).slotHasHours).toBe(false);
    expect((await planFor("FULL_DAY")).slotHasHours).toBe(false);
    expect((await planFor("AFTERNOON")).slotHasHours).toBe(true);
    expect((await planFor("EVENING")).slotHasHours).toBe(true);
    for (const slot of TIME_SLOTS) {
      expect((await planFor(slot)).slotHasHours, slot).toBe(SLOT_HOURS[slot] !== null);
    }
    // The fields the page already reads are unchanged for a slot without hours.
    const morning = await planFor("MORNING");
    expect(morning.eventDateISO).toBe("2026-10-10");
    expect(morning.slotLabel).toBe(SLOT_LABEL.MORNING);
  });
});
