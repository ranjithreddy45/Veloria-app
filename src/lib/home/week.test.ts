import { describe, it, expect } from "vitest";
import { bucketWeek, weekTotal } from "./week";

// Wednesday 23 Sep 2026, 14:30 IST. Week = Mon 21 .. Sun 27 (IST).
const NOW = new Date("2026-09-23T09:00:00.000Z");

describe("bucketWeek", () => {
  it("always returns Monday to Sunday and marks today", () => {
    const days = bucketWeek([], NOW);
    expect(days.map((d) => d.name)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    expect(days.filter((d) => d.isToday).map((d) => d.name)).toEqual(["Wednesday"]);
    expect(weekTotal(days)).toBe(0);
  });

  it("buckets by the IST weekday, not the server's", () => {
    // 19:00 UTC Monday is 00:30 IST Tuesday.
    const days = bucketWeek([{ at: new Date("2026-09-21T19:00:00.000Z"), amount: 1000 }], NOW);
    expect(days[0].value).toBe(0);
    expect(days[1].value).toBe(1000);
  });

  it("ignores rows outside the week", () => {
    const days = bucketWeek(
      [
        { at: new Date("2026-09-20T18:00:00.000Z"), amount: 500 }, // Sun 23:30 IST, last week
        { at: new Date("2026-09-27T18:30:00.000Z"), amount: 500 }, // next Mon 00:00 IST
        { at: new Date("2026-09-20T18:30:00.000Z"), amount: 250 }, // Mon 00:00 IST, in
      ],
      NOW
    );
    expect(weekTotal(days)).toBe(250);
    expect(days[0].value).toBe(250);
  });

  it("adds in paise so fractions do not drift", () => {
    const rows = Array.from({ length: 10 }, () => ({ at: NOW, amount: 0.1 }));
    expect(weekTotal(bucketWeek(rows, NOW))).toBe(1);
  });
});
