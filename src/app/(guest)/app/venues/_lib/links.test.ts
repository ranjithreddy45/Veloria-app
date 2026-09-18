import { describe, expect, it } from "vitest";
import { compareHref, quoteHref, visitHref } from "./links";

describe("visitHref", () => {
  it("prefills hall, kind and event type", () => {
    expect(visitHref({ kind: "MENU_TASTING", venueId: "hall_1", eventType: "Birthday Party" })).toBe("/visit?venueId=hall_1&kind=MENU_TASTING&eventType=Birthday+Party");
  });

  it("round-trips through URLSearchParams the way /visit reads it", () => {
    const q = new URLSearchParams(visitHref({ kind: "SITE_VISIT", venueId: "a&b=c", eventType: "  Wedding  &  Reception " }).split("?")[1]);
    expect(q.get("venueId")).toBe("a&b=c");
    expect(q.get("kind")).toBe("SITE_VISIT");
    expect(q.get("eventType")).toBe("Wedding & Reception");
  });

  it("leaves out what is unknown", () => {
    expect(visitHref({ kind: "SITE_VISIT" })).toBe("/visit?kind=SITE_VISIT");
    expect(visitHref({ kind: "SITE_VISIT", venueId: null, eventType: "   " })).toBe("/visit?kind=SITE_VISIT");
  });

  it("caps the event type at the form's 80 characters", () => {
    const q = new URLSearchParams(visitHref({ kind: "SITE_VISIT", eventType: "x".repeat(120) }).split("?")[1]);
    expect(q.get("eventType")).toHaveLength(80);
  });
});

describe("quoteHref", () => {
  it("prefills the hall for the configurator", () => {
    expect(quoteHref({ venueId: "hall_1" })).toBe("/configure?venue=hall_1");
    expect(quoteHref()).toBe("/configure");
  });
});

describe("compareHref", () => {
  it("lists halls as repeated h parameters", () => {
    expect(compareHref(["a", "b"])).toBe("/app/venues/compare?h=a&h=b");
    expect(compareHref()).toBe("/app/venues/compare");
  });
});
