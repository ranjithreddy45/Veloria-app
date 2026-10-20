// ============================================================
// Meta leads from a sheet export → the same payload the Graph API returns.
// ------------------------------------------------------------
// While the CRM has no working Meta token, the leads still land in the Google
// Sheet Meta fills ("Leads Sheet"). Its columns are Meta's own export format —
// id, created_time, ad/adset/campaign/form ids and names, platform, one column
// per form question, full_name, phone — with Meta's type prefixes on the ids
// ("l:", "p:", "ag:", "as:", "c:", "f:") and created_time in the ad account's
// timezone ("2026-10-01T12:09:25-05:00"). Converting a row into a
// MetaLeadPayload lets it go through processMetaLeadPayload exactly like an
// API lead: same mapping, same Meta-lead-id dedupe (so a later API import of
// the same lead is a no-op), same past-enquiry handling and exclusions.
//
// The sales team also works these sheets — owner, remarks, venue shared — so
// those columns are returned separately to be written onto the lead.
// ============================================================

import type { MetaLeadPayload } from "./field-map";

/** Columns Meta itself writes about the ad, not answers. */
const META_COLUMNS = new Set([
  "id",
  "created_time",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
  "lead_status", // Meta's own CRM stage ("CREATED"): not an answer, not ours
]);

/** The sales team's working columns, keyed by a normalised header. */
const TEAM_COLUMNS: Record<string, keyof SheetTeamNotes> = {
  "lead owner": "owner",
  "lead qualification": "qualification",
  remarks: "remarks",
  "event date": "eventDate",
  "expected date of closure": "closure",
  "property details shared?": "propertyShared",
  "quotation shared ?": "quotationShared",
  "quotation shared?": "quotationShared",
  status: "status",
  priority: "priority",
};

export interface SheetTeamNotes {
  owner?: string;
  qualification?: string;
  remarks?: string;
  eventDate?: string;
  closure?: string;
  propertyShared?: string;
  quotationShared?: string;
  status?: string;
  priority?: string;
}

export interface SheetLead {
  payload: MetaLeadPayload;
  team: SheetTeamNotes;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

/** Meta's export puts a type prefix on ids and phones: "l:123", "p:+91…". */
function stripPrefix(v: string): string {
  return v.replace(/^(l|p|ag|as|c|f):/i, "");
}

/** Meta writes this in place of a name/id the exporting user can't see. */
function isPermissionNotice(v: string): boolean {
  return /don't have enough permissions/i.test(v);
}

function clean(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s || isPermissionNotice(s)) return undefined;
  return s;
}

/** created_time with its offset → ISO UTC; undefined if it isn't a real time. */
function toIso(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** One sheet row (header → cell) → a Graph-style payload plus the team's notes. Null if it has no lead id. */
export function sheetRowToLead(row: Record<string, unknown>): SheetLead | null {
  const byNorm = new Map<string, { header: string; value: string | undefined }>();
  for (const [header, value] of Object.entries(row)) {
    byNorm.set(norm(header), { header, value: clean(value) });
  }
  const meta = (k: string) => byNorm.get(k)?.value;

  const id = meta("id") ? stripPrefix(meta("id")!) : undefined;
  if (!id) return null;

  const team: SheetTeamNotes = {};
  const field_data: { name: string; values: string[] }[] = [];
  for (const [key, { header, value }] of byNorm) {
    if (META_COLUMNS.has(key) || value === undefined) continue;
    const teamKey = TEAM_COLUMNS[key];
    if (teamKey) {
      team[teamKey] = value;
      continue;
    }
    // A form question or contact field. Phones carry the "p:" prefix.
    const isPhone = /phone/i.test(header);
    field_data.push({ name: header.trim(), values: [isPhone ? stripPrefix(value) : value] });
  }

  const idOf = (k: string) => (meta(k) ? stripPrefix(meta(k)!) : undefined);
  const payload: MetaLeadPayload = {
    id,
    created_time: toIso(meta("created_time")),
    ad_id: idOf("ad_id"),
    ad_name: meta("ad_name"),
    adset_id: idOf("adset_id"),
    adset_name: meta("adset_name"),
    campaign_id: idOf("campaign_id"),
    campaign_name: meta("campaign_name"),
    form_id: idOf("form_id"),
    form_name: meta("form_name"),
    platform: meta("platform"),
    is_organic: meta("is_organic")?.toLowerCase() === "true",
    field_data,
  };
  return { payload, team };
}

/** The team's sheet work as one line for the lead's notes; null when the row has none. */
export function describeTeamNotes(t: SheetTeamNotes): string | null {
  const parts = [
    t.owner ? `Owner: ${t.owner}` : null,
    t.remarks ? `Remarks: ${t.remarks}` : null,
    t.qualification ? `Qualification: ${t.qualification}` : null,
    t.propertyShared ? `Property shared: ${t.propertyShared}` : null,
    t.quotationShared ? `Quotation shared: ${t.quotationShared}` : null,
    t.eventDate ? `Event date (sheet): ${t.eventDate}` : null,
    t.closure ? `Expected closure: ${t.closure}` : null,
    t.status ? `Status: ${t.status}` : null,
    t.priority ? `Priority: ${t.priority}` : null,
  ].filter(Boolean);
  return parts.length ? `Leads Sheet — ${parts.join(" · ")}` : null;
}

/**
 * The person a sheet's "Lead Owner" names: its first name ("Meera-Nayana" →
 * Meera, the first owner). Matched to exactly one active staff member by first
 * name, or null — a label like "High Intent" is not a person.
 */
export function ownerFirstName(owner: string | undefined): string | null {
  if (!owner) return null;
  const firstName = owner.split(/[-,/&+]/)[0]?.trim().split(/\s+/)[0];
  return firstName ? firstName.toLowerCase() : null;
}

/**
 * What the sheet's remarks say happened on the call, as a CRM status — only
 * for a lead still at NEW. Unanswered calls → NOT_CONNECTED; a real
 * conversation (qualified, call back, transferred) → CONTACTED. Anything else
 * (including "not enquired" and "lost") leaves the status for a person to set.
 */
export function statusFromRemarks(remarks: string | undefined): "NOT_CONNECTED" | "CONTACTED" | null {
  if (!remarks) return null;
  const r = remarks.toLowerCase();
  if (/qualified|call ?back|transfer|interested|visit/.test(r) && !/not interested/.test(r)) return "CONTACTED";
  if (/not answer|rnr|busy|switch(ed)? ?off|not reachable|no incoming|unreachable/.test(r)) return "NOT_CONNECTED";
  return null;
}
