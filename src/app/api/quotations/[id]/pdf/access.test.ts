import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";
import {
  decideQuotationPdfAccess,
  isLiveQuotationShareLink,
  QUOTATION_PDF_STAFF_PERMISSION,
  shareTokenParam,
  staffMayReadQuotations,
  type QuotationPdfAccessInput,
} from "./access";

// ============================================================
// Who may open a quotation printout. Pure: no database, no session.
// ============================================================

const NOW = new Date("2030-01-10T06:00:00.000Z");
const TOKEN = "Zq4mVb7nT1xR9sK2pL6wYc3d"; // base64url, the shape generateShareToken() issues
const live = { token: TOKEN, status: "ACTIVE", expiresAt: null };

// A role that holds quotes:read by default, and one that does not.
const WITH = "SALES_EXEC";
const WITHOUT = "HR_EXECUTIVE";

const input = (over: Partial<QuotationPdfAccessInput> = {}): QuotationPdfAccessInput => ({
  contactId: "contact-asha",
  viewer: null,
  verifiedContactIds: [],
  token: null,
  shareLinks: [],
  now: NOW,
  ...over,
});

describe("staffMayReadQuotations — resolved like middleware.ts", () => {
  it("uses quotes:read, the permission the team's /quotations pages need", () => {
    expect(QUOTATION_PDF_STAFF_PERMISSION).toBe("quotes:read");
    expect(hasPermission(WITH, "quotes:read")).toBe(true);
    expect(hasPermission(WITHOUT, "quotes:read")).toBe(false);
  });

  it("always lets SUPER_ADMIN and ADMIN in", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN"]) {
      expect(staffMayReadQuotations({ role, perms: ["*"] })).toBe(true);
      expect(staffMayReadQuotations({ role })).toBe(true);
      expect(staffMayReadQuotations({ role, perms: [] })).toBe(true);
    }
  });

  it("follows the session's effective permissions when it carries them, in both directions", () => {
    expect(staffMayReadQuotations({ role: WITH, perms: [] })).toBe(false);
    expect(staffMayReadQuotations({ role: WITH, perms: ["leads:read"] })).toBe(false);
    expect(staffMayReadQuotations({ role: WITHOUT, perms: ["quotes:read"] })).toBe(true);
  });

  it("falls back to the role's defaults when the session carries none", () => {
    expect(staffMayReadQuotations({ role: WITH })).toBe(true);
    expect(staffMayReadQuotations({ role: WITH, perms: null })).toBe(true);
    expect(staffMayReadQuotations({ role: WITHOUT })).toBe(false);
  });

  it("never treats a customer or vendor login, or a missing role, as staff", () => {
    expect(staffMayReadQuotations({ role: "CLIENT", perms: ["quotes:read"] })).toBe(false);
    expect(staffMayReadQuotations({ role: "VENDOR", perms: ["quotes:read"] })).toBe(false);
    expect(staffMayReadQuotations({ role: null, perms: ["quotes:read"] })).toBe(false);
    expect(staffMayReadQuotations({ role: undefined })).toBe(false);
    expect(staffMayReadQuotations(null)).toBe(false);
  });
});

describe("decideQuotationPdfAccess", () => {
  it("refuses a visitor who has only the quotation id", () => {
    expect(decideQuotationPdfAccess(input())).toEqual({ allowed: false });
  });

  it("opens for staff", () => {
    expect(decideQuotationPdfAccess(input({ viewer: { role: WITH } }))).toEqual({ allowed: true, via: "STAFF" });
    expect(decideQuotationPdfAccess(input({ viewer: { role: "ADMIN", perms: ["*"] } }))).toEqual({ allowed: true, via: "STAFF" });
  });

  it("opens for a login whose verified contacts include the quotation's contact", () => {
    expect(
      decideQuotationPdfAccess(input({ viewer: { role: "CLIENT", perms: [] }, verifiedContactIds: ["contact-x", "contact-asha"] }))
    ).toEqual({ allowed: true, via: "CUSTOMER" });
  });

  it("refuses another customer, a quotation with no contact, and contact ids without a signed-in viewer", () => {
    const client = { role: "CLIENT", perms: [] as string[] };
    expect(decideQuotationPdfAccess(input({ viewer: client, verifiedContactIds: ["contact-other"] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ viewer: client, contactId: null, verifiedContactIds: ["contact-asha"] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ viewer: null, verifiedContactIds: ["contact-asha"] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ viewer: { role: WITHOUT }, verifiedContactIds: [] })).allowed).toBe(false);
  });

  it("opens with the token of a live share link that shows this quotation, among several links", () => {
    const links = [
      { token: "Other0000000000000000000x", status: "ACTIVE", expiresAt: null },
      { token: TOKEN, status: "ACTIVE", expiresAt: new Date("2030-02-01T00:00:00.000Z") },
    ];
    expect(decideQuotationPdfAccess(input({ token: TOKEN, shareLinks: links }))).toEqual({ allowed: true, via: "SHARE_LINK" });
    expect(decideQuotationPdfAccess(input({ token: ` ${TOKEN} `, shareLinks: [live] })).allowed).toBe(true);
  });

  it("refuses a wrong token, a prefix of the real one, a revoked or expired link, and a token with no link", () => {
    expect(decideQuotationPdfAccess(input({ token: "Wrong0000000000000000000", shareLinks: [live] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ token: TOKEN.slice(0, 20), shareLinks: [live] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ token: `${TOKEN}x`, shareLinks: [live] })).allowed).toBe(false);
    for (const status of ["REVOKED", "EXPIRED"]) {
      expect(decideQuotationPdfAccess(input({ token: TOKEN, shareLinks: [{ ...live, status }] })).allowed).toBe(false);
    }
    const lapsed = { ...live, expiresAt: new Date(NOW.getTime() - 1) };
    expect(decideQuotationPdfAccess(input({ token: TOKEN, shareLinks: [lapsed] })).allowed).toBe(false);
    expect(decideQuotationPdfAccess(input({ token: TOKEN, shareLinks: [] })).allowed).toBe(false);
  });

  it("ignores a token that isn't shaped like one we issue, even when a stored value equals it", () => {
    for (const odd of ["short", "has spaces in it 12345678", "abc/def+ghi=jkl000000000"]) {
      expect(decideQuotationPdfAccess(input({ token: odd, shareLinks: [{ ...live, token: odd }] })).allowed).toBe(false);
    }
  });
});

describe("share link helpers", () => {
  it("shareTokenParam keeps only base64url tokens of 16 to 128 characters", () => {
    expect(shareTokenParam(`  ${TOKEN} `)).toBe(TOKEN);
    expect(shareTokenParam(null)).toBeNull();
    expect(shareTokenParam(undefined)).toBeNull();
    expect(shareTokenParam("")).toBeNull();
    expect(shareTokenParam("a".repeat(15))).toBeNull();
    expect(shareTokenParam("a".repeat(16))).toBe("a".repeat(16));
    expect(shareTokenParam("a".repeat(129))).toBeNull();
  });

  it("a link is live while ACTIVE and not past its expiry", () => {
    expect(isLiveQuotationShareLink(live, NOW)).toBe(true);
    expect(isLiveQuotationShareLink({ ...live, expiresAt: NOW }, NOW)).toBe(true);
    expect(isLiveQuotationShareLink({ ...live, expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe(false);
    expect(isLiveQuotationShareLink({ ...live, status: "REVOKED" }, NOW)).toBe(false);
    expect(isLiveQuotationShareLink({ ...live, status: "EXPIRED" }, NOW)).toBe(false);
  });
});
