import { describe, it, expect } from "vitest";
import { resolveLeadArea, areaFromFormAnswers, areaFromVenueName, areasIn, areaLabel, LEAD_AREAS } from "./areas";

// Answers as they actually arrive in lead descriptions (Nov 2026).
describe("areaFromFormAnswers", () => {
  it("a Meta zone answer becomes the zone, never one of its example areas", () => {
    expect(areaFromFormAnswers("preferred area in bengaluru?: East (Indiranagar, Whitefield, Marathahalli) [ext:fb:1]")).toBe("ZONE_EAST");
    expect(areaFromFormAnswers("preferred area in bengaluru?: North (Yelahanka, Hebbal, Kammanahalli)")).toBe("ZONE_NORTH");
    expect(areaFromFormAnswers("preferred area in bengaluru?: South (JP Nagar, Jayanagar, Banashankari) [ext:fb:9]")).toBe("ZONE_SOUTH");
    expect(areaFromFormAnswers("preferred area in bengaluru?: South-East (Koramangala, HSR Layout, Electronic City)")).toBe("ZONE_SOUTH_EAST");
    expect(areaFromFormAnswers("preferred area in bengaluru?: West (Rajajinagar, Vijayanagar, Nagarbhavi)")).toBe("ZONE_WEST");
  });
  it("a website venue answer becomes the area", () => {
    expect(areaFromFormAnswers("venue only · Visit: send me details first · Venue: Indiranagar · Campaign: VG Birthday")).toBe("INDIRANAGAR");
    expect(areaFromFormAnswers("Venue: Hosa Road · Campaign: VG Birthday - Venue Booking System")).toBe("HOSA_ROAD");
    expect(areaFromFormAnswers("Preferred venue: Yelahanka area")).toBe("YELAHANKA");
  });
  it("a city-only answer says nothing; an unknown place is Other", () => {
    expect(areaFromFormAnswers("Area: Bengaluru ")).toBeNull();
    expect(areaFromFormAnswers("Area: Bangalore")).toBeNull();
    expect(areaFromFormAnswers("Area: haveli mohalla  Kolar")).toBe("OTHER");
    expect(areaFromFormAnswers("Preferred area: any")).toBe("OTHER");
  });
  it("Meta's raw option values (underscores) still map to the right zone", () => {
    expect(areaFromFormAnswers("preferred area in bengaluru?: east_(indiranagar,_whitefield,_marathahalli)")).toBe("ZONE_EAST");
    expect(areaFromFormAnswers("preferred area in bengaluru?: north_(yelahanka,_hebbal,_kammanahalli)")).toBe("ZONE_NORTH");
    expect(areaFromFormAnswers("preferred area in bengaluru?: south-east_(koramangala,_hsr_layout,_electronic_city)")).toBe("ZONE_SOUTH_EAST");
    expect(areaFromFormAnswers("preferred area in bengaluru?: south_(jp_nagar,_jayanagar,_banashankari)")).toBe("ZONE_SOUTH");
    expect(areaFromFormAnswers("preferred_area_in_bengaluru?: west_(rajajinagar,_vijayanagar)")).toBe("ZONE_WEST");
  });
  it("the customer's area answer beats the ad set's Venue: line", () => {
    const meta = "Facebook Lead Ad · Venue: Bellandur · Campaign: X · preferred area in bengaluru?: East (Indiranagar, Whitefield, Marathahalli)";
    expect(areaFromFormAnswers(meta)).toBe("ZONE_EAST");
    expect(resolveLeadArea({ text: meta, venueName: "Veloria Grand Blossom  - Bellandur" })).toEqual({ area: "ZONE_EAST", source: "form" });
    // a venue inside the zone they picked is still the more precise answer
    expect(resolveLeadArea({ text: meta, venueName: "Veloria Grand — Indiranagar (ZIP)" })).toEqual({ area: "INDIRANAGAR", source: "venue" });
  });
  it("city-and-state or pincode answers say nothing", () => {
    expect(areaFromFormAnswers("Location: Bengaluru, Karnataka")).toBeNull();
    expect(areaFromFormAnswers("Area: Bangalore 560037")).toBeNull();
  });
  it("two different areas decide nothing", () => {
    expect(areaFromFormAnswers("Area: Hebbal or Bellandur")).toBeNull();
  });
  it("no area question at all is null", () => {
    expect(areaFromFormAnswers("Wedding for 300 guests in Feb")).toBeNull();
  });
});

describe("resolveLeadArea", () => {
  it("prefers an explicit value, then a specific form answer, then the venue", () => {
    expect(resolveLeadArea({ given: "Hosa Road" })).toEqual({ area: "HOSA_ROAD", source: "given" });
    expect(resolveLeadArea({ given: "BELLANDUR" })).toEqual({ area: "BELLANDUR", source: "given" });
    expect(resolveLeadArea({ text: "Venue: Indiranagar", venueName: "Veloria Grand — Yelahanka (resort)" })).toEqual({ area: "INDIRANAGAR", source: "form" });
    expect(resolveLeadArea({ venueName: "Veloria Grand — Hosa Road · Pearl Hall" })).toEqual({ area: "HOSA_ROAD", source: "venue" });
  });
  it("a venue inside the zone they asked for is more precise; outside it, the zone wins", () => {
    expect(resolveLeadArea({ text: "preferred area in bengaluru?: North (Yelahanka, Hebbal)", venueName: "Veloria Grand — Hebbal" })).toEqual({ area: "HEBBAL", source: "venue" });
    expect(resolveLeadArea({ text: "preferred area in bengaluru?: North (Yelahanka, Hebbal)", venueName: "Veloria Grand — JP Nagar" })).toEqual({ area: "ZONE_NORTH", source: "form" });
  });
  it("one area named loosely in the text counts; two don't", () => {
    expect(resolveLeadArea({ text: "Looking for a hall near bellandur for 200 people" })).toEqual({ area: "BELLANDUR", source: "text" });
    expect(resolveLeadArea({ text: "either hebbal or whitefield" })).toEqual({ area: null, source: "none" });
    expect(resolveLeadArea({ text: "Auto-captured from callvibe" })).toEqual({ area: null, source: "none" });
  });
  it("doesn't match inside other words", () => {
    expect(areasIn("ecityscape")).toEqual([]);
    expect(areasIn("Kammanahalli")).toEqual([]);
  });
});

describe("venues and labels", () => {
  it("every live venue name maps to its area", () => {
    expect(areaFromVenueName("Veloria Grand — Indiranagar (ZIP)")).toBe("INDIRANAGAR");
    expect(areaFromVenueName("Veloria Grand Blossom  - Bellandur")).toBe("BELLANDUR");
    expect(areaFromVenueName("ICON - Bellendur")).toBe("BELLANDUR");
    expect(areaFromVenueName("HHI - JP nagar")).toBe("JP_NAGAR");
    expect(areaFromVenueName("Veloria Grand - KR Puram")).toBe("KR_PURAM");
    expect(areaFromVenueName("Veloria Grand - Electronic City")).toBe("ELECTRONIC_CITY");
    expect(areaFromVenueName("Veloria Grand — Brookfield")).toBe("BROOKFIELD");
    expect(areaFromVenueName("Veloria Grand - Horamavu")).toBe("HORAMAVU");
    expect(areaFromVenueName("Grand Ballroom")).toBeNull();
  });
  it("keys are unique and labelled", () => {
    expect(new Set(LEAD_AREAS.map((a) => a.key)).size).toBe(LEAD_AREAS.length);
    expect(areaLabel("ZONE_SOUTH_EAST")).toBe("South-East (any area)");
    expect(areaLabel("NOPE")).toBeNull();
  });
});
