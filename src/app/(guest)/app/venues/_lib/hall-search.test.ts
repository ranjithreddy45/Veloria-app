import { describe, expect, it } from "vitest";
import {
  EMPTY_HALL_SEARCH,
  HALL_CAP_BANDS,
  availabilityChip,
  capacityInBand,
  describeHallSearch,
  formatSearchDate,
  hallMatchesSearch,
  hallSearchHref,
  hallSearchIsEmpty,
  hallSearchPill,
  isCalendarDate,
  noMatchAdvice,
  parseHallSearch,
  resultCountText,
  topAmenities,
  type HallSearch,
} from "./hall-search";

const TODAY = "2026-09-16";
const opts = { todayISO: TODAY };
const search = (over: Partial<HallSearch> = {}): HallSearch => ({ ...EMPTY_HALL_SEARCH, ...over });

describe("parseHallSearch — dates", () => {
  it("keeps a real bookable date", () => {
    expect(parseHallSearch({ date: "2026-12-12" }, opts).dateISO).toBe("2026-12-12");
    expect(parseHallSearch({ date: TODAY }, opts).dateISO).toBe(TODAY);
  });

  it("drops a date that is not a real day", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "12-12-2026", "2026-12-1", "tomorrow", ""]) {
      expect(parseHallSearch({ date: bad }, opts).dateISO).toBeNull();
    }
  });

  it("drops a past date and one beyond the twelve-month window", () => {
    expect(parseHallSearch({ date: "2026-09-15" }, opts).dateISO).toBeNull();
    expect(parseHallSearch({ date: "2028-01-01" }, opts).dateISO).toBeNull();
  });

  it("reads the first value when the query string repeats the key", () => {
    expect(parseHallSearch({ date: ["2026-12-12", "2026-12-13"] }, opts).dateISO).toBe("2026-12-12");
  });

  it("ignores junk types", () => {
    expect(parseHallSearch({ date: { toString: () => "2026-12-12" } }, opts).dateISO).toBeNull();
    expect(parseHallSearch({}, opts)).toEqual(EMPTY_HALL_SEARCH);
  });
});

describe("parseHallSearch — slot, guests, band, amenity", () => {
  it("accepts the real slots, in any case", () => {
    const withDate = { date: "2026-12-12" };
    expect(parseHallSearch({ ...withDate, slot: "evening" }, opts).slot).toBe("EVENING");
    expect(parseHallSearch({ ...withDate, slot: "FULL_DAY" }, opts).slot).toBe("FULL_DAY");
    expect(parseHallSearch({ ...withDate, slot: "brunch" }, opts).slot).toBeNull();
  });

  it("drops a slot with no date — a slot alone narrows nothing", () => {
    expect(parseHallSearch({ slot: "EVENING" }, opts).slot).toBeNull();
    expect(parseHallSearch({ slot: "EVENING", date: "2026-02-30" }, opts).slot).toBeNull();
  });

  it("takes a positive whole guest count only", () => {
    expect(parseHallSearch({ guests: "350" }, opts).guests).toBe(350);
    expect(parseHallSearch({ guests: 350 }, opts).guests).toBe(350);
    for (const bad of ["0", "-5", "12.5", "1e3", "abc", "999999999", " "]) {
      expect(parseHallSearch({ guests: bad }, opts).guests).toBeNull();
    }
  });

  it("takes only a real capacity band", () => {
    expect(parseHallSearch({ cap: "200-500" }, opts).cap).toBe("200-500");
    expect(parseHallSearch({ cap: "501" }, opts).cap).toBeNull();
  });

  it("keeps an amenity the halls list, in the team's own spelling, and drops one they do not", () => {
    const known = ["Valet parking", "Bridal suite"];
    expect(parseHallSearch({ amenity: "valet   PARKING" }, { ...opts, knownAmenities: known }).amenity).toBe("Valet parking");
    expect(parseHallSearch({ amenity: "Helipad" }, { ...opts, knownAmenities: known }).amenity).toBeNull();
    expect(parseHallSearch({ amenity: "<script>x</script>".repeat(20) }, { ...opts, knownAmenities: known }).amenity).toBeNull();
  });

  it("sanitises an amenity even with no known list to check against", () => {
    const parsed = parseHallSearch({ amenity: "  Valet\n parking " }, opts);
    expect(parsed.amenity).toBe("Valet parking");
    expect((parseHallSearch({ amenity: "x".repeat(400) }, opts).amenity ?? "").length).toBe(60);
  });
});

describe("hallSearchHref", () => {
  it("writes only the fields that are set", () => {
    expect(hallSearchHref("/app/venues", EMPTY_HALL_SEARCH)).toBe("/app/venues");
    expect(hallSearchHref("/app/venues", search({ dateISO: "2026-12-12", guests: 350 }))).toBe("/app/venues?date=2026-12-12&guests=350");
  });

  it("patches one field and clears one with null", () => {
    const s = search({ dateISO: "2026-12-12", cap: "200-500" });
    expect(hallSearchHref("/app/venues", s, { cap: null })).toBe("/app/venues?date=2026-12-12");
    expect(hallSearchHref("/app/venues", s, { amenity: "Valet parking" })).toBe(
      "/app/venues?date=2026-12-12&amenity=Valet+parking&cap=200-500"
    );
  });

  it("round-trips through parseHallSearch", () => {
    const s = search({ dateISO: "2026-12-12", slot: "EVENING", guests: 350, cap: "200-500", amenity: "Valet parking" });
    const query = Object.fromEntries(new URL(hallSearchHref("https://x.test/app/venues", s)).searchParams);
    expect(parseHallSearch(query, { ...opts, knownAmenities: ["Valet parking"] })).toEqual(s);
  });
});

describe("wording", () => {
  it("formats a date the way the pill reads it", () => {
    expect(formatSearchDate("2026-12-12", TODAY)).toBe("12 Dec");
    expect(formatSearchDate("2027-01-02", TODAY)).toBe("2 Jan 2027");
    expect(formatSearchDate(null, TODAY)).toBe("");
  });

  it("describes a search", () => {
    expect(describeHallSearch(search({ dateISO: "2026-12-12", guests: 350 }), TODAY)).toBe("12 Dec · 350 guests");
    expect(describeHallSearch(search({ dateISO: "2026-12-12", slot: "EVENING" }), TODAY)).toBe("12 Dec · Evening");
    expect(describeHallSearch(EMPTY_HALL_SEARCH, TODAY)).toBe("");
  });

  it("falls back to placeholders in the pill", () => {
    expect(hallSearchPill(EMPTY_HALL_SEARCH, TODAY)).toMatchObject({ dates: "Add dates", guests: "Add guests", datesSet: false, guestsSet: false });
    expect(hallSearchPill(search({ dateISO: "2026-12-12", guests: 350 }), TODAY)).toMatchObject({ dates: "12 Dec", guests: "350 guests", datesSet: true });
    expect(hallSearchPill(search({ cap: "200-500" }), TODAY).guests).toBe("200–500");
  });

  it("counts results honestly", () => {
    expect(resultCountText({ total: 11, shown: 11, dateISO: null, freeCount: 0 })).toBe("11 spaces");
    expect(resultCountText({ total: 11, shown: 3, dateISO: null, freeCount: 0 })).toBe("3 of 11 spaces");
    expect(resultCountText({ total: 1, shown: 1, dateISO: null, freeCount: 0 })).toBe("1 space");
    expect(resultCountText({ total: 11, shown: 11, dateISO: "2026-12-12", freeCount: 4, todayISO: TODAY })).toBe("4 free on 12 Dec · 11 spaces listed");
    expect(resultCountText({ total: 4, shown: 4, dateISO: "2026-12-12", freeCount: 4, todayISO: TODAY })).toBe("4 free on 12 Dec");
    expect(resultCountText({ total: 11, shown: 11, dateISO: "2026-12-12", freeCount: 0, todayISO: TODAY })).toBe("None fully free on 12 Dec · 11 spaces listed");
    expect(resultCountText({ total: 0, shown: 0, dateISO: null, freeCount: 0 })).toBe("");
  });

  it("says which filter to loosen", () => {
    expect(noMatchAdvice(search({ guests: 2500 }))).toContain("2,500 guests");
    expect(noMatchAdvice(search({ amenity: "Valet parking" }))).toContain("Valet parking");
    expect(noMatchAdvice(EMPTY_HALL_SEARCH)).toBe("Nothing matches that search.");
  });
});

describe("capacity bands", () => {
  it("is a disjoint cover — every capacity lands in exactly one band", () => {
    for (const capacity of [1, 100, 101, 200, 201, 500, 501, 2000]) {
      const hits = HALL_CAP_BANDS.filter((b) => capacityInBand(capacity, b.key));
      expect(hits.map((b) => b.key)).toHaveLength(1);
    }
  });

  it("does not filter when no band is set", () => {
    expect(capacityInBand(350, null)).toBe(true);
    expect(capacityInBand(350, "nonsense")).toBe(true);
  });
});

describe("hallMatchesSearch", () => {
  const hall = { capacity: 400, amenities: ["Valet parking", "Bridal suite"] };

  it("keeps a hall big enough for the party and drops one that is not", () => {
    expect(hallMatchesSearch(hall, search({ guests: 350 }))).toBe(true);
    expect(hallMatchesSearch(hall, search({ guests: 400 }))).toBe(true);
    expect(hallMatchesSearch(hall, search({ guests: 401 }))).toBe(false);
  });

  it("applies the band and the amenity, case-insensitively", () => {
    expect(hallMatchesSearch(hall, search({ cap: "200-500" }))).toBe(true);
    expect(hallMatchesSearch(hall, search({ cap: "upto-100" }))).toBe(false);
    expect(hallMatchesSearch(hall, search({ amenity: "valet parking" }))).toBe(true);
    expect(hallMatchesSearch(hall, search({ amenity: "Helipad" }))).toBe(false);
  });

  it("never filters on a date — a busy hall is still a hall", () => {
    expect(hallMatchesSearch(hall, search({ dateISO: "2026-12-12", slot: "EVENING" }))).toBe(true);
  });

  it("matches everything when nothing is searched", () => {
    expect(hallSearchIsEmpty(EMPTY_HALL_SEARCH)).toBe(true);
    expect(hallMatchesSearch(hall, EMPTY_HALL_SEARCH)).toBe(true);
  });
});

describe("topAmenities", () => {
  it("ranks by how many halls list it, keeping the team's spelling", () => {
    const halls = [
      { amenities: ["Valet parking", "Bridal suite"] },
      { amenities: ["valet  parking", "Stage"] },
      { amenities: ["Valet Parking", "Stage", "Generator"] },
    ];
    expect(topAmenities(halls, 3)).toEqual(["Valet parking", "Stage", "Bridal suite"]);
  });

  it("counts a hall once even if it lists the same amenity twice, and ignores blanks", () => {
    expect(topAmenities([{ amenities: ["Stage", "Stage", "  "] }, { amenities: ["Bridal suite"] }], 5)).toEqual(["Stage", "Bridal suite"]);
  });

  it("is empty when the halls list nothing", () => {
    expect(topAmenities([{ amenities: [] }], 6)).toEqual([]);
  });
});

describe("availabilityChip", () => {
  it("says nothing when no date was searched", () => {
    expect(availabilityChip(null, [])).toBeNull();
  });

  it("names the free slots", () => {
    expect(availabilityChip("FREE", ["MORNING", "AFTERNOON", "EVENING"])).toEqual({ label: "Free all day", tone: "green" });
    expect(availabilityChip("PARTIAL", ["EVENING"])).toEqual({ label: "Evening free", tone: "amber" });
    expect(availabilityChip("PARTIAL", ["MORNING", "EVENING"])).toEqual({ label: "2 slots free", tone: "amber" });
    expect(availabilityChip("TAKEN", [])).toEqual({ label: "Fully booked", tone: "grey" });
  });

  it("speaks about the searched slot alone, never 'free all day', when a slot was picked", () => {
    expect(availabilityChip("FREE", ["EVENING"], "EVENING")).toEqual({ label: "Evening free", tone: "green" });
    expect(availabilityChip("TAKEN", ["MORNING"], "EVENING")).toEqual({ label: "Evening taken", tone: "grey" });
    expect(availabilityChip("FREE", ["MORNING", "AFTERNOON", "EVENING"], "FULL_DAY")).toEqual({ label: "Full Day free", tone: "green" });
    expect(availabilityChip(null, [], "EVENING")).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("accepts leap days that exist and rejects ones that do not", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2027-02-29")).toBe(false);
  });
});
