import { describe, expect, it } from "vitest";
import { conversionPct, dbDateKey, istDayKey, istMonthInstants, lastMonths, ownerOccasion, periodRange, slotLabel } from "./buckets";

describe("venue portal date keys", () => {
  it("keys a manual (IST-midnight) lead and a web (UTC-midnight) lead on the same India day", () => {
    const manual = new Date("2026-10-31T18:30:00.000Z"); // 1 Nov 00:00 IST
    const web = new Date("2026-11-01T00:00:00.000Z");
    expect(istDayKey(manual)).toBe("2026-11-01");
    expect(istDayKey(web)).toBe("2026-11-01");
  });

  it("keeps a lead dated the 1st inside its month window", () => {
    const { start, end } = istMonthInstants(2026, 11);
    const manual = new Date("2026-10-31T18:30:00.000Z");
    expect(manual >= start && manual < end).toBe(true);
  });

  it("keys a @db.Date booking by its ISO date", () => {
    expect(dbDateKey(new Date("2026-11-15T00:00:00.000Z"))).toBe("2026-11-15");
  });
});

describe("periods and months", () => {
  const now = new Date("2026-10-14T10:00:00.000Z");
  it("lists the last months oldest first, ending with this one", () => {
    expect(lastMonths(now, 3).map((m) => m.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(lastMonths(new Date("2026-01-05T00:00:00Z"), 2).map((m) => m.key)).toEqual(["2025-12", "2026-01"]);
  });
  it("this month runs from the 1st (IST) to the next 1st", () => {
    const r = periodRange("month", now);
    expect(r.from?.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(r.toDate?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("all time is unbounded", () => {
    expect(periodRange("all", now)).toEqual({ from: null, to: null, fromDate: null, toDate: null });
  });
});

describe("labels and rates", () => {
  it("rounds the conversion rate and never divides by zero", () => {
    expect(conversionPct(0, 0)).toBe(0);
    expect(conversionPct(3, 1)).toBe(33);
  });
  it("names slots and drops free text", () => {
    expect(slotLabel("FULL_DAY")).toBe("Full day");
    expect(slotLabel("Dinner")).toBe("Dinner");
    expect(slotLabel(null)).toBeNull();
    expect(slotLabel("call Ravi after 6")).toBeNull();
  });
  it("shows only an occasion category, never the typed text", () => {
    expect(ownerOccasion("Aarav's 1st birthday")).toBe("Birthday");
    expect(ownerOccasion("Sharma-Verma Reception")).toBe("Reception");
    expect(ownerOccasion("WEDDING")).toBe("Wedding");
    expect(ownerOccasion("Annriversary")).toBe("Anniversary");
    expect(ownerOccasion("Priya & Karthik")).toBe("Event");
    expect(ownerOccasion("  ")).toBeNull();
  });
});
