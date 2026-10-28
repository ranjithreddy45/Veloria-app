import { describe, it, expect } from "vitest";
import { formatContactAddress } from "./client-address";

describe("formatContactAddress", () => {
  it("joins street, city, state and pincode", () => {
    expect(formatContactAddress({ address: "12 MG Road, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038" })).toBe(
      "12 MG Road, Indiranagar, Bengaluru, Karnataka – 560038"
    );
  });
  it("does not repeat a city or pincode the street already names", () => {
    expect(formatContactAddress({ address: "45 Hosa Road, Bengaluru 560100", city: "bengaluru", state: "Karnataka", pincode: "560100" })).toBe(
      "45 Hosa Road, Bengaluru 560100, Karnataka"
    );
  });
  it("works with only a city (the common case) and returns null when nothing is recorded", () => {
    expect(formatContactAddress({ city: "Bengaluru", state: "Karnataka" })).toBe("Bengaluru, Karnataka");
    expect(formatContactAddress({ pincode: "560038" })).toBe("560038");
    expect(formatContactAddress({ address: "  ", city: null })).toBeNull();
    expect(formatContactAddress(null)).toBeNull();
  });
});
