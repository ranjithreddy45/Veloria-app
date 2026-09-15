import { describe, expect, it } from "vitest";
import { SLOT_HOURS, TIME_SLOTS, slotScheduleStartMin } from "@/lib/sales/slot";
import { eventStartUtc } from "./schedule";

// Event-day task SLAs start from the team's slot hours (src/lib/sales/slot.ts),
// the same hours the booking's screens, quotations and calendar file show.

describe("eventStartUtc", () => {
  const day = new Date("2026-10-10T00:00:00.000Z"); // @db.Date: UTC midnight of the IST calendar day

  it("starts the event at the slot's schedule start, in IST", () => {
    for (const slot of TIME_SLOTS) {
      expect(eventStartUtc(day, slot).getTime(), slot).toBe(day.getTime() + (slotScheduleStartMin(slot) - 330) * 60_000);
      const hours = SLOT_HOURS[slot];
      if (hours) expect(eventStartUtc(day, slot).getTime(), slot).toBe(day.getTime() + (hours.startMin - 330) * 60_000);
    }
    expect(eventStartUtc(day, "EVENING").toISOString()).toBe("2026-10-10T11:30:00.000Z"); // 5:00 pm IST
  });

  it("treats a missing slot as Evening", () => {
    expect(eventStartUtc(day, null).getTime()).toBe(eventStartUtc(day, "EVENING").getTime());
    expect(eventStartUtc(day).getTime()).toBe(eventStartUtc(day, "EVENING").getTime());
  });
});
