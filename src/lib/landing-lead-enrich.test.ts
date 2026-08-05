import { describe, it, expect } from "vitest";
import { venueMatchKey } from "./landing-lead-enrich";

// The website's venue wording and the CRM's venue names are different strings
// for the same halls. This is the bit that has to bridge them, and a wrong
// match silently files a lead against a venue the visitor never chose.

describe("venueMatchKey", () => {
  it("strips the bracketed aside", () => {
    expect(venueMatchKey("Hosa Road (Singasandra)")).toBe("Hosa Road");
  });

  it("strips a marketing suffix after a dash", () => {
    expect(venueMatchKey("Begur — New Property")).toBe("Begur");
    expect(venueMatchKey("Begur – New Property")).toBe("Begur");
    expect(venueMatchKey("Begur - New Property")).toBe("Begur");
  });

  it("treats 'Either' as NO preference", () => {
    // The dangerous case: this must not match a venue, or every undecided
    // visitor gets filed against whichever hall the search happens to hit.
    expect(venueMatchKey("Either — suggest best available")).toBeNull();
    expect(venueMatchKey("Any venue")).toBeNull();
    expect(venueMatchKey("Not sure yet")).toBeNull();
    expect(venueMatchKey("No preference")).toBeNull();
  });

  it("refuses a key too short to be distinctive", () => {
    // "AB" would substring-match almost anything.
    expect(venueMatchKey("AB (something)")).toBeNull();
    expect(venueMatchKey("—")).toBeNull();
  });

  it("handles empty and missing input", () => {
    for (const v of ["", "   ", null, undefined]) expect(venueMatchKey(v)).toBeNull();
  });

  it("passes through a plain venue name unchanged", () => {
    expect(venueMatchKey("Veloria Grand Blossom")).toBe("Veloria Grand Blossom");
  });
});
