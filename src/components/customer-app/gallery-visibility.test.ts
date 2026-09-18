import { describe, expect, it } from "vitest";
import { customerAppVisibility } from "./gallery-visibility";

describe("customerAppVisibility", () => {
  it("says a private item is hidden from customers", () => {
    expect(customerAppVisibility({ isPublic: false, mediaType: "PHOTO", venueName: "Crystal Hall" })).toBe("Private: customers don't see this.");
  });

  it("explains that videos are not shown in the customer app", () => {
    expect(customerAppVisibility({ isPublic: true, mediaType: "VIDEO", venueName: null })).toBe("Public, but the customer app only shows photos.");
  });

  it("names the hall page a linked public photo appears on", () => {
    expect(customerAppVisibility({ isPublic: true, mediaType: "PHOTO", venueName: "Crystal Hall" })).toBe("Customers see this in the app gallery and on the Crystal Hall page.");
  });

  it("suggests choosing a hall for an unlinked public photo", () => {
    expect(customerAppVisibility({ isPublic: true, mediaType: "PHOTO", venueName: null })).toContain("Choose a hall");
  });
});
