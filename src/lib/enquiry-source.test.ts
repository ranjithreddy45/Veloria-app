import { describe, it, expect } from "vitest";
import {
  classifyWebChannel,
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
  it("exposes the agreed channels, in order", () => {
    // Extended beyond the original four once it became clear that "website"
    // is not a channel: the same form receives organic search, paid clicks,
    // referring sites and direct visits, and they are bought differently.
    expect([...ENQUIRY_SOURCES]).toEqual([
      "DIRECT",
      "ORGANIC_SEARCH",
      "GOOGLE_ADS",
      "PAID_SOCIAL",
      "ORGANIC_SOCIAL",
      "REFERRAL",
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
    expect(ENQUIRY_SOURCE_OPTIONS).toHaveLength(ENQUIRY_SOURCES.length);
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

describe("classifyWebChannel — how the visitor actually arrived", () => {
  it("trusts a paid click id above everything else", () => {
    // The platform stamped these itself; they are facts, not conventions.
    expect(classifyWebChannel({ gclid: "abc" })).toBe("GOOGLE_ADS");
    expect(classifyWebChannel({ gbraid: "abc" })).toBe("GOOGLE_ADS");
    expect(classifyWebChannel({ wbraid: "abc" })).toBe("GOOGLE_ADS");
    expect(classifyWebChannel({ fbclid: "abc" })).toBe("PAID_SOCIAL");
    // Even when a referrer suggests otherwise — the click id wins.
    expect(
      classifyWebChannel({ gclid: "abc", referrerUrl: "https://www.google.com/search?q=halls" })
    ).toBe("GOOGLE_ADS");
  });

  it("reads organic search from the referring search engine", () => {
    // This is the case that was being mislabelled "Lead form".
    for (const ref of [
      "https://www.google.com/search?q=banquet+hall+bengaluru",
      "https://www.bing.com/search?q=wedding+venue",
      "https://duckduckgo.com/?q=marriage+hall",
      "https://in.search.yahoo.com/search?p=venue",
    ]) {
      expect(classifyWebChannel({ referrerUrl: ref })).toBe("ORGANIC_SEARCH");
    }
  });

  it("separates paid social from unpaid social", () => {
    expect(classifyWebChannel({ utmSource: "facebook", utmMedium: "cpc" })).toBe("PAID_SOCIAL");
    expect(classifyWebChannel({ utmSource: "instagram", utmMedium: "paid_social" })).toBe("PAID_SOCIAL");
    // A plain link shared in a story or bio is NOT ad spend.
    expect(classifyWebChannel({ referrerUrl: "https://l.instagram.com/" })).toBe("ORGANIC_SOCIAL");
    expect(classifyWebChannel({ referrerUrl: "https://www.facebook.com/" })).toBe("ORGANIC_SOCIAL");
  });

  it("counts another website linking to us as a referral", () => {
    expect(classifyWebChannel({ referrerUrl: "https://someweddingblog.in/best-venues" })).toBe("REFERRAL");
    expect(classifyWebChannel({ utmMedium: "referral" })).toBe("REFERRAL");
  });

  it("ignores our own domain — internal navigation is not acquisition", () => {
    expect(classifyWebChannel({ referrerUrl: "https://www.theveloriagrand.com/pricing" })).toBeNull();
    expect(classifyWebChannel({ referrerUrl: "https://veloriagrand.com/" })).toBeNull();
  });

  it("returns null when there is genuinely no signal", () => {
    // Null, not a guess. The caller decides between Direct and "origin
    // unknown" — inventing a channel here would fabricate attribution.
    expect(classifyWebChannel({})).toBeNull();
    expect(classifyWebChannel(null)).toBeNull();
    expect(classifyWebChannel({ referrerUrl: "", utmSource: "", utmMedium: "" })).toBeNull();
    expect(classifyWebChannel({ referrerUrl: "not a url" })).toBeNull();
  });

  it("maps utm_medium=organic to search, not to the form", () => {
    expect(classifyWebChannel({ utmSource: "google", utmMedium: "organic" })).toBe("ORGANIC_SEARCH");
  });

  it("always returns a storable channel when it returns one at all", () => {
    const cases = [
      { gclid: "x" }, { fbclid: "x" }, { referrerUrl: "https://google.com/" },
      { referrerUrl: "https://twitter.com/" }, { utmMedium: "referral" },
    ];
    for (const c of cases) {
      const out = classifyWebChannel(c);
      expect(out === null || isEnquirySource(out)).toBe(true);
    }
  });
});
