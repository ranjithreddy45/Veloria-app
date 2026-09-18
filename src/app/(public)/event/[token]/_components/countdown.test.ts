import { describe, expect, it } from "vitest";
import { dayCountHeadline, daysUntilEventDay, diffParts, timedHeadline } from "./countdown";

// ============================================================
// Morning and Full Day have no hours set by the team, so the public event page
// counts whole days to the event's calendar day in India and never a clock time
// (their eventAtISO is only the ops planning anchor, 9:00 or 10:00 IST).
// Afternoon and Evening keep the hours-and-minutes countdown to the slot's start.
// ============================================================

const at = (iso: string) => new Date(iso).getTime();

describe("a slot without hours: whole days to the event's day in India", () => {
  it("turns over at midnight in India, not in UTC", () => {
    // 11:59 pm on 9 Oct in India is still the day before.
    expect(daysUntilEventDay("2026-10-10", at("2026-10-09T18:29:00.000Z"))).toBe(1);
    // 12:00 am on 10 Oct in India (6:30 pm UTC on the 9th) is the day itself.
    expect(daysUntilEventDay("2026-10-10", at("2026-10-09T18:30:00.000Z"))).toBe(0);
    expect(daysUntilEventDay("2026-10-10", at("2026-10-10T18:29:00.000Z"))).toBe(0);
    expect(daysUntilEventDay("2026-10-10", at("2026-10-10T18:30:00.000Z"))).toBe(-1);
    expect(daysUntilEventDay("2026-10-10", at("2026-09-28T06:00:00.000Z"))).toBe(12);
  });

  it("says today, tomorrow or in N days, and nothing once the day has passed", () => {
    expect(dayCountHeadline("wedding", 0)).toBe("Your wedding is today");
    expect(dayCountHeadline("wedding", 1)).toBe("Your wedding is tomorrow");
    expect(dayCountHeadline("wedding", 12)).toBe("Your wedding is in 12 days");
    expect(dayCountHeadline("wedding", -1)).toBeNull();
    expect(dayCountHeadline("wedding", Number.NaN)).toBeNull();
  });

  it("never names an hour or a minute, even just before the planning anchor", () => {
    // 8:59 am in India on a Morning event's day: the old countdown said "starts in 1 minute".
    const oneMinuteBeforeAnchor = at("2026-10-10T03:29:00.000Z");
    expect(dayCountHeadline("wedding", daysUntilEventDay("2026-10-10", oneMinuteBeforeAnchor))).toBe(
      "Your wedding is today"
    );
    for (let d = 0; d <= 400; d++) expect(dayCountHeadline("event", d)).not.toMatch(/hour|minute|\d:\d/);
  });
});

describe("a slot with hours: counting down to its start", () => {
  const start = at("2026-10-10T11:30:00.000Z"); // Evening: 5:00 pm in India

  it("counts days, then hours, then minutes, and stops once it starts", () => {
    expect(timedHeadline("wedding", diffParts(start, start - 51 * 3_600_000))).toBe("Your wedding is in 2 days");
    expect(timedHeadline("wedding", diffParts(start, start - 5 * 3_600_000))).toBe("Your wedding is in 5 hours");
    expect(timedHeadline("wedding", diffParts(start, start - 60 * 60_000))).toBe("Your wedding is in 1 hour");
    expect(timedHeadline("wedding", diffParts(start, start - 30 * 60_000))).toBe("Your wedding starts in 30 minutes");
    expect(timedHeadline("wedding", diffParts(start, start))).toBeNull();
    expect(timedHeadline("wedding", diffParts(start, start + 60_000))).toBeNull();
  });

  it("splits the time left into days, hours and minutes", () => {
    const left = (26 * 60 + 5) * 60_000;
    expect(diffParts(start, start - left)).toEqual({ ms: left, days: 1, hours: 2, minutes: 5 });
    expect(diffParts(start, start + 1)).toEqual({ ms: 0, days: 0, hours: 0, minutes: 0 });
  });
});
