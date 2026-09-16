import { describe, expect, it } from "vitest";
import { HALL_CAP_BANDS } from "../venues/_lib/hall-search";
import {
  RAIL_LIMIT,
  browseSubtitle,
  capacityRangeText,
  countdownFigure,
  countdownPhrase,
  orderHallsForRail,
  seeAllLabel,
} from "./home-browse";

const hall = (id: string, capacity: number) => ({ id, capacity });

describe("orderHallsForRail", () => {
  it("leads with the hall the team books most often", () => {
    const halls = [hall("small", 100), hall("big", 2000), hall("mid", 500)];
    expect(orderHallsForRail(halls, "small").map((h) => h.id)).toEqual(["small", "big", "mid"]);
  });

  it("falls back to the largest room first when nothing is booked most", () => {
    const halls = [hall("small", 100), hall("big", 2000), hall("mid", 500)];
    expect(orderHallsForRail(halls, null).map((h) => h.id)).toEqual(["big", "mid", "small"]);
  });

  it("ignores a most-booked hall that is not in the feed", () => {
    const halls = [hall("a", 300), hall("b", 900)];
    expect(orderHallsForRail(halls, "archived").map((h) => h.id)).toEqual(["b", "a"]);
  });

  it("keeps equal capacities in the order they arrived, so the rail is stable", () => {
    const halls = [hall("a", 500), hall("b", 500), hall("c", 500)];
    expect(orderHallsForRail(halls, null).map((h) => h.id)).toEqual(["a", "b", "c"]);
    expect(orderHallsForRail(halls, "c").map((h) => h.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the halls it was given", () => {
    const halls = [hall("a", 100), hall("b", 900)];
    orderHallsForRail(halls, null);
    expect(halls.map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("handles an empty feed", () => {
    expect(orderHallsForRail([], "anything")).toEqual([]);
  });
});

describe("the size shortcuts the home screen offers", () => {
  it("are the feed's own capacity bands, so a chip on either screen filters the same halls", () => {
    expect(HALL_CAP_BANDS.map((b) => b.label)).toEqual(["Up to 100", "100–200", "200–500", "500+"]);
  });

  it("place every real hall size in exactly one band", () => {
    for (const capacity of [100, 101, 200, 201, 500, 501, 2000]) {
      const bands = HALL_CAP_BANDS.filter((b) => capacity >= b.min && (b.max === null || capacity <= b.max));
      expect(bands).toHaveLength(1);
    }
  });
});

describe("seeAllLabel", () => {
  it("counts the halls that really exist", () => {
    expect(seeAllLabel(11)).toBe("See all 11 spaces");
    expect(seeAllLabel(1)).toBe("See all 1 space");
  });

  it("claims no count when there are none", () => {
    expect(seeAllLabel(0)).toBe("See all spaces");
  });
});

describe("browseSubtitle", () => {
  it("says how many spaces there are and what they seat", () => {
    expect(browseSubtitle(11, "100–2,000 guests")).toBe("11 spaces, seating 100–2,000 guests.");
    expect(browseSubtitle(1, null)).toBe("One space to choose from.");
  });

  it("claims no seating range when the halls carry none", () => {
    expect(browseSubtitle(11)).not.toContain("seating");
  });

  it("promises nothing when no hall is published", () => {
    const s = browseSubtitle(0, "100–2,000 guests");
    expect(s).not.toMatch(/\d/);
    expect(s).toContain("as soon as");
  });
});

describe("capacityRangeText", () => {
  it("spans the smallest and largest hall on record", () => {
    expect(capacityRangeText([hall("a", 2000), hall("b", 100), hall("c", 500)])).toBe("100–2,000 guests");
  });

  it("does not print a range for a single size", () => {
    expect(capacityRangeText([hall("a", 350), hall("b", 350)])).toBe("350 guests");
  });

  it("claims nothing when no hall carries a capacity", () => {
    expect(capacityRangeText([])).toBeNull();
    expect(capacityRangeText([hall("a", 0)])).toBeNull();
  });

  it("ignores a hall with no capacity rather than reading it as zero", () => {
    expect(capacityRangeText([hall("a", 0), hall("b", 800)])).toBe("800 guests");
  });
});

describe("countdownPhrase", () => {
  it("names the day itself", () => {
    expect(countdownPhrase(0)).toBe("Today");
  });

  it("counts forward to an event still to come", () => {
    expect(countdownPhrase(1)).toBe("in 1 day");
    expect(countdownPhrase(12)).toBe("in 12 days");
    expect(countdownPhrase(1200)).toBe("in 1,200 days");
  });

  it("counts back from one that has passed", () => {
    expect(countdownPhrase(-1)).toBe("1 day ago");
    expect(countdownPhrase(-40)).toBe("40 days ago");
  });
});

describe("countdownFigure", () => {
  it("matches the phrase for the same day", () => {
    expect(countdownFigure(0)).toEqual({ value: "Today", caption: "is your event day" });
    expect(countdownFigure(1)).toEqual({ value: "1", caption: "day to go" });
    expect(countdownFigure(12)).toEqual({ value: "12", caption: "days to go" });
    expect(countdownFigure(-1)).toEqual({ value: "1", caption: "day ago" });
    expect(countdownFigure(-12)).toEqual({ value: "12", caption: "days ago" });
  });

  it("never shows a negative figure", () => {
    expect(countdownFigure(-90).value).toBe("90");
  });
});

describe("RAIL_LIMIT", () => {
  it("leaves room for the see-all card", () => {
    expect(RAIL_LIMIT).toBeGreaterThan(0);
  });
});
