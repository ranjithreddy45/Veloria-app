import { describe, expect, it } from "vitest";
import {
  MAX_OWNER_VENUES,
  appBaseUrl,
  buildVenueOwnerInviteUrl,
  describeRole,
  normalizeVenueIds,
  ownerInviteMessage,
  ownerPasswordError,
  ownerStatus,
  validateOwnerInvite,
  whatsAppShareUrl,
} from "./admin-rules";

describe("validateOwnerInvite", () => {
  const base = { name: "  Ravi   Kumar ", email: " Ravi@Example.COM ", venueIds: ["v1"] };

  it("trims the name, lower-cases the email, keeps a blank phone as null", () => {
    const res = validateOwnerInvite({ ...base, phone: "  " });
    expect(res).toEqual({ ok: true, value: { name: "Ravi Kumar", email: "ravi@example.com", phone: null, venueIds: ["v1"] } });
  });

  it("requires a name, a valid email and at least one venue", () => {
    expect(validateOwnerInvite({ ...base, name: " " }).ok).toBe(false);
    expect(validateOwnerInvite({ ...base, email: "ravi@" }).ok).toBe(false);
    expect(validateOwnerInvite({ ...base, email: "ravi example@x.com" }).ok).toBe(false);
    expect(validateOwnerInvite({ ...base, venueIds: [] })).toEqual({
      ok: false,
      error: "Choose at least one venue the owner can see.",
    });
    expect(validateOwnerInvite(null).ok).toBe(false);
  });

  it("accepts common phone formats and refuses junk", () => {
    expect(validateOwnerInvite({ ...base, phone: "+91 98765-43210" })).toMatchObject({ ok: true, value: { phone: "+91 98765-43210" } });
    expect(validateOwnerInvite({ ...base, phone: "98765 43210" }).ok).toBe(true);
    expect(validateOwnerInvite({ ...base, phone: "12345" }).ok).toBe(false);
    expect(validateOwnerInvite({ ...base, phone: "call me" }).ok).toBe(false);
  });

  it("de-duplicates venue ids", () => {
    expect(validateOwnerInvite({ ...base, venueIds: ["v1", " v2 ", "v1", ""] })).toMatchObject({
      ok: true,
      value: { venueIds: ["v1", "v2"] },
    });
  });
});

describe("normalizeVenueIds", () => {
  it("allows an empty list (owner sees an empty portal)", () => {
    expect(normalizeVenueIds([])).toEqual({ ok: true, value: [] });
  });

  it("refuses anything that isn't a list of strings", () => {
    expect(normalizeVenueIds("v1").ok).toBe(false);
    expect(normalizeVenueIds([1, 2]).ok).toBe(false);
    expect(normalizeVenueIds(undefined).ok).toBe(false);
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_OWNER_VENUES + 1 }, (_, i) => `v${i}`);
    expect(normalizeVenueIds(many).ok).toBe(false);
  });
});

describe("ownerPasswordError", () => {
  it("needs eight characters and a matching confirmation", () => {
    expect(ownerPasswordError("short", "short")).toMatch(/at least 8/);
    expect(ownerPasswordError("longenough", "longenougH")).toMatch(/don't match/);
    expect(ownerPasswordError("x".repeat(129), "x".repeat(129))).toMatch(/under 128/);
    expect(ownerPasswordError(undefined, undefined)).toMatch(/at least 8/);
    expect(ownerPasswordError("longenough", "longenough")).toBeNull();
  });
});

describe("ownerStatus", () => {
  it("is pending until a password is set, then follows isActive", () => {
    expect(ownerStatus({ activated: false, isActive: false })).toBe("pending");
    expect(ownerStatus({ activated: false, isActive: true })).toBe("pending");
    expect(ownerStatus({ activated: true, isActive: true })).toBe("active");
    expect(ownerStatus({ activated: true, isActive: false })).toBe("deactivated");
  });
});

describe("describeRole", () => {
  it("reads naturally with the right article", () => {
    expect(describeRole("ADMIN")).toBe("an admin");
    expect(describeRole("SALES_EXEC")).toBe("a sales exec");
    expect(describeRole("EVENT_COORDINATOR")).toBe("an event coordinator");
    expect(describeRole("CLIENT")).toBe("a client");
  });
});

describe("invite link + WhatsApp share", () => {
  it("builds the activation URL without a trailing slash on the base", () => {
    expect(buildVenueOwnerInviteUrl("cuid123", "abcdef", "https://crm.example.com/")).toBe(
      "https://crm.example.com/venue-owner-activate?u=cuid123&token=abcdef"
    );
  });

  it("falls back to the production app URL", () => {
    expect(appBaseUrl("")).toBe("https://app.theveloriagrand.com");
    expect(appBaseUrl(undefined)).toBe("https://app.theveloriagrand.com");
  });

  it("addresses the owner by first name and carries the link", () => {
    const msg = ownerInviteMessage("Ravi Kumar", "https://x.test/l");
    expect(msg.startsWith("Hi Ravi,")).toBe(true);
    expect(msg).toContain("https://x.test/l");
    expect(ownerInviteMessage(null, "https://x.test/l").startsWith("Hi, ")).toBe(true);
  });

  it("opens the owner's chat when the number is known, the picker otherwise", () => {
    expect(whatsAppShareUrl("a b&c", "919876543210")).toBe("https://wa.me/919876543210?text=a%20b%26c");
    expect(whatsAppShareUrl("hi", null)).toBe("https://wa.me/?text=hi");
    expect(whatsAppShareUrl("hi", "+91 98")).toBe("https://wa.me/?text=hi");
  });
});
