import { describe, expect, it } from "vitest";
import { ATTENDANCE_BASIS_DAYS, attendancePct, attendedDays } from "./attendance-basis";

describe("attendance on a fixed 30-day month", () => {
  it("is always out of 30, whatever the month length", () => {
    expect(ATTENDANCE_BASIS_DAYS).toBe(30);
    expect(attendancePct(30)).toBe(100);
    expect(attendancePct(15)).toBe(50);
    expect(attendancePct(23)).toBe(76.7);
  });

  it("counts present and WFH in full and a half-day as half", () => {
    expect(attendedDays({ present: 20, wfh: 2, halfDay: 2 })).toBe(23);
  });

  it("never exceeds 100% in a 31-day month, and never goes negative", () => {
    expect(attendancePct(31)).toBe(100);
    expect(attendancePct(0)).toBe(0);
    expect(attendancePct(-3)).toBe(0);
  });
});
