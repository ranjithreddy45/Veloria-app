// ============================================================
// Meta "VG Owner Partnership Application" form → a BD (acquisition) lead.
// ------------------------------------------------------------
// Venue owners who answer the partnership ad are not event customers; they
// belong in the BD CRM (/bd/leads), not the sales pipeline. The form asks
// what an AcqLead needs — the person's role at the venue, the venue type, its
// status, which venue and where — in its own words, so this maps those words
// onto the BD enums and keeps every original answer in the notes. Pure.
//
// Owner's routing rule (2026-10-22): Bengaluru leads are shared between
// Nickson and Rakshith; Guntur and Vijayawada go to Srinivas.
// ============================================================

import type { MetaLeadPayload } from "./field-map";
import { pick, pretty } from "./field-map";
import { readVenueAnswer } from "./owner-venue";

export type AcqOwnerType = "SOLE_OWNER" | "PARTNER" | "GPA_HOLDER" | "MANAGER";
export type AcqPropertyType = "BANQUET" | "MARRIAGE_HALL" | "CONVENTION_CENTRE" | "RESORT" | "LAWN";
export type AcqPropertyStage = "OPERATIONAL" | "CONVERSION" | "BROWNFIELD" | "GREENFIELD";
export type AcqLeadSource = "SOCIAL_MEDIA" | "BROKER";

export interface MappedOwnerLead {
  ownerName: string;
  phone: string | null;
  email: string | null;
  propertyName: string;
  locality: string;
  /** True when the form gave no separate area, so the city stands in for it. */
  localityIsPlaceholder: boolean;
  city: string;
  propertyType: AcqPropertyType;
  /** True when the venue type was "Other" and Banquet stands in for it. */
  propertyTypeIsPlaceholder: boolean;
  propertyStage: AcqPropertyStage | null;
  /** The owner asked for full management → interested in the management model. */
  qualOwnerInterested: boolean | null;
  ownerType: AcqOwnerType;
  leadSource: AcqLeadSource;
  notes: string;
  isTest: boolean;
}

/** First names of the BD people a city's owner leads go to. */
export const META_OWNER_BD_ROUTING: Record<string, string[]> = {
  bengaluru: ["Nickson", "Rakshith"],
  guntur: ["Srinivas"],
  vijayawada: ["Srinivas"],
};

/** Who a city's leads are shared between (Bengaluru's pair by default for an unknown city). */
export function bdCandidatesForCity(city: string): string[] {
  return META_OWNER_BD_ROUTING[city.trim().toLowerCase()] ?? META_OWNER_BD_ROUTING.bengaluru;
}

const CITY_WORDS: [RegExp, string][] = [
  [/bengaluru|bangalore/i, "Bengaluru"],
  [/guntur/i, "Guntur"],
  [/vijayawada/i, "Vijayawada"],
  [/hyderabad/i, "Hyderabad"],
  [/chennai/i, "Chennai"],
  [/mysuru|mysore/i, "Mysuru"],
];

/** The city the form is for, from the question wording, the form name or the campaign. */
export function cityOf(payload: MetaLeadPayload, formName?: string | null): string {
  const fields = Array.isArray(payload.field_data) ? payload.field_data : [];
  const venueQuestion = fields.find((f) => /which_venue_is_this/i.test(f.name ?? ""))?.name ?? "";
  for (const text of [venueQuestion, formName ?? "", payload.campaign_name ?? "", payload.adset_name ?? ""]) {
    const hit = CITY_WORDS.find(([re]) => re.test(text));
    if (hit) return hit[1];
  }
  return "Bengaluru";
}

function ownerTypeOf(role: string | null): { ownerType: AcqOwnerType; leadSource: AcqLeadSource } {
  const r = (role ?? "").toLowerCase();
  // "Manager representing the owner" contains "owner": the acting-for-someone
  // roles are checked before the owner itself.
  if (/manager/.test(r)) return { ownerType: "MANAGER", leadSource: "SOCIAL_MEDIA" };
  if (/operator|authori[sz]ed/.test(r)) return { ownerType: "GPA_HOLDER", leadSource: "SOCIAL_MEDIA" };
  if (/broker|agent/.test(r)) return { ownerType: "MANAGER", leadSource: "BROKER" };
  if (/owner/.test(r)) return { ownerType: "SOLE_OWNER", leadSource: "SOCIAL_MEDIA" };
  return { ownerType: "MANAGER", leadSource: "SOCIAL_MEDIA" };
}

function propertyTypeOf(venueType: string | null): { propertyType: AcqPropertyType; placeholder: boolean } {
  const v = (venueType ?? "").toLowerCase();
  if (/lawn|open.?air|garden/.test(v)) return { propertyType: "LAWN", placeholder: false };
  if (/convention/.test(v)) return { propertyType: "CONVENTION_CENTRE", placeholder: false };
  if (/banquet/.test(v)) return { propertyType: "BANQUET", placeholder: false };
  if (/marriage|kalyana|mandap/.test(v)) return { propertyType: "MARRIAGE_HALL", placeholder: false };
  if (/resort/.test(v)) return { propertyType: "RESORT", placeholder: false };
  return { propertyType: "BANQUET", placeholder: true };
}

function propertyStageOf(status: string | null): AcqPropertyStage | null {
  const s = (status ?? "").toLowerCase();
  if (/operational|running|open$/.test(s)) return "OPERATIONAL";
  // A venue still at the planning stage is a new build in the making.
  // "Opening soon" says when, not what kind of build, so it stays in the notes.
  if (/planning/.test(s)) return "GREENFIELD";
  return null;
}

function interestedOf(support: string | null): boolean | null {
  const s = (support ?? "").toLowerCase();
  if (/full\s*management/.test(s)) return true;
  return null;
}

export function mapOwnerLead(payload: MetaLeadPayload, formName?: string | null): MappedOwnerLead {
  const fields = Array.isArray(payload.field_data) ? payload.field_data : [];
  const role = pretty(pick(fields, "role_at_the_venue", "your_role"));
  const venueType = pretty(pick(fields, "type_of_venue"));
  const status = pretty(pick(fields, "current_status"));
  const support = pretty(pick(fields, "support_are_you_considering", "support"));
  const start = pretty(pick(fields, "consider_starting", "when_would_you"));
  const venueText = pick(fields, "which_venue_is_this", "which_venue", "venue_name");
  const formCity = cityOf(payload, formName);
  const venue = readVenueAnswer(venueText, formCity);
  const { propertyName, locality, localityIsPlaceholder, city } = venue;
  const { ownerType, leadSource } = ownerTypeOf(role);
  const { propertyType, placeholder: propertyTypeIsPlaceholder } = propertyTypeOf(venueType);

  const isTest = fields.some((f) => (f.values ?? []).some((v) => typeof v === "string" && v.toLowerCase().includes("<test lead")));
  const platform = payload.platform === "ig" ? "Instagram" : "Facebook";

  const notes = [
    `From the ${platform} owner-partnership ad form${formName ? ` (${formName})` : ""}.`,
    role ? `Role at the venue: ${role}` : null,
    venueType ? `Venue type: ${venueType}${propertyTypeIsPlaceholder ? " (Banquet entered as a placeholder)" : ""}` : null,
    status ? `Current status: ${status}` : null,
    support ? `Support wanted: ${support}` : null,
    start ? `Would start: ${start}` : null,
    venueText ? `Venue and area, as written: ${venueText.trim()}` : null,
    venue.nameIsPlaceholder ? `No venue name in the answer — ask the owner.` : null,
    venue.cityFromAnswer && city !== formCity ? `Filed under ${city} from the answer (the form was for ${formCity}).` : null,
    payload.campaign_name ? `Campaign: ${payload.campaign_name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ownerName: pick(fields, "full_name", "name") ?? "Venue owner",
    phone: pick(fields, "phone_number", "phone"),
    email: pick(fields, "email"),
    propertyName,
    locality,
    localityIsPlaceholder,
    city,
    propertyType,
    propertyTypeIsPlaceholder,
    propertyStage: propertyStageOf(status),
    qualOwnerInterested: interestedOf(support),
    ownerType,
    leadSource,
    notes,
    isTest,
  };
}
