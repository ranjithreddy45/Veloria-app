import { describe, expect, it } from "vitest";
import {
  BOOKABLE_SLOTS,
  SLOT_HOURS,
  SLOT_LABEL,
  SLOT_NAME,
  TIME_SLOTS,
  formatSlotClock,
  isTimeSlot,
  plannerSlotToEnum,
  slotLabel,
  slotScheduleStartMin,
  slotTimeText,
  toTimeSlot,
} from "./slot";

// ============================================================
// The team's one slot definition. Every screen, file and message that names a
// slot or its hours reads it from slot.ts, so these tests pin what they all say.
// ============================================================

describe("the team's slot hours", () => {
  it("are the hours the team quotes, and none for Morning or Full Day", () => {
    expect(SLOT_HOURS).toEqual({
      MORNING: null,
      AFTERNOON: { startMin: 11 * 60, endMin: 15 * 60 },
      EVENING: { startMin: 17 * 60, endMin: 22 * 60 },
      FULL_DAY: null,
    });
  });

  it("keep every label and planner string the app already shows", () => {
    expect(SLOT_LABEL).toEqual({
      MORNING: "Morning",
      AFTERNOON: "Afternoon (11am–3pm)",
      EVENING: "Evening (5pm–10pm)",
      FULL_DAY: "Full Day",
    });
    expect(BOOKABLE_SLOTS).toEqual([
      { value: "MORNING", label: "Morning", planner: "Before noon" },
      { value: "AFTERNOON", label: "Afternoon (11am–3pm)", planner: "11am to 3pm" },
      { value: "EVENING", label: "Evening (5pm–10pm)", planner: "5pm to 10pm" },
      { value: "FULL_DAY", label: "Full Day", planner: "Full Day" },
    ]);
  });

  it("drive every label, so a label can never disagree with the hours", () => {
    for (const slot of TIME_SLOTS) {
      const hours = SLOT_HOURS[slot];
      if (hours) {
        const time = `${formatSlotClock(hours.startMin)}–${formatSlotClock(hours.endMin)}`;
        expect(slotTimeText(slot)).toBe(time);
        expect(SLOT_LABEL[slot]).toBe(`${SLOT_NAME[slot]} (${time})`);
      } else {
        expect(slotTimeText(slot)).toBeNull();
        expect(SLOT_LABEL[slot]).toBe(SLOT_NAME[slot]);
      }
    }
  });
});

describe("formatSlotClock", () => {
  it("writes 12-hour clock times the way slot labels do", () => {
    expect(formatSlotClock(0)).toBe("12am");
    expect(formatSlotClock(11 * 60)).toBe("11am");
    expect(formatSlotClock(12 * 60)).toBe("12pm");
    expect(formatSlotClock(17 * 60 + 30)).toBe("5:30pm");
    expect(formatSlotClock(24 * 60)).toBe("12am");
    expect(formatSlotClock(-60)).toBe("11pm");
  });
});

describe("slot values", () => {
  it("recognise the four slots in any case", () => {
    expect(TIME_SLOTS.every(isTimeSlot)).toBe(true);
    expect(isTimeSlot("evening")).toBe(false);
    expect(toTimeSlot(" evening ")).toBe("EVENING");
    expect(toTimeSlot("BRUNCH")).toBeNull();
    expect(toTimeSlot(null)).toBeNull();
  });

  it("label a stored value, leaving an unknown one as it is", () => {
    expect(slotLabel("EVENING")).toBe(SLOT_LABEL.EVENING);
    expect(slotLabel("full_day")).toBe(SLOT_LABEL.FULL_DAY);
    expect(slotLabel("BRUNCH")).toBe("BRUNCH");
    expect(slotLabel(null)).toBe("");
  });
});

describe("slotScheduleStartMin", () => {
  it("starts a timed slot's schedule at the slot's own start", () => {
    for (const slot of TIME_SLOTS) {
      const hours = SLOT_HOURS[slot];
      if (hours) expect(slotScheduleStartMin(slot)).toBe(hours.startMin);
    }
  });

  it("uses the ops planning anchors for slots without hours, and Evening when the slot is missing", () => {
    expect(slotScheduleStartMin("MORNING")).toBe(SLOT_HOURS.MORNING?.startMin ?? 9 * 60);
    expect(slotScheduleStartMin("FULL_DAY")).toBe(SLOT_HOURS.FULL_DAY?.startMin ?? 10 * 60);
    expect(slotScheduleStartMin(null)).toBe(slotScheduleStartMin("EVENING"));
    expect(slotScheduleStartMin("BRUNCH")).toBe(slotScheduleStartMin("EVENING"));
  });
});

describe("plannerSlotToEnum", () => {
  it("reads back every slot's own value, name, label and planner wording", () => {
    for (const row of BOOKABLE_SLOTS) {
      for (const text of [row.value, SLOT_NAME[row.value], row.label, row.planner]) {
        expect(plannerSlotToEnum(text), text).toBe(row.value);
      }
    }
  });

  it("still reads older quotation and lead labels by keyword", () => {
    expect(plannerSlotToEnum("11am to 3pm")).toBe("AFTERNOON");
    expect(plannerSlotToEnum("5pm to 10pm")).toBe("EVENING");
    expect(plannerSlotToEnum("Lunch")).toBe("AFTERNOON");
    expect(plannerSlotToEnum("Dinner")).toBe("EVENING");
    expect(plannerSlotToEnum("full day event")).toBe("FULL_DAY");
    expect(plannerSlotToEnum("late night")).toBe("EVENING");
    expect(plannerSlotToEnum("morning puja")).toBe("MORNING");
  });

  it("falls back to Afternoon for an empty or unreadable label", () => {
    expect(plannerSlotToEnum("")).toBe("AFTERNOON");
    expect(plannerSlotToEnum(null)).toBe("AFTERNOON");
    expect(plannerSlotToEnum(undefined)).toBe("AFTERNOON");
    expect(plannerSlotToEnum("brunch")).toBe("AFTERNOON");
  });
});
