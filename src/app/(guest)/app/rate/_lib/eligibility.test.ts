import { describe, it, expect } from "vitest";
import {
  RATING_STATES,
  composeReview,
  istDayKey,
  pickBookingToRate,
  ratingBlockedMessage,
  ratingState,
  reviewState,
} from "./eligibility";

// 12:00 noon in Bengaluru on 16 September 2026.
const NOW = new Date("2026-09-16T06:30:00Z");
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

describe("rating eligibility follows the team's rule: completed events only, one review each", () => {
  it("opens for a completed booking without a review", () => {
    expect(ratingState({ status: "COMPLETED", date: day("2026-09-10") }, false, NOW)).toBe("OPEN");
  });

  it("shows the existing review instead of a second form", () => {
    expect(ratingState({ status: "COMPLETED", date: day("2026-09-10") }, true, NOW)).toBe("ALREADY_REVIEWED");
  });

  it("explains an event that is still ahead", () => {
    expect(ratingState({ status: "CONFIRMED", date: day("2026-09-20") }, false, NOW)).toBe("UPCOMING");
  });

  it("explains an event taking place today", () => {
    expect(ratingState({ status: "CONFIRMED", date: day("2026-09-16") }, false, NOW)).toBe("TODAY");
  });

  it("explains a past event the team has not closed yet, rather than failing", () => {
    expect(ratingState({ status: "CONFIRMED", date: day("2026-09-14") }, false, NOW)).toBe("AWAITING_COMPLETION");
  });

  it("explains an event in progress", () => {
    expect(ratingState({ status: "IN_PROGRESS", date: day("2026-09-16") }, false, NOW)).toBe("IN_PROGRESS");
  });

  it("does not treat an unconfirmed hold as an event that happened, even after its date", () => {
    expect(ratingState({ status: "HOLD", date: day("2026-08-01") }, false, NOW)).toBe("NOT_CONFIRMED");
    expect(ratingState({ status: "TENTATIVE", date: day("2026-10-01") }, false, NOW)).toBe("NOT_CONFIRMED");
  });

  it("handles cancelled bookings and no booking at all", () => {
    expect(ratingState({ status: "CANCELLED", date: day("2026-09-01") }, false, NOW)).toBe("CANCELLED");
    expect(ratingState(null, false, NOW)).toBe("NO_BOOKING");
  });

  it("uses the calendar day in India, not in UTC", () => {
    const bookingDate = day("2026-09-16");
    // 01:30 on 17 Sep in Bengaluru, still 16 Sep in UTC: the event day has passed.
    expect(ratingState({ status: "CONFIRMED", date: bookingDate }, false, new Date("2026-09-16T20:00:00Z"))).toBe("AWAITING_COMPLETION");
    // 01:30 on 16 Sep in Bengaluru, still 15 Sep in UTC: the event is today.
    expect(ratingState({ status: "CONFIRMED", date: bookingDate }, false, new Date("2026-09-15T20:00:00Z"))).toBe("TODAY");
    expect(istDayKey(new Date("2026-09-15T20:00:00Z"))).toBe("2026-09-16");
  });

  it("accepts dates serialised as strings", () => {
    expect(ratingState({ status: "CONFIRMED", date: "2026-09-20T00:00:00.000Z" }, false, NOW)).toBe("UPCOMING");
  });

  it("explains every state that blocks rating; only an open booking has no message", () => {
    for (const state of RATING_STATES) {
      const message = ratingBlockedMessage(state);
      if (state === "OPEN") expect(message).toBeNull();
      else expect(message && message.length > 10).toBe(true);
    }
  });
});

describe("pickBookingToRate", () => {
  const b = (id: string, status: string, date: string) => ({ id, status, date: day(date) });

  it("prefers the latest completed booking that still needs a review", () => {
    const list = [b("old", "COMPLETED", "2026-03-01"), b("new", "COMPLETED", "2026-08-01"), b("next", "CONFIRMED", "2026-12-01")];
    expect(pickBookingToRate(list, new Set(["new"]), NOW)?.id).toBe("old");
    expect(pickBookingToRate(list, new Set(), NOW)?.id).toBe("new");
  });

  it("falls back to the latest completed booking when all are reviewed", () => {
    const list = [b("old", "COMPLETED", "2026-03-01"), b("new", "COMPLETED", "2026-08-01")];
    expect(pickBookingToRate(list, new Set(["old", "new"]), NOW)?.id).toBe("new");
  });

  it("then the latest past booking, then the soonest upcoming one", () => {
    expect(pickBookingToRate([b("past", "CONFIRMED", "2026-09-01"), b("future", "CONFIRMED", "2026-12-01")], new Set(), NOW)?.id).toBe("past");
    expect(pickBookingToRate([b("later", "CONFIRMED", "2027-01-01"), b("sooner", "CONFIRMED", "2026-12-01")], new Set(), NOW)?.id).toBe("sooner");
  });

  it("returns null without bookings", () => {
    expect(pickBookingToRate([], new Set(), NOW)).toBeNull();
  });
});

describe("reviewState: the team's moderation, told honestly", () => {
  it("never promises publication before approval", () => {
    expect(reviewState({ isApproved: false, isPublic: true })).toBe("WITH_TEAM");
  });

  it("distinguishes approved public and private reviews", () => {
    expect(reviewState({ isApproved: true, isPublic: true })).toBe("PUBLISHED");
    expect(reviewState({ isApproved: true, isPublic: false })).toBe("APPROVED_PRIVATE");
  });
});

describe("composeReview", () => {
  it("requires a whole rating from 1 to 5", () => {
    expect(composeReview({ rating: 0, tags: [], text: "" }).ok).toBe(false);
    expect(composeReview({ rating: 6, tags: [], text: "" }).ok).toBe(false);
    expect(composeReview({ rating: 4.5, tags: [], text: "" }).ok).toBe(false);
  });

  it("keeps only known highlights and the customer's words", () => {
    expect(composeReview({ rating: 5, tags: ["Food", "Hacked", "Food", "Decor"], text: " Lovely evening. " })).toEqual({
      ok: true,
      rating: 5,
      content: "Highlights: Food, Decor. Lovely evening.",
    });
  });

  it("always meets the team's 10-character minimum", () => {
    const r = composeReview({ rating: 3, tags: [], text: "ok" });
    expect(r).toEqual({ ok: true, rating: 3, content: "ok Rated 3 out of 5." });
    const empty = composeReview({ rating: 5, tags: [], text: "" });
    expect(empty.ok && empty.content.length >= 10).toBe(true);
  });
});
