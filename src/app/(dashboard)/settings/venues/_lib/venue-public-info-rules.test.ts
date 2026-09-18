import { describe, it, expect } from "vitest";
import { countFilledPublicInfo, validateVenuePublicInfoInput } from "./venue-public-info-rules";

describe("validateVenuePublicInfoInput", () => {
  it("stores empty fields as null so the customer page hides them", () => {
    const r = validateVenuePublicInfoInput({});
    expect(r).toEqual({
      ok: true,
      data: { publicAddress: null, mapUrl: null, parkingInfo: null, directionsNote: null, videoUrl: null, virtualTourUrl: null },
    });
  });

  it("tidies text and normalises links", () => {
    const r = validateVenuePublicInfoInput({
      publicAddress: " 12, Some Road \r\nBengaluru ",
      mapUrl: "maps.app.goo.gl/abc",
      parkingInfo: "Basement parking\n\n\n\nValet on request",
      videoUrl: "https://youtu.be/xyz",
      virtualTourUrl: "",
    });
    expect(r.ok && r.data).toEqual({
      publicAddress: "12, Some Road\nBengaluru",
      mapUrl: "https://maps.app.goo.gl/abc",
      parkingInfo: "Basement parking\n\nValet on request",
      directionsNote: null,
      videoUrl: "https://youtu.be/xyz",
      virtualTourUrl: null,
    });
  });

  it("rejects unsafe or malformed links per field", () => {
    const r = validateVenuePublicInfoInput({ mapUrl: "javascript:alert(1)", videoUrl: "not a link", virtualTourUrl: "https://tour.example.com/v/1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["mapUrl", "videoUrl"]);
  });

  it("limits long text", () => {
    expect(validateVenuePublicInfoInput({ parkingInfo: "p".repeat(1001) }).ok).toBe(false);
  });
});

describe("countFilledPublicInfo", () => {
  it("counts only fields with visible text", () => {
    expect(countFilledPublicInfo({ publicAddress: "x", mapUrl: " ", parkingInfo: null, videoUrl: "https://youtu.be/a" })).toBe(2);
  });
});
