// ============================================================
// Sales teams — Wedding, Corporate, Social events. Pure, client-safe.
// ------------------------------------------------------------
// Every lead belongs to one team's CRM, so the three teams never work each
// other's enquiries. The team comes from the event type when the lead arrives;
// a lead with no event type is Unsorted until a sales head (or anyone who can
// see it) puts it in a team. A person's move is final — auto-sorting never
// overrides it (Lead.salesTeamManual).
// ============================================================

export const SALES_TEAMS = [
  { key: "WEDDING", label: "Wedding", short: "Wedding" },
  { key: "CORPORATE", label: "Corporate", short: "Corporate" },
  { key: "SOCIAL", label: "Social events", short: "Social" },
] as const;

export type SalesTeamKey = (typeof SALES_TEAMS)[number]["key"];

/** The URL / filter value for leads with no team yet. */
export const UNSORTED = "UNSORTED";

export function isSalesTeam(value: unknown): value is SalesTeamKey {
  return typeof value === "string" && SALES_TEAMS.some((t) => t.key === value);
}

export function salesTeamLabel(value: string | null | undefined): string {
  return SALES_TEAMS.find((t) => t.key === value)?.label ?? "Unsorted";
}

// Checked in order; the first match wins. Wedding-family events before the
// generic words ("Wedding Anniversary" is Social — an anniversary party).
const RULES: [RegExp, SalesTeamKey][] = [
  [/anniv|annriversary/, "SOCIAL"],
  [/corporate|conference|seminar|meeting|offsite|off-site|launch|award|agm|team ?outing|town ?hall|summit|exhibition|product/, "CORPORATE"],
  [/wedding|marriage|muhurtham|kalyanam|reception|engagement|nischitartham|ring ceremony|haldi|mehendi|mehndi|mehandi|sangeet|cocktail|pre-?wedding|roka|tilak/, "WEDDING"],
  [/birthday|b'?day|baby ?shower|seemantham|godh ?bharai|valaikappu|naming|namakaran|cradle|thread ceremony|upanayan|housewarming|griha|puja|pooja|get.?to.?gether|reunion|alumni|party|kitty|celebration|inau?g|retirement|farewell|graduation|kids|seniors|christening|communion/, "SOCIAL"],
];

/**
 * The team an event type belongs to, or null when it can't be told (no event
 * type, or "Other"). Free text is matched loosely, so "Birthday Party",
 * "bday" and "Kids Party" all land in Social.
 */
export function teamForEventType(eventType: string | null | undefined): SalesTeamKey | null {
  const s = (eventType ?? "").toLowerCase().trim();
  if (!s || /^(other|others|none|na|n\/a|-)$/.test(s)) return null;
  for (const [re, team] of RULES) if (re.test(s)) return team;
  return null;
}
