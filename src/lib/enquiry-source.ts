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

export const ENQUIRY_SOURCES = [
  "DIRECT",
  "ORGANIC_SEARCH",
  "GOOGLE_ADS",
  "PAID_SOCIAL",
  "ORGANIC_SOCIAL",
  "REFERRAL",
  "LEAD_FORM",
] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const ENQUIRY_SOURCE_LABEL: Record<EnquirySource, string> = {
  DIRECT: "Direct",
  ORGANIC_SEARCH: "Organic search",
  GOOGLE_ADS: "Google Ads",
  PAID_SOCIAL: "Facebook Ads / Paid Social",
  ORGANIC_SOCIAL: "Social (unpaid)",
  REFERRAL: "Referring site",
  // Kept for enquiries that came through a form we host but carried no
  // usable origin signal — a widget or partner API post with no referrer.
  // It means "we know the mechanism, not the channel", which is the honest
  // thing to say rather than guessing at Direct.
  LEAD_FORM: "Website form (origin unknown)",
};

/** Short label for tight columns and pills. */
export const ENQUIRY_SOURCE_SHORT: Record<EnquirySource, string> = {
  DIRECT: "Direct",
  ORGANIC_SEARCH: "Organic",
  GOOGLE_ADS: "Google Ads",
  PAID_SOCIAL: "Paid Social",
  ORGANIC_SOCIAL: "Social",
  REFERRAL: "Referral",
  LEAD_FORM: "Web form",
};

/** Pill hues, matching the app's StatusPill vocabulary. */
export const ENQUIRY_SOURCE_HUE = {
  DIRECT: "slate",
  ORGANIC_SEARCH: "teal",
  GOOGLE_ADS: "blue",
  PAID_SOCIAL: "indigo",
  ORGANIC_SOCIAL: "violet",
  REFERRAL: "amber",
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

// ============================================================
// Classifying a WEBSITE enquiry by how the visitor actually arrived.
//
// A form submission is a MECHANISM, not a channel. Everyone who fills in the
// website form used "the form" — but one found us on Google organic, one
// clicked a paid ad, one was linked from a wedding blog, and one typed the URL.
// Crediting all four to "Lead form" told us how they typed, not what to spend
// money on. Since the form already forwards utm/gclid/referrer, the answer was
// sitting in the payload unread.
//
// PRECEDENCE — most trustworthy evidence first. A paid click id is a fact; a
// utm_medium is a convention someone typed into a campaign builder; a referrer
// is a hint the browser may withhold. Read them in that order.
// ============================================================

/** Hosts that are search engines — an unpaid visit from one is organic search. */
const SEARCH_HOSTS = [
  "google.", "bing.", "yahoo.", "duckduckgo.", "ecosia.", "baidu.",
  "yandex.", "search.brave.", "ask.com", "qwant.",
];

/** Hosts that are social platforms. */
const SOCIAL_HOSTS = [
  "facebook.", "fb.com", "instagram.", "twitter.", "x.com", "t.co",
  "linkedin.", "lnkd.in", "pinterest.", "youtube.", "youtu.be",
  "tiktok.", "reddit.", "whatsapp.", "wa.me", "threads.",
];

/** utm_medium values that mean money changed hands. */
const PAID_MEDIUMS = [
  "cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search",
  "paidsocial", "paid_social", "paid-social", "display", "banner",
  "cpm", "retargeting", "remarketing",
];

function hostOf(url: string | null | undefined): string {
  const v = (url ?? "").trim();
  if (!v) return "";
  try {
    return new URL(v.startsWith("http") ? v : `https://${v}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const matches = (host: string, list: string[]) => list.some((h) => host.includes(h));

/** Signals a website capture can carry. All optional — browsers withhold plenty. */
export interface ChannelSignals {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  referrerUrl?: string | null;
}

/**
 * Work out which channel a website enquiry belongs to.
 *
 * Returns null when there is genuinely no signal, so the caller can decide
 * between DIRECT (a real person typed the URL) and LEAD_FORM (we never had
 * any attribution to begin with). Those are different states and collapsing
 * them would invent attribution that was never observed.
 */
export function classifyWebChannel(sig: ChannelSignals | null | undefined): EnquirySource | null {
  if (!sig) return null;
  const src = (sig.utmSource ?? "").trim().toLowerCase();
  const med = (sig.utmMedium ?? "").trim().toLowerCase();
  const host = hostOf(sig.referrerUrl);

  // 1. Paid click ids — unambiguous, the platform stamped them itself.
  if (sig.gclid || sig.gbraid || sig.wbraid) return "GOOGLE_ADS";
  if (sig.fbclid) return "PAID_SOCIAL";

  // 2. An explicitly PAID medium; the source decides which paid channel.
  if (med && PAID_MEDIUMS.some((m) => med === m || med.includes(m))) {
    if (src.includes("google") || src.includes("adwords") || src.includes("gads")) return "GOOGLE_ADS";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta") || src.includes("fb"))
      return "PAID_SOCIAL";
    // Paid, but the source doesn't say where. Social is the likelier of the
    // two for this business, but guessing would be attribution fiction —
    // fall through to the referrer, which may still identify it.
  }

  // 3. An explicitly ORGANIC medium.
  if (med === "organic" || med === "organic_search") {
    return matches(src, SOCIAL_HOSTS) || src.includes("instagram") || src.includes("facebook")
      ? "ORGANIC_SOCIAL"
      : "ORGANIC_SEARCH";
  }
  if (med === "social" || med === "organic_social") return "ORGANIC_SOCIAL";
  if (med === "referral") return "REFERRAL";
  if (med === "email" || med === "newsletter") return "REFERRAL";

  // 4. The referring host. No paid marker got this far, so it is unpaid.
  if (host) {
    if (matches(host, SEARCH_HOSTS)) return "ORGANIC_SEARCH";
    if (matches(host, SOCIAL_HOSTS)) return "ORGANIC_SOCIAL";
    // A real other website linked to us — but ignore our OWN domains, which
    // are just internal navigation and say nothing about acquisition.
    if (!host.includes("veloriagrand")) return "REFERRAL";
  }

  // 5. utm_source on its own, with no medium and no referrer.
  if (src) {
    if (src.includes("google")) return "ORGANIC_SEARCH";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta")) return "ORGANIC_SOCIAL";
  }

  // 6. No referrer, no campaign tags — a direct visit, which is a real and
  // common answer (typed URL, bookmark, or a referrer the browser stripped).
  return null;
}
