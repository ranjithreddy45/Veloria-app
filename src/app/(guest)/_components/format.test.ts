import { afterEach, describe, expect, it, vi } from "vitest";
import { SLOT_HOURS, SLOT_NAME, TIME_SLOTS, slotTimeText } from "@/lib/sales/slot";
import { SLOT_SHORT, daysUntil, fmtDate, hallPriceText, slotShortText, toISODateIST } from "./format";

describe("fmtDate", () => {
  it("shows a UTC-midnight @db.Date as that same Indian day", () => {
    expect(fmtDate("2026-10-02T00:00:00.000Z", { day: "numeric", month: "short", year: "numeric" })).toBe("2 Oct 2026");
  });

  it("shows a late-evening UTC instant as the next Indian day", () => {
    expect(fmtDate("2026-10-01T20:00:00.000Z", { day: "numeric", month: "short" })).toBe("2 Oct");
  });

  it("lets a caller choose another timezone", () => {
    expect(fmtDate("2026-10-01T20:00:00.000Z", { day: "numeric", month: "short", timeZone: "UTC" })).toBe("1 Oct");
  });
});

describe("daysUntil", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts Indian calendar days, even just after midnight in India", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T20:00:00.000Z")); // 01:30 IST on 17 Sep
    expect(daysUntil("2026-09-17T00:00:00.000Z")).toBe(0);
    expect(daysUntil("2026-09-18T00:00:00.000Z")).toBe(1);
    expect(daysUntil("2026-09-16T00:00:00.000Z")).toBe(-1);
  });

  it("is NaN for an invalid date", () => {
    expect(daysUntil("not a date")).toBeNaN();
  });
});

describe("toISODateIST", () => {
  it("uses the Indian calendar day", () => {
    expect(toISODateIST(new Date("2026-12-31T19:00:00.000Z"))).toBe("2027-01-01");
    expect(toISODateIST(new Date("2026-12-31T18:00:00.000Z"))).toBe("2026-12-31");
  });
});

describe("hallPriceText", () => {
  it("words a from-price per slot", () => {
    expect(hallPriceText({ fromSlotPrice: 150000, perGuestRate: 0 })).toEqual({ amount: "₹1.50 L", main: "from ₹1.50 L", sub: "per slot", perGuest: null });
  });

  it("adds the per-guest rate the team's engine charges", () => {
    expect(hallPriceText({ fromSlotPrice: 90000, perGuestRate: 350 })).toEqual({
      amount: "₹90K",
      main: "from ₹90K",
      sub: "per slot + ₹350 per guest",
      perGuest: "+ ₹350 per guest",
    });
  });

  it("never shows a zero or missing price", () => {
    expect(hallPriceText({ fromSlotPrice: null, perGuestRate: 350 })).toEqual({ amount: null, main: "Price on request", sub: null, perGuest: null });
    expect(hallPriceText({ fromSlotPrice: 0, perGuestRate: 0 }).amount).toBeNull();
    expect(hallPriceText(undefined).main).toBe("Price on request");
  });
});

// The guest app's slot names and hours are the team's (src/lib/sales/slot.ts).
describe("SLOT_SHORT", () => {
  it("names each slot with the team's hours, and no hours where the team has set none", () => {
    for (const slot of TIME_SLOTS) {
      expect(SLOT_SHORT[slot], slot).toEqual({ label: SLOT_NAME[slot], time: slotTimeText(slot) });
      if (!SLOT_HOURS[slot]) expect(SLOT_SHORT[slot].time, slot).toBeNull();
    }
  });
});

describe("slotShortText", () => {
  it("adds the hours only for a slot the team has set hours for", () => {
    for (const slot of TIME_SLOTS) {
      const time = slotTimeText(slot);
      expect(slotShortText(slot), slot).toBe(time ? `${SLOT_NAME[slot]} · ${time}` : SLOT_NAME[slot]);
      if (!SLOT_HOURS[slot]) expect(slotShortText(slot), slot).not.toMatch(/\d/);
    }
  });

  it("is null for a missing or unknown slot", () => {
    expect(slotShortText(null)).toBeNull();
    expect(slotShortText("")).toBeNull();
    expect(slotShortText("BRUNCH")).toBeNull();
    expect(slotShortText("constructor")).toBeNull();
  });
});
