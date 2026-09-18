import { describe, it, expect } from "vitest";
import {
  cleanLine,
  cleanText,
  diffFields,
  formatPhoneForDisplay,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeWebUrl,
  telLink,
  validateBusinessProfileInput,
  waMeHref,
} from "./contact-rules";

const value = <T,>(r: { ok: true; value: T } | { ok: false; error: string }) => (r.ok ? r.value : `ERROR: ${r.error}`);

describe("normalizePhoneNumber", () => {
  it("stores every shape people type for an Indian mobile as +91XXXXXXXXXX", () => {
    for (const typed of ["9876543210", "98765 43210", "+91 98765 43210", "+91-98765-43210", "919876543210", "09876543210", "0091 98765 43210"]) {
      expect(value(normalizePhoneNumber(typed))).toBe("+919876543210");
    }
  });

  it("accepts landlines with an STD code, with or without the trunk zero", () => {
    expect(value(normalizePhoneNumber("(080) 1234 5678"))).toBe("+918012345678");
    expect(value(normalizePhoneNumber("+91 (0) 80 1234 5678"))).toBe("+918012345678");
    expect(value(normalizePhoneNumber("011 2345 6789"))).toBe("+911123456789");
  });

  it("treats empty as not set rather than an error", () => {
    for (const empty of ["", "   ", null, undefined]) expect(value(normalizePhoneNumber(empty))).toBeNull();
  });

  it("rejects numbers that are not Indian, too short, too long or not numbers at all", () => {
    for (const bad of ["12345", "+1 415 555 0100", "98765-4321x", "0000000000", "98765432101", "false", "+", "+91 98765", "()"]) {
      expect(normalizePhoneNumber(bad).ok, bad).toBe(false);
    }
    expect(normalizePhoneNumber("+44 20 7946 0958")).toEqual({ ok: false, error: "Phone number must be an Indian (+91) number." });
  });

  it("never turns a non-string into a number", () => {
    expect(normalizePhoneNumber(9876543210).ok).toBe(false);
    expect(normalizePhoneNumber(false).ok).toBe(false);
  });

  it("allows toll-free numbers for calls but not for WhatsApp", () => {
    expect(value(normalizePhoneNumber("1800 123 4567", "phone"))).toBe("18001234567");
    expect(value(normalizePhoneNumber("1860-500-1234", "phone"))).toBe("18605001234");
    const wa = normalizePhoneNumber("1800 123 4567", "whatsapp");
    expect(wa.ok).toBe(false);
    if (!wa.ok) expect(wa.error).toMatch(/toll-free/);
  });

  it("names the field in its messages", () => {
    const wa = normalizePhoneNumber("123", "whatsapp");
    expect(wa.ok).toBe(false);
    if (!wa.ok) expect(wa.error).toMatch(/^WhatsApp number/);
  });
});

describe("contact links", () => {
  it("builds wa.me links from stored and env-style numbers", () => {
    expect(waMeHref("+919876543210")).toBe("https://wa.me/919876543210");
    expect(waMeHref("919876543210")).toBe("https://wa.me/919876543210");
    // a bare 10-digit mobile would otherwise open a chat with the wrong country
    expect(waMeHref("98765 43210")).toBe("https://wa.me/919876543210");
    expect(waMeHref("+91 98765 43210", "Hi there & welcome")).toBe("https://wa.me/919876543210?text=Hi%20there%20%26%20welcome");
  });

  it("builds dialable tel: links", () => {
    expect(telLink("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telLink("080-1234 5678")).toBe("tel:+918012345678");
    expect(telLink("18001234567")).toBe("tel:18001234567");
  });

  it("formats numbers for display", () => {
    expect(formatPhoneForDisplay("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhoneForDisplay("919876543210")).toBe("+91 98765 43210");
    expect(formatPhoneForDisplay("18001234567")).toBe("1800 123 4567");
    expect(formatPhoneForDisplay("+442079460958")).toBe("+442079460958");
    expect(formatPhoneForDisplay(null)).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(value(normalizeEmail("  Events@Example.CO.IN "))).toBe("events@example.co.in");
    expect(value(normalizeEmail("first.last+team@sub.example.com"))).toBe("first.last+team@sub.example.com");
  });

  it("rejects malformed addresses and treats empty as not set", () => {
    for (const bad of ["a@b", "no-at-sign.com", "x@y.c", "two@@example.com", "spaces in@example.com", "x@-bad.com"]) {
      expect(normalizeEmail(bad).ok, bad).toBe(false);
    }
    expect(value(normalizeEmail(""))).toBeNull();
  });
});

describe("normalizeWebUrl", () => {
  it("adds https:// to a bare link and keeps path and query", () => {
    expect(value(normalizeWebUrl("maps.app.goo.gl/AbCd123"))).toBe("https://maps.app.goo.gl/AbCd123");
    expect(value(normalizeWebUrl("https://www.google.com/maps?q=Hall+A"))).toBe("https://www.google.com/maps?q=Hall+A");
    expect(value(normalizeWebUrl("HTTPS://Example.com/Tour"))).toBe("https://example.com/Tour");
    expect(value(normalizeWebUrl("http://example.com"))).toBe("http://example.com/");
  });

  it("refuses anything that is not a public http(s) link", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com/file", "https://localhost:3000", "https://user:pw@example.com", "not a url", "https://", "example"]) {
      expect(normalizeWebUrl(bad).ok, bad).toBe(false);
    }
  });

  it("treats empty as not set", () => {
    expect(value(normalizeWebUrl("   "))).toBeNull();
  });
});

describe("text cleaning", () => {
  it("collapses a single line and enforces its limit", () => {
    expect(value(cleanLine("  Mon–Sat,   10 am – 7 pm ", 120, "Hours"))).toBe("Mon–Sat, 10 am – 7 pm");
    expect(cleanLine("x".repeat(121), 120, "Hours").ok).toBe(false);
  });

  it("keeps line breaks but tidies trailing spaces and blank runs", () => {
    expect(value(cleanText("Line 1  \r\n\r\n\r\nLine 2 ", 500, "Address"))).toBe("Line 1\n\nLine 2");
  });
});

describe("validateBusinessProfileInput", () => {
  it("normalises every field in one pass", () => {
    const r = validateBusinessProfileInput({
      displayName: "  Veloria   Grand  ",
      phone: "080 1234 5678",
      whatsapp: "98765 43210",
      email: "Team@Example.com",
      address: "Line 1  \r\n\r\n\r\nLine 2",
      mapUrl: "maps.app.goo.gl/x1",
      supportHours: " Mon–Sat,  10 am – 7 pm ",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        displayName: "Veloria Grand",
        phone: "+918012345678",
        whatsapp: "+919876543210",
        email: "team@example.com",
        address: "Line 1\n\nLine 2",
        mapUrl: "https://maps.app.goo.gl/x1",
        supportHours: "Mon–Sat, 10 am – 7 pm",
      },
    });
  });

  it("clears every field when nothing is entered", () => {
    const r = validateBusinessProfileInput(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.values(r.data).every((v) => v === null)).toBe(true);
  });

  it("reports each invalid field separately", () => {
    const r = validateBusinessProfileInput({ phone: "123", email: "bad", mapUrl: "javascript:x", supportHours: "Daily" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "mapUrl", "phone"]);
  });
});

describe("diffFields", () => {
  it("records only the fields that changed", () => {
    expect(diffFields({ phone: "+919876543210", email: null }, { phone: "+919876543210", email: "a@example.com" })).toEqual({
      email: { from: null, to: "a@example.com" },
    });
  });

  it("treats a missing row as all-null before", () => {
    expect(diffFields(null, { phone: "+919876543210", email: null })).toEqual({ phone: { from: null, to: "+919876543210" } });
  });
});
