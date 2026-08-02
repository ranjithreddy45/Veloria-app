import { describe, it, expect } from "vitest";
import {
  eventTypeTag,
  ENQUIRY_SOURCES,
  ENQUIRY_SOURCE_OPTIONS,
  enquirySourceLabel,
  isEnquirySource,
  toEnquirySource,
} from "./enquiry-source";

// ============================================================
// The four channels the business actually plans spend against. These are the
// exact labels the user asked for, so the test pins them: a rename here would
// silently change what a channel report means.
// ============================================================

describe("enquiry source constants", () => {
  it("exposes exactly the four agreed channels, in order", () => {
    expect([...ENQUIRY_SOURCES]).toEqual([
      "DIRECT",
      "GOOGLE_ADS",
      "PAID_SOCIAL",
      "LEAD_FORM",
    ]);
  });

  it("labels Paid Social so both names are recognisable to staff", () => {
    expect(enquirySourceLabel("PAID_SOCIAL")).toBe("Facebook Ads / Paid Social");
  });

  it("reads a blank source as 'Not recorded' rather than guessing", () => {
    expect(enquirySourceLabel(null)).toBe("Not recorded");
    expect(enquirySourceLabel(undefined)).toBe("Not recorded");
    expect(enquirySourceLabel("SOMETHING_ELSE")).toBe("Not recorded");
  });

  it("every dropdown option is a valid stored value", () => {
    for (const o of ENQUIRY_SOURCE_OPTIONS) expect(isEnquirySource(o.value)).toBe(true);
    expect(ENQUIRY_SOURCE_OPTIONS).toHaveLength(4);
  });

  it("rejects non-channel values so they can't reach the column", () => {
    expect(isEnquirySource("direct")).toBe(false); // case matters — stored uppercase
    expect(isEnquirySource("")).toBe(false);
    expect(isEnquirySource(null)).toBe(false);
    expect(isEnquirySource(42)).toBe(false);
  });
});

describe("toEnquirySource — integration strings → channel", () => {
  it("maps the Google Ads capture strings", () => {
    for (const s of ["google_ads", "GOOGLE_ADS", "Google Ads", "gads", "GOOGLE"]) {
      expect(toEnquirySource(s)).toBe("GOOGLE_ADS");
    }
  });

  it("maps every paid-social flavour onto one bucket", () => {
    for (const s of ["facebook_ads", "FACEBOOK", "meta", "INSTAGRAM", "paid_social", "fb_leadgen"]) {
      expect(toEnquirySource(s)).toBe("PAID_SOCIAL");
    }
  });

  it("maps anything that arrived through a form we host", () => {
    for (const s of ["WEBSITE", "website", "WIDGET", "web_form", "landing_page", "configurator", "api"]) {
      expect(toEnquirySource(s)).toBe("LEAD_FORM");
    }
  });

  it("falls back to DIRECT for offline / unknown origins", () => {
    for (const s of ["WALK_IN", "PHONE", "REFERRAL", "JUSTDIAL", "", null, undefined, "   "]) {
      expect(toEnquirySource(s)).toBe("DIRECT");
    }
  });

  it("always returns a storable value, whatever it is handed", () => {
    for (const s of ["!!!", "google", "FACEBOOK/META", "unknown-thing"]) {
      expect(isEnquirySource(toEnquirySource(s))).toBe(true);
    }
  });
});

describe("eventTypeTag — the tag is the EVENT, not the channel", () => {
  it("normalises the many spellings of one event to a single chip", () => {
    // Without this, "wedding" / "WEDDING" / "Wedding" become three separate
    // chips and the tag filter fragments across them.
    for (const v of ["wedding", "WEDDING", " Wedding ", "wEdDiNg"]) {
      expect(eventTypeTag(v)).toBe("Wedding");
    }
    expect(eventTypeTag("baby shower")).toBe("Baby Shower");
    expect(eventTypeTag("BIRTHDAY PARTY")).toBe("Birthday Party");
  });

  it("treats separators as spaces, so form values match typed ones", () => {
    expect(eventTypeTag("corporate_event")).toBe("Corporate Event");
    expect(eventTypeTag("baby-shower")).toBe("Baby Shower");
  });

  it("returns null when there is no usable event type", () => {
    // No tag at all beats an "Unknown" chip on every untyped enquiry.
    for (const v of ["", "   ", null, undefined, "123", "--"]) {
      expect(eventTypeTag(v)).toBeNull();
    }
  });

  it("refuses a whole message pasted into the event field", () => {
    const essay = "We are planning a wedding reception for about 400 guests in December";
    expect(eventTypeTag(essay)).toBeNull();
  });
});
