import { describe, expect, it } from "vitest";
import { mapsSearchHref, resolveHallAddress, safeHttpUrl, textOrNull } from "./hall-info";

describe("safeHttpUrl", () => {
  it("keeps http and https addresses", () => {
    expect(safeHttpUrl("https://maps.app.goo.gl/abc123")).toBe("https://maps.app.goo.gl/abc123");
    expect(safeHttpUrl("  http://example.com/tour  ")).toBe("http://example.com/tour");
  });

  it("adds https to an address pasted without a scheme", () => {
    expect(safeHttpUrl("maps.app.goo.gl/abc123")).toBe("https://maps.app.goo.gl/abc123");
    expect(safeHttpUrl("www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(safeHttpUrl("//vimeo.com/123456789")).toBe("https://vimeo.com/123456789");
  });

  it("refuses anything that is not a web address", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHttpUrl("mailto:hello@example.com")).toBeNull();
    expect(safeHttpUrl("ftp://example.com/file")).toBeNull();
    expect(safeHttpUrl("No. 12, 3rd Main Road")).toBeNull();
    expect(safeHttpUrl("http://localhost:3000")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe("textOrNull", () => {
  it("trims and turns blanks into null", () => {
    expect(textOrNull("  Basement parking  ")).toBe("Basement parking");
    expect(textOrNull("   ")).toBeNull();
    expect(textOrNull(undefined)).toBeNull();
  });
});

describe("resolveHallAddress", () => {
  const venue = { address: "Veloria Grand, Banashankari, Bengaluru", mapUrl: "https://maps.app.goo.gl/venue" };

  it("uses the hall's own address and map link", () => {
    expect(resolveHallAddress({ publicAddress: "Hall B, 2nd floor", mapUrl: "https://maps.app.goo.gl/hall" }, venue)).toEqual({
      source: "HALL",
      text: "Hall B, 2nd floor",
      mapHref: "https://maps.app.goo.gl/hall",
    });
  });

  it("builds a map search from the hall's address when it has no map link", () => {
    expect(resolveHallAddress({ publicAddress: "Hall B, 2nd floor" }, venue)).toEqual({
      source: "HALL",
      text: "Hall B, 2nd floor",
      mapHref: mapsSearchHref("Hall B, 2nd floor"),
    });
  });

  it("keeps a hall that only has a map link on its own location", () => {
    expect(resolveHallAddress({ mapUrl: "maps.app.goo.gl/hall" }, venue)).toEqual({ source: "HALL", text: null, mapHref: "https://maps.app.goo.gl/hall" });
  });

  it("falls back to the venue address only when the hall has none", () => {
    expect(resolveHallAddress({ publicAddress: " ", mapUrl: null }, venue)).toEqual({ source: "VENUE", text: venue.address, mapHref: venue.mapUrl });
    expect(resolveHallAddress({}, { address: venue.address })).toEqual({ source: "VENUE", text: venue.address, mapHref: mapsSearchHref(venue.address) });
  });

  it("treats an unsafe hall link as missing", () => {
    expect(resolveHallAddress({ mapUrl: "javascript:alert(1)" }, venue)?.source).toBe("VENUE");
  });

  it("returns null when nobody has an address", () => {
    expect(resolveHallAddress({}, null)).toBeNull();
    expect(resolveHallAddress({ publicAddress: "" }, { address: "", mapUrl: "" })).toBeNull();
  });
});
