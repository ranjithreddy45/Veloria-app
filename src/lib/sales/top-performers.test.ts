import { describe, expect, it } from "vitest";
import { chaseLine, ordinal, periodAwards, raceShare, rankTopPerformers } from "./top-performers";

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


describe("chaseLine", () => {
  const board = rankTopPerformers([p("Nayana", 7), p("Kiran", 4), p("Asha", 4), p("Dev", 1)]);

  it("tells the leader how far ahead they are", () => {
    expect(chaseLine(board, "Nayana")).toBe("You're 1st, 3 ahead of Asha and Kiran.");
  });

  it("names a real gap to the nearest person ahead", () => {
    expect(chaseLine(board, "Kiran")).toBe("You're joint 2nd. 3 more to tie Nayana, 4 to pass.");
    expect(chaseLine(board, "Dev")).toBe("You're 4th. 3 more to tie Asha and Kiran, 4 to pass.");
  });

  it("says 'ties' when one more does it", () => {
    const b = rankTopPerformers([p("A", 3), p("B", 2)]);
    expect(chaseLine(b, "B")).toBe("You're 2nd. 1 more ties A, 2 to pass.");
  });

  it("never gives someone with no closes a rank — only the way onto the board", () => {
    expect(chaseLine(board, "Nobody")).toBe("One confirmed booking puts you on the board.");
    expect(chaseLine([], "Nobody")).toBe("Nobody has closed yet this period. The first booking takes 1st place.");
  });

  it("handles a shared lead and a lone leader", () => {
    expect(chaseLine(rankTopPerformers([p("A", 3), p("B", 3)]), "A")).toContain("tied for 1st");
    expect(chaseLine(rankTopPerformers([p("A", 3)]), "A")).toContain("only one on the board");
  });

  it("is silent when there is no signed-in viewer", () => {
    expect(chaseLine(board, null)).toBeNull();
  });
});

describe("periodAwards", () => {
  const full = (name: string, c: number, rev: number, sv: number, q: number, v: number) =>
    ({ userId: name, name, bookingsConfirmed: c, revenue: rev, siteVisits: sv, quotationsSent: q, salesScore: v });

  it("gives each award to whoever really has the top figure", () => {
    const a = periodAwards([full("A", 5, 100, 2, 9, 40), full("B", 2, 900, 8, 3, 70)]);
    const by = Object.fromEntries(a.map((x) => [x.id, x.holders.map((h) => h.name).join("+")]));
    expect(by).toEqual({ closer: "A", value: "B", visits: "B", quotes: "A", velos: "B" });
  });

  it("shares an award on a tie instead of picking by name", () => {
    const a = periodAwards([full("A", 3, 0, 0, 0, 0), full("B", 3, 0, 0, 0, 0)]);
    expect(a).toHaveLength(1);
    expect(a[0].holders.map((h) => h.name)).toEqual(["A", "B"]);
  });

  it("gives no award for a measure nobody scored on", () => {
    expect(periodAwards([full("A", 0, 0, 0, 0, 0)])).toEqual([]);
  });
});

describe("raceShare", () => {
  it("is relative to the leader, with a visible minimum", () => {
    expect(raceShare(7, 7)).toBe(100);
    expect(raceShare(1, 50)).toBe(4);
    expect(raceShare(0, 7)).toBe(0);
    expect(raceShare(3, 0)).toBe(0);
  });
});
