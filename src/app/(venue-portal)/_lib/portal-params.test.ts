import { describe, expect, it } from "vitest";
import {
  calendarBounds,
  compareMonths,
  countLabel,
  countWord,
  eventTypeLabel,
  firstParam,
  guestsLabel,
  longDate,
  monthGrid,
  monthTitle,
  parseCalendarMonth,
  portalHref,
  shiftMonth,
} from "./portal-params";

const OCT_2026 = { year: 2026, month: 10 };

describe("parseCalendarMonth", () => {
  it("defaults to the current month when either param is missing or malformed", () => {
    expect(parseCalendarMonth(undefined, undefined, OCT_2026)).toEqual(OCT_2026);
    expect(parseCalendarMonth("2026", undefined, OCT_2026)).toEqual(OCT_2026);
    expect(parseCalendarMonth("2026", "abc", OCT_2026)).toEqual(OCT_2026);
    expect(parseCalendarMonth("2026.5", "3", OCT_2026)).toEqual(OCT_2026);
    expect(parseCalendarMonth("-1", "3", OCT_2026)).toEqual(OCT_2026);
    expect(parseCalendarMonth("99999", "3", OCT_2026)).toEqual(OCT_2026);
  });

  it("takes a valid month as given", () => {
    expect(parseCalendarMonth("2027", "2", OCT_2026)).toEqual({ year: 2027, month: 2 });
    expect(parseCalendarMonth("2026", "08", OCT_2026)).toEqual({ year: 2026, month: 8 });
  });

  it("pulls out-of-range values to the nearest edge instead of rolling over", () => {
    expect(parseCalendarMonth("2026", "13", OCT_2026)).toEqual({ year: 2026, month: 12 });
    expect(parseCalendarMonth("2026", "0", OCT_2026)).toEqual({ year: 2026, month: 1 });
    expect(parseCalendarMonth("1900", "5", OCT_2026)).toEqual({ year: 2021, month: 5 });
    expect(parseCalendarMonth("2500", "5", OCT_2026)).toEqual({ year: 2031, month: 5 });
  });
});

describe("month arithmetic", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(OCT_2026, 0)).toEqual(OCT_2026);
    expect(shiftMonth(OCT_2026, -22)).toEqual({ year: 2024, month: 12 });
  });

  it("orders months and bounds the calendar", () => {
    expect(compareMonths({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
    expect(compareMonths(OCT_2026, OCT_2026)).toBe(0);
    expect(calendarBounds(OCT_2026)).toEqual({ min: { year: 2021, month: 1 }, max: { year: 2031, month: 12 } });
  });

  it("names months and days", () => {
    expect(monthTitle(OCT_2026)).toBe("October 2026");
    expect(longDate("2026-10-14")).toBe("Wednesday, 14 October 2026");
    expect(longDate("2027-01-01")).toBe("Friday, 1 January 2027");
  });
});

describe("monthGrid", () => {
  it("pads October 2026 (starts Thursday, 31 days) to whole Sunday-first weeks", () => {
    const cells = monthGrid(2026, 10);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ key: "2026-09-27", day: 27, inMonth: false });
    expect(cells[4]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(cells[34]).toEqual({ key: "2026-10-31", day: 31, inMonth: true });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("handles a month that needs six rows and one that starts on Sunday", () => {
    // August 2026 starts on Saturday: 6 lead days + 31 = 37 → 42 cells.
    const aug = monthGrid(2026, 8);
    expect(aug).toHaveLength(42);
    expect(aug[6].key).toBe("2026-08-01");
    expect(aug[41]).toEqual({ key: "2026-09-05", day: 5, inMonth: false });
    // February 2026 starts on Sunday and has exactly 28 days: four rows, no padding.
    const feb = monthGrid(2026, 2);
    expect(feb).toHaveLength(28);
    expect(feb.every((c) => c.inMonth)).toBe(true);
  });

  it("knows leap years", () => {
    expect(monthGrid(2028, 2).filter((c) => c.inMonth)).toHaveLength(29);
  });
});

describe("portalHref", () => {
  it("drops defaults and empty values", () => {
    expect(portalHref("/venue-portal", { venue: "all", period: "month" })).toBe("/venue-portal");
    expect(portalHref("/venue-portal", { venue: "v1", period: "year" })).toBe("/venue-portal?venue=v1&period=year");
    expect(portalHref("/venue-portal", { venue: null, period: "" })).toBe("/venue-portal");
  });

  it("encodes values and keeps numbers", () => {
    expect(portalHref("/venue-portal/calendar", { year: 2026, month: 3, venue: "a&b" })).toBe("/venue-portal/calendar?year=2026&month=3&venue=a%26b");
  });

  it("reads the first of a repeated param", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("x")).toBe("x");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("wording", () => {
  it("counts each kind", () => {
    expect(countLabel("booking", 2)).toBe("2 booked");
    expect(countLabel("hold", 1)).toBe("1 on hold");
    expect(countLabel("lead", 1)).toBe("1 enquiry");
    expect(countLabel("lead", 3)).toBe("3 enquiries");
    expect(countWord("lead", 1)).toBe("enquiry");
    expect(countWord("hold", 4)).toBe("on hold");
  });

  it("softens enum-style event types and leaves display strings alone", () => {
    expect(eventTypeLabel("Birthday Party")).toBe("Birthday Party");
    expect(eventTypeLabel("CORPORATE_EVENT")).toBe("Corporate event");
    expect(eventTypeLabel("WEDDING")).toBe("Wedding");
    expect(eventTypeLabel("  ")).toBeNull();
    expect(eventTypeLabel(null)).toBeNull();
  });

  it("labels guest counts", () => {
    expect(guestsLabel(120)).toBe("120 guests");
    expect(guestsLabel(1)).toBe("1 guest");
    expect(guestsLabel(1500)).toBe("1,500 guests");
    expect(guestsLabel(0)).toBeNull();
    expect(guestsLabel(null)).toBeNull();
  });
});
