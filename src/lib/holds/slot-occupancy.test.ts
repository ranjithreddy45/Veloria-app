import { describe, it, expect } from "vitest";
import { occupyingBookings, slotIsFree, withoutLapsedHolds } from "./slot-occupancy";
import type { HoldFacts } from "./lapsed-hold";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-16T06:00:00.000Z");
const FUTURE = new Date("2026-09-16T14:00:00.000Z");

describe("slotIsFree — the engine's conflict rules", () => {
  it("an empty day is free in every slot", () => {
    for (const s of ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const) expect(slotIsFree(s, [], [])).toBe(true);
  });

  it("FULL_DAY clashes with any booking on the day", () => {
    expect(slotIsFree("FULL_DAY", [{ timeSlot: "EVENING" }], [])).toBe(false);
    expect(slotIsFree("FULL_DAY", [{ timeSlot: "FULL_DAY" }], [])).toBe(false);
  });

  it("a partial slot clashes only with itself or FULL_DAY", () => {
    expect(slotIsFree("MORNING", [{ timeSlot: "MORNING" }], [])).toBe(false);
    expect(slotIsFree("MORNING", [{ timeSlot: "FULL_DAY" }], [])).toBe(false);
    expect(slotIsFree("MORNING", [{ timeSlot: "EVENING" }], [])).toBe(true);
  });

  it("blackouts: whole-day blocks everything; a slot blackout blocks its slot and FULL_DAY", () => {
    expect(slotIsFree("EVENING", [], [{ timeSlot: null }])).toBe(false);
    expect(slotIsFree("FULL_DAY", [], [{ timeSlot: null }])).toBe(false);
    expect(slotIsFree("EVENING", [], [{ timeSlot: "EVENING" }])).toBe(false);
    expect(slotIsFree("FULL_DAY", [], [{ timeSlot: "MORNING" }])).toBe(false);
    expect(slotIsFree("AFTERNOON", [], [{ timeSlot: "MORNING" }])).toBe(true);
  });
});

describe("lapsed and paid holds", () => {
  const lapsedHold = { id: "lapsed", timeSlot: "EVENING", status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "SENT", paidAmount: 0, payments: [] }] };
  const paidExpiredHold = { id: "paid", timeSlot: "EVENING", status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "PARTIALLY_PAID", paidAmount: 1000, payments: [] }] };
  const liveHold = { id: "live", timeSlot: "EVENING", status: "HOLD", holdExpiresAt: FUTURE, invoices: [] };
  const confirmed = { id: "confirmed", timeSlot: "FULL_DAY", status: "CONFIRMED", holdExpiresAt: null, invoices: [] };

  const free = (rows: (HoldFacts & { id: string; timeSlot: string })[], slot: "EVENING" | "FULL_DAY" | "MORNING") =>
    slotIsFree(slot, occupyingBookings(rows, NOW), []);

  it("a lapsed hold no longer blocks its slot", () => {
    expect(free([lapsedHold], "EVENING")).toBe(true);
    expect(free([lapsedHold], "FULL_DAY")).toBe(true);
  });

  it("an expired hold with a part payment still blocks — money protects the date", () => {
    expect(free([paidExpiredHold], "EVENING")).toBe(false);
  });

  it("a hold inside its window blocks", () => {
    expect(free([liveHold], "EVENING")).toBe(false);
  });

  it("removing a lapsed hold never unblocks a slot someone else holds", () => {
    expect(free([lapsedHold, confirmed], "MORNING")).toBe(false);
    expect(free([lapsedHold, liveHold], "EVENING")).toBe(false);
  });

  it("withoutLapsedHolds drops exactly the ids found lapsed", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(withoutLapsedHolds(rows, new Set(["b"])).map((r) => r.id)).toEqual(["a", "c"]);
    expect(withoutLapsedHolds(rows, new Set())).toHaveLength(3);
  });
});
