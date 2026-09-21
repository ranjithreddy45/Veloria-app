import { describe, expect, it } from "vitest";
import { ordinal, rankTopPerformers } from "./top-performers";

const p = (name: string, bookingsConfirmed: number, revenue = 0) => ({ userId: name, name, bookingsConfirmed, revenue });

describe("rankTopPerformers", () => {
  it("orders by number closed, most first", () => {
    const r = rankTopPerformers([p("Asha", 2), p("Nayana", 7), p("Kiran", 4)]);
    expect(r.map((x) => [x.name, x.place])).toEqual([["Nayana", 1], ["Kiran", 2], ["Asha", 3]]);
  });

  it("gives equal closes the same place and skips the next one (1, 2, 2, 4)", () => {
    const r = rankTopPerformers([p("A", 9), p("B", 4, 100), p("C", 4, 900), p("D", 1)]);
    expect(r.map((x) => x.place)).toEqual([1, 2, 2, 4]);
    expect(r.filter((x) => x.tied).map((x) => x.name).sort()).toEqual(["B", "C"]);
  });

  it("uses revenue only to order people inside a tie — never to change a place", () => {
    const r = rankTopPerformers([p("Small", 3, 10), p("Big", 3, 5_000_000), p("Top", 5, 1)]);
    expect(r[0].name).toBe("Top"); // fewer rupees, more closes: still first
    expect(r.slice(1).map((x) => x.name)).toEqual(["Big", "Small"]);
    expect(r.slice(1).every((x) => x.place === 2)).toBe(true);
  });

  it("leaves people with no closes off the strip", () => {
    expect(rankTopPerformers([p("A", 0), p("B", 2), p("C", Number.NaN)]).map((x) => x.name)).toEqual(["B"]);
    expect(rankTopPerformers([p("A", 0)])).toEqual([]);
  });
});

describe("ordinal", () => {
  it("handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]
    );
  });
});
