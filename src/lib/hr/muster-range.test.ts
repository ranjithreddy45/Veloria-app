import { describe, expect, it } from "vitest";
import { MAX_MUSTER_RANGE_DAYS, istDayKey, joinedBy, musterRangeDays } from "./muster-range";

describe("musterRangeDays", () => {
  it("returns the single day when From equals To", () => {
    expect(musterRangeDays("2026-10-06", "2026-10-06")).toEqual({ ok: true, days: ["2026-10-06"] });
  });

  it("lists every day inclusively, across a month boundary", () => {
    const r = musterRangeDays("2026-09-29", "2026-10-02");
    expect(r).toEqual({ ok: true, days: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"] });
  });

  it("handles a leap day", () => {
    const r = musterRangeDays("2028-02-28", "2028-03-01");
    expect(r.ok && r.days).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("accepts a full 31-day pay period and rejects 32 days", () => {
    const ok = musterRangeDays("2026-01-01", "2026-01-31");
    expect(ok.ok && ok.days.length).toBe(MAX_MUSTER_RANGE_DAYS);
    const tooLong = musterRangeDays("2026-01-01", "2026-02-01");
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.reason).toContain("32");
  });

  it("rejects a backwards range and malformed days", () => {
    expect(musterRangeDays("2026-10-06", "2026-10-05").ok).toBe(false);
    expect(musterRangeDays("06-10-2026", "2026-10-06").ok).toBe(false);
    expect(musterRangeDays("", "").ok).toBe(false);
  });
});

describe("joinedBy", () => {
  it("treats a missing joining date as always joined", () => {
    expect(joinedBy(null, "2026-10-06")).toBe(true);
  });

  it("is false before the joining day and true from it", () => {
    const doj = new Date("2026-10-03T00:00:00.000Z");
    expect(joinedBy(doj, "2026-10-02")).toBe(false);
    expect(joinedBy(doj, "2026-10-03")).toBe(true);
    expect(joinedBy(doj, "2026-10-04")).toBe(true);
  });

  it("reads a joining instant stored at IST midnight as that IST day", () => {
    // 3 Oct IST midnight = 2 Oct 18:30 UTC; a UTC slice would wrongly say 2 Oct.
    const doj = new Date("2026-10-02T18:30:00.000Z");
    expect(istDayKey(doj)).toBe("2026-10-03");
    expect(joinedBy(doj, "2026-10-02")).toBe(false);
    expect(joinedBy(doj, "2026-10-03")).toBe(true);
  });
});
