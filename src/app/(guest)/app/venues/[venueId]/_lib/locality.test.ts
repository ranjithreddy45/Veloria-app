import { describe, expect, it } from "vitest";
import { addressLocality } from "./locality";

describe("addressLocality", () => {
  it("takes the place from the end of the address the team typed", () => {
    expect(addressLocality("Veloria Grand, 12 Hosa Road, Bengaluru 560100")).toBe("Bengaluru");
    expect(addressLocality("Survey 41, Dairy Circle, Bannerghatta Road")).toBe("Bannerghatta Road");
  });

  it("drops a trailing PIN code and a trailing country", () => {
    expect(addressLocality("12 Hosa Road, Bengaluru - 560100, India")).toBe("Bengaluru");
    expect(addressLocality("12 Hosa Road, Bengaluru, 560100")).toBe("Bengaluru");
    expect(addressLocality("12 Hosa Road, Bengaluru, India")).toBe("Bengaluru");
  });

  it("reads multi-line addresses as well as comma-separated ones", () => {
    expect(addressLocality("Veloria Grand\n12 Hosa Road\nBengaluru 560100")).toBe("Bengaluru");
  });

  it("says nothing when the address names only one thing", () => {
    expect(addressLocality("Bengaluru")).toBeNull();
    expect(addressLocality("Bengaluru 560100")).toBeNull();
  });

  it("says nothing rather than guessing from an empty or unusable address", () => {
    expect(addressLocality(null)).toBeNull();
    expect(addressLocality(undefined)).toBeNull();
    expect(addressLocality("")).toBeNull();
    expect(addressLocality("   ")).toBeNull();
    expect(addressLocality("Veloria Grand, 560100")).toBeNull();
    expect(addressLocality("Veloria Grand, India")).toBeNull();
  });

  it("never returns the first line, which is the building rather than the place", () => {
    expect(addressLocality("Veloria Grand, 560100, India")).toBeNull();
  });

  it("skips an address line too long to sit beside the capacity", () => {
    const long = "Opposite the third gate of the technology park main entrance";
    expect(addressLocality(`Veloria Grand, ${long}, Bengaluru`)).toBe("Bengaluru");
    expect(addressLocality(`Veloria Grand, Bengaluru, ${long}`)).toBe("Bengaluru");
  });
});
