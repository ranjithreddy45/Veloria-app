import { describe, expect, it } from "vitest";
import { buildComparison, parseCompareIds, type CompareHallInput } from "./compare";

const known = ["a", "b", "c", "d"];

describe("parseCompareIds", () => {
  it("reads repeated h parameters in order", () => {
    expect(parseCompareIds({ h: ["b", "a"] }, known)).toEqual({ ids: ["b", "a"], extra: 0 });
  });

  it("reads a single h and a comma list", () => {
    expect(parseCompareIds({ h: "a", ids: "c, d" }, known)).toEqual({ ids: ["a", "c", "d"], extra: 0 });
  });

  it("drops unknown and repeated halls", () => {
    expect(parseCompareIds({ h: ["a", "zzz", "a", " b "] }, known)).toEqual({ ids: ["a", "b"], extra: 0 });
  });

  it("keeps the first three and counts the rest", () => {
    expect(parseCompareIds({ h: ["a", "b", "c", "d"] }, known)).toEqual({ ids: ["a", "b", "c"], extra: 1 });
  });

  it("handles nothing picked", () => {
    expect(parseCompareIds({}, known)).toEqual({ ids: [], extra: 0 });
  });
});

const crystal: CompareHallInput = {
  id: "a",
  name: "Crystal Hall",
  capacity: 1200,
  amenities: ["AC", "Valet parking", "Bridal room"],
  price: { fromSlotPrice: 150000, perGuestRate: 0 },
  rating: { rating: 4.6, count: 12 },
  inHouseCateringRequired: false,
  inHouseCateringNote: null,
};
const terrace: CompareHallInput = {
  id: "b",
  name: "Terrace",
  capacity: 250,
  amenities: [" ac ", "Rooftop  view", ""],
  price: { fromSlotPrice: null, perGuestRate: 0 },
  rating: null,
  inHouseCateringRequired: true,
  inHouseCateringNote: " Food by the in-house kitchen only. ",
};

describe("buildComparison", () => {
  const c = buildComparison([crystal, terrace]);

  it("lines up each hall's own facts", () => {
    expect(c.halls).toEqual([
      { id: "a", name: "Crystal Hall" },
      { id: "b", name: "Terrace" },
    ]);
    expect(c.capacity).toEqual([
      { main: "Up to 1,200", sub: "guests" },
      { main: "Up to 250", sub: "guests" },
    ]);
  });

  it("uses the pricing engine's figure, or says the price is on request", () => {
    expect(c.price).toEqual([
      { main: "from ₹1.50 L", sub: "per slot" },
      { main: "Price on request", sub: null },
    ]);
  });

  it("shows ratings only when there are approved reviews", () => {
    expect(c.rating).toEqual([
      { main: "4.6 ★", sub: "12 reviews" },
      { main: "No reviews yet", sub: null },
    ]);
    expect(buildComparison([{ ...crystal, rating: { rating: 5, count: 1 } }]).rating[0]).toEqual({ main: "5 ★", sub: "1 review" });
  });

  it("states the in-house catering requirement with the team's note", () => {
    expect(c.catering).toEqual([
      { main: "Not required", sub: null },
      { main: "Required", sub: "Food by the in-house kitchen only." },
    ]);
  });

  it("does not guess the catering rule when it could not be read", () => {
    expect(buildComparison([{ ...crystal, inHouseCateringRequired: null }]).catering[0]).toEqual({ main: "Not available", sub: null });
  });

  it("merges amenity spellings and lists shared ones first", () => {
    expect(c.amenities).toEqual([
      { label: "AC", has: [true, true] },
      { label: "Valet parking", has: [true, false] },
      { label: "Bridal room", has: [true, false] },
      { label: "Rooftop view", has: [false, true] },
    ]);
  });
});
