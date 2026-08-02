// ============================================================
// Enquiry source — the MARKETING CHANNEL an enquiry is credited to.
//
// Deliberately only four buckets. `Lead.source` already records the precise
// origin across 17 values (INDIAMART, JUSTDIAL, WEDMEGOOD, WHATSAPP…), which is
// useful for provenance but useless for the question the team actually asks of
// an enquiry: which channel do we credit, and what is it costing us? These four
// map cleanly onto how spend is planned.
//
// Plain module (NOT "use server") so the constants can be imported by client
// components — a "use server" file may only export async functions.
// ============================================================

export const ENQUIRY_SOURCES = ["DIRECT", "GOOGLE_ADS", "PAID_SOCIAL", "LEAD_FORM"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const ENQUIRY_SOURCE_LABEL: Record<EnquirySource, string> = {
  DIRECT: "Direct",
  GOOGLE_ADS: "Google Ads",
  PAID_SOCIAL: "Facebook Ads / Paid Social",
  LEAD_FORM: "Lead form",
};

/** Short label for tight columns and pills. */
export const ENQUIRY_SOURCE_SHORT: Record<EnquirySource, string> = {
  DIRECT: "Direct",
  GOOGLE_ADS: "Google Ads",
  PAID_SOCIAL: "Paid Social",
  LEAD_FORM: "Lead form",
};

/** Pill hues, matching the app's StatusPill vocabulary. */
export const ENQUIRY_SOURCE_HUE = {
  DIRECT: "slate",
  GOOGLE_ADS: "blue",
  PAID_SOCIAL: "indigo",
  LEAD_FORM: "emerald",
} as const satisfies Record<EnquirySource, string>;

export function isEnquirySource(v: unknown): v is EnquirySource {
  return typeof v === "string" && (ENQUIRY_SOURCES as readonly string[]).includes(v);
}

/** Label for display; null/unknown reads as "Not recorded" rather than blank. */
export function enquirySourceLabel(v: string | null | undefined): string {
  return isEnquirySource(v) ? ENQUIRY_SOURCE_LABEL[v] : "Not recorded";
}

/**
 * Map whatever an integration calls itself onto one of the four channels.
 *
 * Accepts BOTH the raw strings the capture routes pass ("google_ads",
 * "WEBSITE", "WIDGET") and the normalised `LeadSource` enum values, because
 * captureLeadFromExternal is called with the former while historic Lead rows
 * hold the latter — and the backfill has to read those.
 *
 * Anything unrecognised falls back to DIRECT: an enquiry we cannot attribute to
 * a paid channel is, by definition, one that reached us on its own.
 */
export function toEnquirySource(raw: string | null | undefined): EnquirySource {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "DIRECT";

  if (s.includes("google") || s === "gads") return "GOOGLE_ADS";
  if (
    s.includes("facebook") || s.includes("meta") || s.includes("instagram") ||
    s.includes("social") || s.includes("fb_")
  ) {
    return "PAID_SOCIAL";
  }
  // Anything that arrived through a form we host: the website widget, the
  // embeddable enquiry form, the public configurator, a partner API post.
  if (
    s.includes("website") || s.includes("widget") || s.includes("web_form") ||
    s.includes("webform") || s.includes("form") || s.includes("landing") ||
    s.includes("configurator") || s === "api"
  ) {
    return "LEAD_FORM";
  }
  return "DIRECT";
}

/** Ordered options for every source dropdown in the app. */
export const ENQUIRY_SOURCE_OPTIONS = ENQUIRY_SOURCES.map((value) => ({
  value,
  label: ENQUIRY_SOURCE_LABEL[value],
}));

// ============================================================
// Event-type tag.
//
// Tags on an enquiry are for WHAT THE EVENT IS — "Wedding", "Baby Shower",
// "Corporate Event". That is the thing staff scan the list for. The capture
// channel deliberately does NOT go here; it has its own column.
//
// Event type reaches us as free text from a dozen forms ("wedding", "WEDDING",
// " baby shower "), so it is normalised to one Title Case shape — otherwise the
// same event produces three different chips and the tag filter fragments.
// ============================================================

/** Longest sensible event label; anything beyond this is a message, not a type. */
const MAX_EVENT_TAG = 40;

/**
 * Normalise a raw event type into a tag, or null when there isn't a usable one.
 * Returns null rather than a placeholder — an enquiry with no stated event type
 * should carry no tag, not a "Unknown" chip.
 */
export function eventTypeTag(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!v || v.length > MAX_EVENT_TAG) return null;
  // Reject values that carry no letters ("123", "--").
  if (!/[a-z]/i.test(v)) return null;
  return v
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
