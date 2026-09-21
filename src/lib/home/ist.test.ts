import { describe, it, expect } from "vitest";
import {
  istDateKey,
  istDateOnly,
  istDayWindow,
  istHour,
  istMonthWindow,
  istWeekDateOnly,
  istWeekWindow,
  istWeekdayIndex,
} from "./ist";

// 2026-09-20 20:00 UTC is 2026-09-21 01:30 IST (a Monday): the window where
// the server's date and India's date disagree.
const EARLY_IST = new Date("2026-09-20T20:00:00.000Z");
// 2026-09-23 09:00 UTC is Wednesday 14:30 IST.
const MIDWEEK = new Date("2026-09-23T09:00:00.000Z");

describe("ist day helpers", () => {
  it("reads India's date, not the server's, just after IST midnight", () => {
    expect(istDateKey(EARLY_IST)).toBe("2026-09-21");
    expect(istHour(EARLY_IST)).toBe(1);
  });

  it("bounds the IST day as real instants", () => {
    const w = istDayWindow(EARLY_IST);
    expect(w.start.toISOString()).toBe("2026-09-20T18:30:00.000Z");
    expect(w.end.toISOString()).toBe("2026-09-21T18:30:00.000Z");
    expect(istDayWindow(EARLY_IST, 1).start.toISOString()).toBe(w.end.toISOString());
  });

  it("gives the UTC-midnight value a @db.Date column stores for India's date", () => {
    expect(istDateOnly(EARLY_IST).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(istDateOnly(EARLY_IST, 1).toISOString()).toBe("2026-09-22T00:00:00.000Z");
  });

  it("rolls date-only offsets across a month end", () => {
    const lastDay = new Date("2026-09-30T10:00:00.000Z");
    expect(istDateOnly(lastDay, 1).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("ist week and month windows", () => {
  it("runs the week Monday to Sunday in IST", () => {
    const w = istWeekWindow(MIDWEEK);
    expect(w.start.toISOString()).toBe("2026-09-20T18:30:00.000Z"); // Mon 00:00 IST
    expect(w.end.toISOString()).toBe("2026-09-27T18:30:00.000Z"); // next Mon 00:00 IST
  });

  it("treats Monday 01:30 IST as the start of the new week, not the old one", () => {
    expect(istWeekWindow(EARLY_IST).start.toISOString()).toBe("2026-09-20T18:30:00.000Z");
    expect(istWeekdayIndex(EARLY_IST)).toBe(0);
  });

  it("puts Sunday last", () => {
    expect(istWeekdayIndex(new Date("2026-09-27T06:00:00.000Z"))).toBe(6);
  });

  it("gives the same week as date-only bounds", () => {
    const w = istWeekDateOnly(MIDWEEK);
    expect(w.start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("bounds the IST month, and the month before", () => {
    const m = istMonthWindow(MIDWEEK);
    expect(m.start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(m.end.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(istMonthWindow(MIDWEEK, -1).end.toISOString()).toBe(m.start.toISOString());
  });

  it("wraps the previous month across a year boundary", () => {
    const jan = new Date("2027-01-10T06:00:00.000Z");
    expect(istMonthWindow(jan, -1).start.toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });
});
