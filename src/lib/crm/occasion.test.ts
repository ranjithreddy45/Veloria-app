import { describe, expect, it } from "vitest";
import { OCCASION_NONE, buildOccasionOptions, occasionKey, occasionLabel, rawValuesForOccasion } from "./occasion";

// The real spread of Lead.eventType in production on 2026-09-21.
const PROD = [
  { eventType: null, count: 1007 },
  { eventType: "Birthday Party", count: 93 },
  { eventType: "Engagement", count: 54 },
  { eventType: "Baby Shower", count: 35 },
  { eventType: "Other", count: 29 },
  { eventType: "Wedding", count: 26 },
  { eventType: "Reception", count: 19 },
  { eventType: "Birthday", count: 10 },
  { eventType: "Corporate Event", count: 9 },
  { eventType: "Corporate", count: 3 },
  { eventType: "Anniversary", count: 3 },
  { eventType: "Annriversary", count: 1 },
  { eventType: "Baby shower", count: 1 },
  { eventType: "Kids Party", count: 1 },
  { eventType: "Seniors get to gether", count: 1 },
  { eventType: "  ", count: 2 },
];

describe("occasionKey", () => {
  it("merges spellings that are unmistakably the same occasion", () => {
    expect(occasionKey("Birthday Party")).toBe(occasionKey("Birthday"));
    expect(occasionKey("Corporate Event")).toBe(occasionKey("corporate"));
    expect(occasionKey("Baby shower")).toBe(occasionKey("Baby  Shower "));
    expect(occasionKey("Annriversary")).toBe("anniversary");
  });

  it("does not merge occasions that merely sound related", () => {
    expect(occasionKey("Kids Party")).not.toBe(occasionKey("Birthday"));
    expect(occasionKey("Reception")).not.toBe(occasionKey("Wedding"));
  });

  it("treats null and blank as not recorded", () => {
    expect(occasionKey(null)).toBeNull();
    expect(occasionKey("   ")).toBeNull();
  });
});

describe("buildOccasionOptions", () => {
  const options = buildOccasionOptions(PROD);
  const get = (v: string) => options.find((o) => o.value === v);

  it("adds the merged spellings together", () => {
    expect(get("birthday")).toMatchObject({ label: "Birthday", count: 103 });
    expect(get("corporate")?.count).toBe(12);
    expect(get("baby shower")?.count).toBe(36);
    expect(get("anniversary")?.count).toBe(4);
  });

  it("loses no lead: option counts add up to the input", () => {
    const total = PROD.reduce((s, r) => s + r.count, 0);
    expect(options.reduce((s, o) => s + o.count, 0)).toBe(total);
  });

  it("puts 'Not recorded' last however large it is, counting blanks with nulls", () => {
    expect(options[0].value).toBe("birthday");
    expect(options.at(-1)).toMatchObject({ value: OCCASION_NONE, count: 1009 });
  });

  it("offers no 'Not recorded' option when every lead has an occasion", () => {
    expect(buildOccasionOptions([{ eventType: "Wedding", count: 2 }]).map((o) => o.value)).toEqual(["wedding"]);
  });
});

describe("rawValuesForOccasion", () => {
  const distinct = PROD.map((r) => r.eventType);

  it("returns every raw spelling behind a key, for the IN (...) clause", () => {
    expect(rawValuesForOccasion("birthday", distinct).sort()).toEqual(["Birthday", "Birthday Party"]);
    expect(rawValuesForOccasion("baby shower", distinct).sort()).toEqual(["Baby Shower", "Baby shower"]);
  });

  it("returns nothing for an occasion nobody has — so the list is empty, not unfiltered", () => {
    expect(rawValuesForOccasion("sangeet", distinct)).toEqual([]);
    expect(rawValuesForOccasion("   ", distinct)).toEqual([]);
  });
});

describe("occasionLabel", () => {
  it("title-cases, including after a hyphen", () => {
    expect(occasionLabel("baby shower")).toBe("Baby Shower");
    expect(occasionLabel("get-together")).toBe("Get-Together");
  });
});
