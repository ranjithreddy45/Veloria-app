// ============================================================
// Reading a Meta instant form, whatever marketing named the questions.
// ------------------------------------------------------------
// Meta derives each answer's key from the question text, so "How many guests?"
// becomes `how_many_guests_` and editing the question renames the key. An exact
// match would break silently the next time someone rewords a question, and the
// lead would arrive with empty fields and nobody would know why. So every rule
// here matches on what the key CONTAINS, and anything unmatched is kept in the
// raw payload rather than dropped.
//
// Values arrive machine-shaped too: `50_-_100`, `under_₹50,000`,
// `venue_+_décor…`. They are tidied for display but never rewritten in the raw
// copy, which is what a dispute gets settled against.
//
// Pure — no database, no network.
// ============================================================

export interface MetaField {
  name: string;
  values?: (string | null)[];
}

export interface MetaLeadPayload {
  id?: string;
  created_time?: string;
  field_data?: MetaField[];
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  platform?: string;
  is_organic?: boolean;
}

/** The venues these campaigns run for. Anything else stays Unassigned. */
export const KNOWN_VENUE_LABELS = [
  "JP Nagar",
  "Bellandur",
  "Yelahanka",
  "Hosa Road",
  "Indiranagar",
] as const;

export const UNASSIGNED_VENUE = "Unassigned";

/** Forms whose leads are venue owners, not customers. */
export const OWNER_FORM_PREFIX = "VG Owner Partnership";

export interface MappedMetaLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Free text exactly as answered, e.g. "Jan 8 27". Never invented. */
  eventDateText: string | null;
  /** Only set when the text is unambiguous; otherwise null and the text stands. */
  eventDate: Date | null;
  /** Display text of the band, e.g. "50 - 100". */
  guestsText: string | null;
  /** Lower bound of the band, for the fields that need a number. */
  guestCount: number | null;
  budget: string | null;
  requirement: string | null;
  visitTiming: string | null;
  eventType: string | null;
  platform: string | null;
  source: "Facebook Lead Ad" | "Instagram Lead Ad";
  venueLabel: string;
  pipeline: "event" | "owner_partnership";
  isTest: boolean;
  /** Answers no rule claimed, so they can still reach the notes. */
  unmapped: { key: string; value: string }[];
}

const first = (f?: MetaField): string | null => {
  const v = f?.values?.find((x) => typeof x === "string" && x.trim().length > 0);
  return typeof v === "string" ? v.trim() : null;
};

/** First answer whose key contains any of these needles. */
export function pick(fields: MetaField[], ...needles: string[]): string | null {
  const hit = fields.find((f) =>
    needles.some((n) => (f.name ?? "").toLowerCase().includes(n.toLowerCase()))
  );
  return first(hit);
}

/** `venue_+_décor` → "venue + décor". Underscores are Meta's, not the answer's. */
export function pretty(value: string | null): string | null {
  if (!value) return null;
  const out = value.replace(/_/g, " ").replace(/\s{2,}/g, " ").trim();
  return out || null;
}

/** "50 - 100" → 50. A band's lower bound is the safe read for a minimum rule. */
export function bandLowerBound(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/\d[\d,]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A date only when it is unambiguous.
 *
 * Answers look like "Jan 8 27", "19 Dec" or "12/01". Guessing a year or a
 * day/month order would put a wedding in the wrong month on a quotation, so
 * anything short of a full, parseable date stays as text and the field stays
 * empty. The text always reaches the lead's notes either way.
 */
export function parseEventDate(text: string | null, now: Date = new Date()): Date | null {
  if (!text) return null;
  const raw = text.trim();

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return utc(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // "8 Jan 2027" / "Jan 8 2027" / "8 January 2027"
  const withYear = raw.match(
    /^(?:(\d{1,2})\s+)?([A-Za-z]{3,})\s+(?:(\d{1,2})\s*,?\s*)?(\d{4})$/
  );
  if (withYear) {
    const day = Number(withYear[1] ?? withYear[3]);
    const month = monthFromName(withYear[2]);
    if (day && month) return utc(Number(withYear[4]), month, day);
  }

  // "19 Dec" / "Dec 19" — no year. Take the next occurrence, which is what a
  // customer asking about a date means, but only when the day is unambiguous.
  const noYear = raw.match(/^(?:(\d{1,2})\s+([A-Za-z]{3,})|([A-Za-z]{3,})\s+(\d{1,2}))$/);
  if (noYear) {
    const day = Number(noYear[1] ?? noYear[4]);
    const month = monthFromName(noYear[2] ?? noYear[3]);
    if (day && month) {
      const thisYear = utc(now.getUTCFullYear(), month, day);
      if (!thisYear) return null;
      return thisYear >= startOfDay(now) ? thisYear : utc(now.getUTCFullYear() + 1, month, day);
    }
  }

  return null; // "Jan 8 27", "next month", "12/01" — ambiguous, keep the text
}

function monthFromName(name?: string): number | null {
  if (!name) return null;
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const i = months.indexOf(name.slice(0, 3).toLowerCase());
  return i === -1 ? null : i + 1;
}

function utc(y: number, m: number, d: number): Date | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "P | Bellandur | Birthday" → "Bellandur". "R | All Venues | …" → Unassigned. */
export function venueFromAdsetName(adsetName?: string | null): string {
  const m = /^\s*P\s*\|\s*([^|]+?)\s*\|/.exec(adsetName ?? "");
  if (!m) return UNASSIGNED_VENUE;
  const label = m[1].trim();
  const known = KNOWN_VENUE_LABELS.find(
    (v) => v.toLowerCase() === label.toLowerCase()
  );
  // An unrecognised venue is still a venue: keep what the ad set said rather
  // than flattening it to Unassigned, so a new location shows up as itself.
  return known ?? label ?? UNASSIGNED_VENUE;
}

const IDENTITY = /(full_?name|^name$|first_?name|last_?name|email|phone|city|zip|postal)/i;

/** Map one Graph lead payload onto the fields the CRM keeps. */
export function mapMetaLead(
  payload: MetaLeadPayload,
  formName?: string | null,
  now: Date = new Date()
): MappedMetaLead {
  const fields = Array.isArray(payload.field_data) ? payload.field_data : [];

  const eventDateText = pretty(
    pick(fields, "event_date", "date_should_we_check", "event_da", "which_date", "date")
  );
  const guestsText = pretty(pick(fields, "guest"));
  const platform = payload.platform ?? null;

  const claimed = new Set<string>();
  const claim = (needles: string[]) => {
    for (const f of fields) {
      const key = (f.name ?? "").toLowerCase();
      if (needles.some((n) => key.includes(n))) claimed.add(f.name);
    }
  };
  claim(["event_date", "date_should_we_check", "event_da", "which_date", "date"]);
  claim(["guest"]);
  claim(["budget"]);
  claim(["what_do_you_need"]);
  claim(["visit"]);
  claim(["type_of_event", "what_type_of_event"]);

  const unmapped = fields
    .filter((f) => !claimed.has(f.name) && !IDENTITY.test(f.name ?? ""))
    .map((f) => ({ key: f.name, value: first(f) ?? "" }))
    .filter((f) => f.value);

  const isTest =
    fields.some((f) =>
      (f.values ?? []).some((v) => typeof v === "string" && v.toLowerCase().includes("<test lead"))
    ) || Boolean(payload.is_organic && !payload.ad_id);

  return {
    // Phone keeps Meta's E.164 exactly; reformatting is how a number stops
    // matching the contact it belongs to.
    name: pick(fields, "full_name", "name"),
    phone: pick(fields, "phone_number", "phone"),
    email: pick(fields, "email"),
    eventDateText,
    eventDate: parseEventDate(eventDateText, now),
    guestsText,
    guestCount: bandLowerBound(guestsText),
    budget: pretty(pick(fields, "budget")),
    requirement: pretty(pick(fields, "what_do_you_need")),
    visitTiming: pretty(pick(fields, "visit")),
    eventType: pretty(pick(fields, "type_of_event", "what_type_of_event")),
    platform,
    source: platform === "ig" ? "Instagram Lead Ad" : "Facebook Lead Ad",
    venueLabel: venueFromAdsetName(payload.adset_name),
    pipeline: (formName ?? "").startsWith(OWNER_FORM_PREFIX) ? "owner_partnership" : "event",
    isTest,
    unmapped,
  };
}

/** The one-line summary that carries everything into the lead's notes. */
export function describeMetaLead(m: MappedMetaLead, payload: MetaLeadPayload): string {
  const parts = [
    m.eventType ? `Event: ${m.eventType}` : null,
    m.eventDateText ? `Date: ${m.eventDateText}` : null,
    m.guestsText ? `Guests: ${m.guestsText}` : null,
    m.budget ? `Budget: ${m.budget}` : null,
    m.requirement ? `Needs: ${m.requirement}` : null,
    m.visitTiming ? `Visit: ${m.visitTiming}` : null,
    m.venueLabel && m.venueLabel !== UNASSIGNED_VENUE ? `Venue: ${m.venueLabel}` : null,
    payload.campaign_name ? `Campaign: ${payload.campaign_name}` : null,
    ...m.unmapped.map((u) => `${pretty(u.key)}: ${u.value}`),
  ].filter(Boolean);
  return parts.join(" · ");
}
