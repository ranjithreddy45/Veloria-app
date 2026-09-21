import { describe, expect, it } from "vitest";
import {
  coversSourceLabel,
  hasMealAnswer,
  partyMeals,
  partySize,
  summariseHeadcount,
  type HeadcountGuest,
} from "./headcount";

const guest = (over: Partial<HeadcountGuest> = {}): HeadcountGuest => ({
  rsvpStatus: "ACCEPTED",
  plusOnes: 0,
  ...over,
});

describe("partySize", () => {
  it("counts the guest themselves", () => {
    expect(partySize({ plusOnes: 0 })).toBe(1);
    expect(partySize({ plusOnes: 3 })).toBe(4);
  });

  it("never drops below one, whatever is stored", () => {
    expect(partySize({ plusOnes: -5 })).toBe(1);
    expect(partySize({ plusOnes: Number.NaN })).toBe(1);
    expect(partySize({ plusOnes: 2.7 })).toBe(3); // truncated, not rounded up to 4
  });
});

describe("partyMeals", () => {
  it("reports a party that never answered as unknown, not as zero", () => {
    expect(partyMeals(guest({ plusOnes: 3 }))).toEqual({ veg: 0, nonVeg: 0, jain: 0, unknown: 4 });
  });

  it("returns the split when it accounts for the whole party", () => {
    const g = guest({ plusOnes: 3, mealVeg: 2, mealNonVeg: 1, mealJain: 1 });
    expect(partyMeals(g)).toEqual({ veg: 2, nonVeg: 1, jain: 1, unknown: 0 });
  });

  it("treats a zero as an answer — a party of all non-veg is not 'unknown'", () => {
    const g = guest({ plusOnes: 1, mealVeg: 0, mealNonVeg: 2, mealJain: 0 });
    expect(hasMealAnswer(g)).toBe(true);
    expect(partyMeals(g)).toEqual({ veg: 0, nonVeg: 2, jain: 0, unknown: 0 });
  });

  it("falls back to unknown when a stale split no longer adds up", () => {
    // Answered for 2, then the guest added a plus-one: 3 heads, split covers 2.
    const g = guest({ plusOnes: 2, mealVeg: 1, mealNonVeg: 1, mealJain: 0 });
    expect(partyMeals(g)).toEqual({ veg: 0, nonVeg: 0, jain: 0, unknown: 3 });
  });

  it("contributes nothing for a guest who is not attending", () => {
    const declined = guest({ rsvpStatus: "DECLINED", plusOnes: 4, mealVeg: 5 });
    expect(partyMeals(declined)).toEqual({ veg: 0, nonVeg: 0, jain: 0, unknown: 0 });
    const pending = guest({ rsvpStatus: "PENDING", plusOnes: 4 });
    expect(partyMeals(pending)).toEqual({ veg: 0, nonVeg: 0, jain: 0, unknown: 0 });
  });
});

describe("summariseHeadcount", () => {
  const list: HeadcountGuest[] = [
    guest({ plusOnes: 3, mealVeg: 2, mealNonVeg: 1, mealJain: 1 }), // 4 heads, answered
    guest({ plusOnes: 1 }), //                                          2 heads, unanswered
    guest({ rsvpStatus: "DECLINED", plusOnes: 2 }), //                   3 heads, out
    guest({ rsvpStatus: "PENDING", plusOnes: 0 }), //                    1 head, still in play
  ];

  it("counts HEADS, not rows — plus-ones are people who eat", () => {
    const s = summariseHeadcount(list, 500);
    expect(s.confirmedHeads).toBe(6); // 4 + 2, NOT 2 accepted rows
    expect(s.acceptedGuests).toBe(2);
    expect(s.declinedHeads).toBe(3);
    expect(s.awaitingHeads).toBe(1);
  });

  it("keeps unanswered heads visible instead of folding them into non-veg", () => {
    const s = summariseHeadcount(list, 500);
    expect(s.meals).toEqual({ veg: 2, nonVeg: 1, jain: 1, unknown: 2 });
    const totalled = s.meals.veg + s.meals.nonVeg + s.meals.jain + s.meals.unknown;
    expect(totalled).toBe(s.confirmedHeads);
  });

  it("every invited head lands in exactly one bucket", () => {
    const s = summariseHeadcount(list, 500);
    expect(s.confirmedHeads + s.declinedHeads + s.awaitingHeads).toBe(4 + 2 + 3 + 1);
  });

  it("reports variance against the contract without changing either number", () => {
    expect(summariseHeadcount(list, 500).varianceVsContract).toBe(6 - 500);
    expect(summariseHeadcount(list, 4).varianceVsContract).toBe(2); // more said yes than contracted
  });

  it("has no variance when the booking carries no contracted count", () => {
    const s = summariseHeadcount(list, null);
    expect(s.contractedHeads).toBeNull();
    expect(s.varianceVsContract).toBeNull();
    expect(s.confirmedHeads).toBe(6); // still counted
  });

  it("is all zeroes for an empty list rather than throwing", () => {
    const s = summariseHeadcount([], 100);
    expect(s.confirmedHeads).toBe(0);
    expect(s.meals).toEqual({ veg: 0, nonVeg: 0, jain: 0, unknown: 0 });
    expect(s.varianceVsContract).toBe(-100);
  });
});

describe("coversSourceLabel", () => {
  it("never lets an old sheet imply it came from RSVPs", () => {
    // Every sheet predating this feature has a null source and was stamped from
    // the contracted count, so null must read as contracted — not as unknown.
    expect(coversSourceLabel(null)).toBe("From the contracted guest count");
    expect(coversSourceLabel(undefined)).toBe("From the contracted guest count");
    expect(coversSourceLabel("CONTRACTED")).toBe("From the contracted guest count");
    expect(coversSourceLabel("RSVP_CONFIRMED")).toBe("From confirmed RSVPs");
    expect(coversSourceLabel("MANUAL")).toBe("Set by the team");
  });
});
