import { describe, expect, it } from "vitest";
import type { VisitKindOption } from "@/actions/public-site-visit.actions";
import { readVisitPrefill } from "./visit-prefill";

const venues = [
  { id: "hall_a", name: "Crystal Hall" },
  { id: "hall_b", name: "Terrace" },
];
const kinds: VisitKindOption[] = [
  { kind: "SITE_VISIT", label: "Venue tour", tagline: "" },
  { kind: "MENU_TASTING", label: "Menu tasting", tagline: "" },
];
const read = (qs: string, offered: VisitKindOption[] = kinds) => {
  const p = new URLSearchParams(qs);
  return readVisitPrefill((key) => p.get(key), venues, offered);
};

describe("readVisitPrefill", () => {
  it("reads the hall, kind and event type the customer app sends", () => {
    expect(read("venueId=hall_b&kind=MENU_TASTING&eventType=Birthday+Party")).toEqual({ venueId: "hall_b", kind: "MENU_TASTING", eventType: "Birthday Party" });
  });

  it("accepts the venue and occasion spellings", () => {
    expect(read("venue=hall_a&occasion=Wedding")).toEqual({ venueId: "hall_a", eventType: "Wedding" });
  });

  it("ignores a hall that is not bookable", () => {
    expect(read("venueId=gone&kind=SITE_VISIT")).toEqual({ kind: "SITE_VISIT" });
  });

  it("understands common spellings of the visit kind", () => {
    for (const k of ["menu_tasting", "tasting", "food-tasting", "Menu Tasting"]) expect(read(`kind=${encodeURIComponent(k)}`).kind).toBe("MENU_TASTING");
    for (const k of ["site_visit", "visit", "tour"]) expect(read(`kind=${k}`).kind).toBe("SITE_VISIT");
    expect(read("kind=party").kind).toBeUndefined();
  });

  it("ignores a kind the scheduler does not offer", () => {
    expect(read("kind=MENU_TASTING", [kinds[0]]).kind).toBeUndefined();
  });

  it("cleans and caps the event type", () => {
    expect(read(`eventType=${encodeURIComponent("  Wedding \n\t Reception ")}`).eventType).toBe("Wedding Reception");
    expect(read(`eventType=${"x".repeat(200)}`).eventType).toHaveLength(80);
    expect(read("eventType=%20%20").eventType).toBeUndefined();
  });

  it("takes only a sensible guest count", () => {
    expect(read("guests=350").guestCount).toBe(350);
    expect(read("guestCount=12").guestCount).toBe(12);
    expect(read("guests=0").guestCount).toBeUndefined();
    expect(read("guests=-5").guestCount).toBeUndefined();
    expect(read("guests=abc").guestCount).toBeUndefined();
    expect(read("guests=100001").guestCount).toBeUndefined();
  });

  it("returns nothing for a bare link", () => {
    expect(read("")).toEqual({});
  });
});
