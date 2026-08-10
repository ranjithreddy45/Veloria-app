import { describe, it, expect } from "vitest";
import { daysSinceTouch } from "./engagement";

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("daysSinceTouch", () => {
  it("returns null for a lead nobody has ever touched", () => {
    // The distinction this whole feature rests on. A never-touched lead must
    // NOT collapse to 0 — "contacted today" and "never contacted in its life"
    // are opposite ends of the follow-up queue, and a 0 would sort the most
    // neglected lead in with the best-worked ones.
    expect(daysSinceTouch(null, NOW)).toBeNull();
    expect(daysSinceTouch(undefined, NOW)).toBeNull();
  });

  it("counts whole days, not rounded ones", () => {
    // 23 hours ago is still "today" to a rep chasing a list.
    expect(daysSinceTouch(new Date("2026-08-19T13:00:00.000Z"), NOW)).toBe(0);
    expect(daysSinceTouch(new Date("2026-08-19T11:00:00.000Z"), NOW)).toBe(1);
  });

  it("measures real staleness over longer gaps", () => {
    expect(daysSinceTouch(new Date("2026-08-13T12:00:00.000Z"), NOW)).toBe(7);
    expect(daysSinceTouch(new Date("2026-08-06T12:00:00.000Z"), NOW)).toBe(14);
  });

  it("does not go negative on a clock skew", () => {
    // A touch stamped slightly in the future (server/client skew) should read
    // as "today", never as a negative age that sorts to the top of the queue.
    expect(daysSinceTouch(new Date("2026-08-20T12:00:01.000Z"), NOW)).toBeLessThanOrEqual(0);
  });
});
