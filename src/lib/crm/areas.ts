// ============================================================
// Lead area: where in Bengaluru the customer wants their event.
//
// The owner (27 Nov 2026) wants leads allocated by area. The Meta / Instagram
// forms already ask "Preferred area in Bengaluru?" and the website form asks
// for an area or venue, but the answer only ever landed inside the lead's
// description, so nobody could filter or route on it.
//
// Lead.area holds one key from LEAD_AREAS (or null = not known yet), and
// Lead.areaSource says where it came from:
//   "given"  — passed in explicitly (a form field, the Push API)
//   "form"   — read from a labelled form answer ("Preferred area: Hosa Road")
//   "venue"  — the lead's preferred venue is in that area
//   "text"   — the area is named in the enquiry text
//   "manual" — a person set it on the lead
//   "none"   — looked and found nothing (so the backfill doesn't look again)
//
// Plain module (not "use server"): it exports constants and sync helpers.
// ============================================================

export type Zone = "NORTH" | "EAST" | "SOUTH" | "SOUTH_EAST" | "WEST";

export interface LeadArea {
  key: string;
  label: string;
  /** The zone the area is in (zone entries carry their own zone). */
  zone: Zone | null;
  /** Lower-case spellings that identify this area in free text. */
  aliases: string[];
}

/**
 * The areas the venues cover, then one "any area" entry per zone, then Other.
 * The Meta / Instagram form asks for a ZONE ("North (Yelahanka, Hebbal,
 * Kammanahalli)"), so a lead from it gets the zone entry; it is never guessed
 * into one specific area. Order = dropdown order.
 */
export const LEAD_AREAS: readonly LeadArea[] = [
  { key: "YELAHANKA", label: "Yelahanka", zone: "NORTH", aliases: ["yelahanka", "yelhanka", "yalahanka"] },
  { key: "HEBBAL", label: "Hebbal", zone: "NORTH", aliases: ["hebbal"] },
  { key: "INDIRANAGAR", label: "Indiranagar", zone: "EAST", aliases: ["indiranagar", "indira nagar"] },
  { key: "WHITEFIELD", label: "Whitefield", zone: "EAST", aliases: ["whitefield", "white field"] },
  { key: "KR_PURAM", label: "KR Puram", zone: "EAST", aliases: ["kr puram", "k r puram", "k.r. puram", "k.r puram", "krishnarajapuram"] },
  { key: "BROOKFIELD", label: "Brookfield", zone: "EAST", aliases: ["brookfield", "brook field"] },
  { key: "HORAMAVU", label: "Horamavu", zone: "EAST", aliases: ["horamavu"] },
  { key: "JP_NAGAR", label: "JP Nagar", zone: "SOUTH", aliases: ["jp nagar", "j p nagar", "j.p. nagar", "j.p nagar", "jpnagar"] },
  { key: "BELLANDUR", label: "Bellandur", zone: "SOUTH_EAST", aliases: ["bellandur", "bellendur", "belandur"] },
  { key: "HOSA_ROAD", label: "Hosa Road", zone: "SOUTH_EAST", aliases: ["hosa road", "hosaroad", "hosa rd"] },
  { key: "ELECTRONIC_CITY", label: "Electronic City", zone: "SOUTH_EAST", aliases: ["electronic city", "electronics city", "e city", "ecity", "e-city"] },
  { key: "ZONE_NORTH", label: "North (any area)", zone: "NORTH", aliases: [] },
  { key: "ZONE_EAST", label: "East (any area)", zone: "EAST", aliases: [] },
  { key: "ZONE_SOUTH", label: "South (any area)", zone: "SOUTH", aliases: [] },
  { key: "ZONE_SOUTH_EAST", label: "South-East (any area)", zone: "SOUTH_EAST", aliases: [] },
  { key: "ZONE_WEST", label: "West (any area)", zone: "WEST", aliases: [] },
  { key: "OTHER", label: "Other / Any", zone: null, aliases: [] },
];

const ZONE_ENTRY: Record<Zone, string> = {
  NORTH: "ZONE_NORTH",
  EAST: "ZONE_EAST",
  SOUTH: "ZONE_SOUTH",
  SOUTH_EAST: "ZONE_SOUTH_EAST",
  WEST: "ZONE_WEST",
};

/** "South-East (Koramangala, HSR…)" → ZONE_SOUTH_EAST. Checked at the start of an answer. */
function zoneOfAnswer(answer: string): string | null {
  const m = /^\s*(north|south[\s-]*east|east|south|west)\b/i.exec(answer);
  if (!m) return null;
  const z = m[1].toLowerCase().replace(/[\s-]+/g, "");
  const zone: Zone = z === "southeast" ? "SOUTH_EAST" : (z.toUpperCase() as Zone);
  return ZONE_ENTRY[zone] ?? null;
}

export const AREA_OTHER = "OTHER";

const BY_KEY = new Map(LEAD_AREAS.map((a) => [a.key, a]));

export function isLeadArea(key: string | null | undefined): key is string {
  return !!key && BY_KEY.has(key);
}

export function areaLabel(key: string | null | undefined): string | null {
  return key ? BY_KEY.get(key)?.label ?? null : null;
}

export type AreaSource = "given" | "form" | "venue" | "text" | "manual" | "none";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One regex per area, matching any alias as a whole word / phrase.
const AREA_RES: { key: string; re: RegExp }[] = LEAD_AREAS.filter((a) => a.aliases.length).map((a) => ({
  key: a.key,
  re: new RegExp(`(^|[^a-z])(${a.aliases.map(escapeRe).join("|")})(?=$|[^a-z])`, "i"),
}));

/** Every distinct area named in a piece of text, in LEAD_AREAS order. */
export function areasIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return AREA_RES.filter((a) => a.re.test(text)).map((a) => a.key);
}

const ANY_RE = /^(any|anywhere|any area|any location|anything|no preference|not sure|flexible|open)\b/i;

// "Preferred area in Bengaluru?: Hosa Road", "area = Bellandur", "Preferred venue: …"
// The label is matched case-insensitively; the answer runs to the next
// "label:" pair, a newline, a "|" or "," list break, or the end.
const LABELLED_RE =
  /(?:preferred\s+)?(?:area|location|locality|venue)(?:\s+in\s+bengaluru|\s+in\s+bangalore)?\s*\??\s*[:=]\s*([^\n|;·\[]{1,80})/gi;

/** An answer that only names the city says nothing about the area. */
const CITY_ONLY_RE = /^(bengaluru|bangalore|blr|bengaluru city|bangalore city)\.?$/i;

/**
 * The area a customer gave in their own form answers, if they answered an
 * area / location / venue question. An answer naming none of our areas
 * ("Koramangala", "Any") is OTHER; an answer naming two different areas is
 * left undecided (null) rather than guessed.
 */
export function areaFromFormAnswers(text: string | null | undefined): string | null {
  if (!text) return null;
  const found = new Set<string>();
  let answered = false;
  for (const m of text.matchAll(LABELLED_RE)) {
    // Stop the answer at the next "word:" label on the same line.
    const answer = m[1].replace(/\s[a-z_ ?]{2,40}\s*[:=].*$/i, "").trim();
    if (!answer || CITY_ONLY_RE.test(answer)) continue;
    answered = true;
    const zone = zoneOfAnswer(answer);
    if (zone) {
      found.add(zone); // a zone answer lists example areas: never pick one of them
      continue;
    }
    const hits = areasIn(answer);
    if (hits.length) hits.forEach((h) => found.add(h));
    else if (ANY_RE.test(answer) || answer.length > 1) found.add(AREA_OTHER);
  }
  if (!answered) return null;
  const named = [...found].filter((k) => k !== AREA_OTHER);
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    // A specific area and the zone it sits in agree: keep the specific one.
    const specific = named.filter((k) => !k.startsWith("ZONE_"));
    if (specific.length === 1) {
      const zoneOfSpecific = BY_KEY.get(specific[0])?.zone;
      const zones = named.filter((k) => k.startsWith("ZONE_"));
      if (zones.every((z) => BY_KEY.get(z)?.zone === zoneOfSpecific)) return specific[0];
    }
    return null;
  }
  return AREA_OTHER;
}

/** The area a venue sits in, from its name ("Veloria Grand — Hosa Road · Pearl Hall"). */
export function areaFromVenueName(name: string | null | undefined): string | null {
  const hits = areasIn(name);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Decide a new lead's area, best evidence first: an explicit value, the
 * customer's own form answer, their preferred venue, then a single area named
 * anywhere in the enquiry. Two different areas in free text decide nothing.
 */
export function resolveLeadArea(input: {
  given?: string | null;
  venueName?: string | null;
  text?: string | null;
}): { area: string | null; source: AreaSource } {
  if (input.given) {
    const key = input.given.trim().toUpperCase().replace(/[\s/-]+/g, "_");
    if (isLeadArea(key)) return { area: key, source: "given" };
    const hits = areasIn(input.given);
    if (hits.length === 1) return { area: hits[0], source: "given" };
  }
  const form = areaFromFormAnswers(input.text);
  const formIsSpecific = !!form && form !== AREA_OTHER && !form.startsWith("ZONE_");
  if (formIsSpecific) return { area: form, source: "form" };
  const venue = areaFromVenueName(input.venueName);
  // A venue in the zone they asked for (or with no zone answer) is more precise.
  if (venue && (!form || form === AREA_OTHER || BY_KEY.get(form)?.zone === BY_KEY.get(venue)?.zone)) {
    return { area: venue, source: "venue" };
  }
  if (form) return { area: form, source: "form" }; // a zone, or an area that isn't one of ours
  const loose = areasIn(input.text);
  if (loose.length === 1) return { area: loose[0], source: "text" };
  return { area: null, source: "none" };
}

// ---- Leads-list filter -----------------------------------------------------

export const AREA_FILTER_NONE = "NONE";
const ZONE_FILTER_PREFIX = "ZALL_";

const ZONE_LABEL: Record<Zone, string> = {
  NORTH: "North",
  EAST: "East",
  SOUTH: "South",
  SOUTH_EAST: "South-East",
  WEST: "West",
};

/**
 * Filter choices: each zone as a whole (its areas plus "any area" answers),
 * then each area, then "not known". Values are URL-safe strings.
 */
export function areaFilterOptions(): { value: string; label: string }[] {
  const zones = (Object.keys(ZONE_LABEL) as Zone[]).map((z) => ({
    value: `${ZONE_FILTER_PREFIX}${z}`,
    label: `All ${ZONE_LABEL[z]}`,
  }));
  const areas = LEAD_AREAS.map((a) => ({ value: a.key, label: a.label }));
  return [...zones, ...areas, { value: AREA_FILTER_NONE, label: "Area not known" }];
}

/**
 * The area keys a filter value selects: a list (zone or one area), null for
 * "not known", or undefined when the value is empty or unknown (no filter).
 */
export function areaFilterKeys(value: string | null | undefined): string[] | null | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (v === AREA_FILTER_NONE) return null;
  if (v.startsWith(ZONE_FILTER_PREFIX)) {
    const zone = v.slice(ZONE_FILTER_PREFIX.length) as Zone;
    if (!(zone in ZONE_LABEL)) return undefined;
    return LEAD_AREAS.filter((a) => a.zone === zone).map((a) => a.key);
  }
  return isLeadArea(v) ? [v] : undefined;
}
