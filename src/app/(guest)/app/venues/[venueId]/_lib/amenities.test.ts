import { describe, expect, it } from "vitest";
import { AMENITY_ICON, amenityIconKey, hallAmenities, type AmenityIconKey } from "./amenities";

// The amenity values that actually occur: the six every live hall is created
// with (prisma/bootstrap.ts COMMON_AMENITIES) and the wider set the seed and
// the venue editor produce. Each must land on a sensible icon, and every
// amenity must survive with its own text.

const LIVE_AMENITIES: [string, AmenityIconKey][] = [
  ["Air-conditioned halls", "airConditioning"],
  ["Ample parking & valet", "parking"],
  ["In-house Veg / Non-Veg / Jain catering", "catering"],
  ["Stage, sound & lighting", "stage"],
  ["Bridal / green room", "bridal"],
  ["Outside decorators welcome", "decor"],
];

const SEEDED_AMENITIES: [string, AmenityIconKey][] = [
  ["AC", "airConditioning"],
  ["Stage", "stage"],
  ["Parking", "parking"],
  ["Valet Parking", "parking"],
  ["WiFi", "wifi"],
  ["Wi-Fi", "wifi"],
  ["DJ Setup", "sound"],
  ["Sound System", "sound"],
  ["Green Room", "greenRoom"],
  ["Bridal Suite", "bridal"],
  ["Open Air", "outdoor"],
  ["Garden", "garden"],
  ["Gazebo", "tent"],
  ["Water Feature", "water"],
  ["Dance Floor", "dance"],
  ["Bar Setup", "bar"],
  ["Private Bar", "bar"],
  ["City View", "view"],
  ["Lounge Seating", "lounge"],
  ["Elevator Access", "elevator"],
  ["Riverfront", "water"],
  ["Lake View", "water"],
  ["Pool Area", "water"],
  ["Bonfire Pit", "fire"],
  ["Lighting Setup", "lighting"],
  ["Heritage Architecture", "heritage"],
  ["Courtyard", "outdoor"],
  ["Projection Screen", "screen"],
  ["Projector", "screen"],
  ["Whiteboard", "presentation"],
  ["Breakout Rooms", "meeting"],
  ["Conference Table", "meeting"],
  ["Catering Kitchen", "catering"],
  ["Catering Space", "catering"],
  ["Mandap Area", "floral"],
  ["Multiple Stages", "stage"],
  ["Accommodation", "stay"],
  ["Private Entrance", "entrance"],
  ["Tea/Coffee Service", "refreshments"],
];

describe("amenityIconKey", () => {
  it.each(LIVE_AMENITIES)("maps the live amenity %s", (label, key) => {
    expect(amenityIconKey(label)).toBe(key);
  });

  it.each(SEEDED_AMENITIES)("maps %s", (label, key) => {
    expect(amenityIconKey(label)).toBe(key);
  });

  it("falls back to the neutral icon for wording it does not know", () => {
    expect(amenityIconKey("Peacock enclosure")).toBe("other");
    expect(amenityIconKey("Jhoola for the couple")).toBe("other");
    expect(amenityIconKey("")).toBe("other");
    expect(amenityIconKey("   ")).toBe("other");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(amenityIconKey("VALET PARKING")).toBe("parking");
    expect(amenityIconKey("air-conditioned")).toBe("airConditioning");
    expect(amenityIconKey("A/C")).toBe("airConditioning");
  });

  it("prefers the more specific reading when two words could match", () => {
    // water before view, bridal before a plain room, floral before stage
    expect(amenityIconKey("Lake View")).toBe("water");
    expect(amenityIconKey("Bridal / green room")).toBe("bridal");
    expect(amenityIconKey("Mandap stage")).toBe("floral");
    // "Elevator Access" is a lift, not an accessibility feature
    expect(amenityIconKey("Elevator Access")).toBe("elevator");
  });

  it("has an icon for every key it can return", () => {
    const keys = new Set<AmenityIconKey>(["other"]);
    for (const [label] of [...LIVE_AMENITIES, ...SEEDED_AMENITIES]) keys.add(amenityIconKey(label));
    for (const k of keys) expect(AMENITY_ICON[k], k).toBeTruthy();
    // every icon is distinct enough to be worth showing: no key maps to nothing
    expect(Object.values(AMENITY_ICON).every(Boolean)).toBe(true);
  });
});

describe("hallAmenities", () => {
  it("keeps every amenity, in order, with its own text", () => {
    const input = ["Air-conditioned halls", "Peacock enclosure", "Ample parking & valet"];
    expect(hallAmenities(input).map((a) => a.label)).toEqual(input);
    expect(hallAmenities(input).map((a) => a.iconKey)).toEqual(["airConditioning", "other", "parking"]);
  });

  it("never renames an amenity, only trims the whitespace around it", () => {
    expect(hallAmenities(["  Valet parking  "])).toEqual([{ label: "Valet parking", iconKey: "parking" }]);
  });

  it("keeps duplicates and near-duplicates rather than merging them", () => {
    expect(hallAmenities(["Parking", "parking", "Valet Parking"]).map((a) => a.label)).toEqual([
      "Parking",
      "parking",
      "Valet Parking",
    ]);
  });

  it("leaves out only entries with no text at all", () => {
    expect(hallAmenities(["AC", "", "   ", null, undefined, "WiFi"]).map((a) => a.label)).toEqual(["AC", "WiFi"]);
  });

  it("returns nothing for a hall with no amenities", () => {
    expect(hallAmenities([])).toEqual([]);
    expect(hallAmenities(null)).toEqual([]);
    expect(hallAmenities(undefined)).toEqual([]);
  });
});
