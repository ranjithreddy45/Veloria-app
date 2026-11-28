// ============================================================
// BD CRM ← "VG Bangalore Leads Overview" sheet (owner request, 2026-11-24).
// Pure mapping from one sheet row (or the rows sharing a phone) to what the
// BD lead should become. scripts/import-bd-sheet.ts reads and writes the DB.
// ------------------------------------------------------------
// Owner decisions (2026-11-24):
//   • The sheet's owner wins (Rakshith / Nick).
//   • Hot leads (Prospect, Meeting done, Proposal sent, Won) are NOT turned
//     into deals here — the team converts them in the app. In this CRM the
//     "Qualify lead" action is what creates the deal, and it refuses a lead
//     already marked QUALIFIED, so they stay CONTACTED with a 🔥 note.
//   • Past follow-up dates move to tomorrow 10:00 IST; closed leads get none.
//   • Junk / wrong number → DISQUALIFIED (kept, so the number is recognised).
// Nothing is invented: a past meeting is recorded as held only when the
// sheet's status says it happened; otherwise its date goes into the note.
// ============================================================

export const SHEET_FILE = "VG_Bangalore_Leads_Overview.xlsx";
/** Every imported note starts with this — the re-run guard looks for it. */
export const IMPORT_MARK = `Imported from ${SHEET_FILE}`;

export interface SheetRow {
  leadId: string; // BLR-001
  name: string;
  phone: string;
  venue: string | null;
  owner: string; // Rakshith | Nick
  status: string;
  bucket: string | null;
  conversation: string | null;
  followUp: number | null; // Excel date serial
  meetingDate: number | null; // Excel date serial
  meetingTime: number | null; // fraction of a day
  email: string | null;
  venueType: string | null;
  venueStage: string | null;
}

type LeadStatus = "NEW" | "CONTACTED" | "DISQUALIFIED";
type Outcome = "CONNECTED" | "NO_ANSWER" | "INTERESTED" | "NOT_INTERESTED" | "CALLBACK" | "OTHER";
export type PropertyType = "BANQUET" | "MARRIAGE_HALL" | "CONVENTION_CENTRE" | "RESORT" | "LAWN";
export type PropertyStage = "OPERATIONAL" | "CONVERSION" | "BROWNFIELD" | "GREENFIELD";

interface StatusRule {
  status: LeadStatus;
  reason: "OUT_OF_GEOGRAPHY" | "OTHER" | null;
  outcome: Outcome;
  /** The owner actually spoke to someone. */
  reached: boolean;
  hot: boolean;
  /** A past meeting with this status certainly happened. */
  meetingHeld: boolean;
}

const R = (status: LeadStatus, outcome: Outcome, reached: boolean, extra: Partial<StatusRule> = {}): StatusRule =>
  ({ status, reason: null, outcome, reached, hot: false, meetingHeld: false, ...extra });

export const STATUS_RULES: Record<string, StatusRule> = {
  "DNP / no answer": R("NEW", "NO_ANSWER", false),
  "Connected - follow up": R("CONTACTED", "CONNECTED", true),
  "Meeting requested": R("CONTACTED", "INTERESTED", true),
  "Meeting scheduled": R("CONTACTED", "INTERESTED", true),
  "Details shared - awaiting reply": R("CONTACTED", "INTERESTED", true),
  "Nurture - later": R("CONTACTED", "CALLBACK", true),
  Prospect: R("CONTACTED", "INTERESTED", true, { hot: true, meetingHeld: true }),
  "Meeting done": R("CONTACTED", "INTERESTED", true, { hot: true, meetingHeld: true }),
  "Proposal sent": R("CONTACTED", "INTERESTED", true, { hot: true, meetingHeld: true }),
  Won: R("CONTACTED", "INTERESTED", true, { hot: true, meetingHeld: true }),
  "Not in city perimeter": R("DISQUALIFIED", "CONNECTED", true, { reason: "OUT_OF_GEOGRAPHY" }),
  "Not interested": R("DISQUALIFIED", "NOT_INTERESTED", true, { reason: "OTHER" }),
  "Junk / invalid / duplicate": R("DISQUALIFIED", "OTHER", false, { reason: "OTHER" }),
  "Wrong number": R("DISQUALIFIED", "OTHER", false, { reason: "OTHER" }),
};

export const OWNER_KEYS: Record<string, "RAKSHITH" | "NICK"> = { rakshith: "RAKSHITH", nick: "NICK" };

/** "+91 77955 72420", "9380026314" → "+917795572420", "+919380026314". Other countries kept as written. */
export function normalizePhone(raw: string): string {
  const p = (raw ?? "").replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(p)) return `+91${p}`;
  if (/^91\d{10}$/.test(p)) return `+${p}`;
  return p;
}

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Excel serial 0 = 1899-12-30 (the 1900 leap-year bug is already baked in). */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/** An Excel date (+ optional time-of-day fraction), read as India time. */
export function excelIst(serial: number, dayFraction = 0): Date {
  const wholeDays = Math.floor(serial);
  const minutes = Math.round(dayFraction * 24 * 60);
  return new Date(EXCEL_EPOCH_UTC + wholeDays * DAY_MS + minutes * 60_000 - IST_MS);
}

/** YYYY-MM-DD of an instant, in India. */
export function istDay(d: Date): string {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

const atTenIst = (day: string) => new Date(new Date(`${day}T10:00:00.000Z`).getTime() - IST_MS);

export function mapPropertyType(v: string | null): PropertyType | null {
  const s = (v ?? "").toLowerCase();
  if (/lawn|open.?air/.test(s)) return "LAWN";
  if (/convention/.test(s)) return "CONVENTION_CENTRE";
  if (/banquet/.test(s)) return "BANQUET";
  return null; // "Other" / blank: keep what the CRM has
}

export function mapPropertyStage(v: string | null): PropertyStage | null {
  const s = (v ?? "").toLowerCase();
  if (/operational/.test(s)) return "OPERATIONAL";
  if (/planning/.test(s)) return "GREENFIELD";
  return null; // "Opening soon" says when, not what kind of build — kept in the note
}

const fmtIst = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export interface LeadPlan {
  leadId: string;
  /** Other sheet rows for the same phone (the sheet marked them duplicates). */
  alsoListedAs: string[];
  phone: string;
  ownerName: string;
  email: string | null;
  owner: "RAKSHITH" | "NICK";
  status: LeadStatus;
  disqualifyReason: "OUT_OF_GEOGRAPHY" | "OTHER" | null;
  outcome: Outcome;
  reached: boolean;
  hot: boolean;
  nextFollowupAt: Date | null;
  /** The sheet's date was already past, so it was moved to tomorrow. */
  followUpMoved: boolean;
  meeting: { scheduledAt: Date; status: "COMPLETED" | "SCHEDULED" } | null;
  propertyType: PropertyType | null;
  propertyStage: PropertyStage | null;
  venue: string | null;
  note: string;
}

/**
 * Plan one lead from the sheet rows that share its phone number. The row to
 * follow is the first one NOT marked "Junk / invalid / duplicate" (the sheet
 * marks the repeat that way); the others are mentioned in the note.
 */
export function planLead(rows: SheetRow[], ctx: { now: Date }): LeadPlan {
  if (rows.length === 0) throw new Error("planLead needs at least one row");
  const primary = rows.find((r) => r.status !== "Junk / invalid / duplicate") ?? rows[0];
  const others = rows.filter((r) => r !== primary);
  const rule = STATUS_RULES[primary.status];
  if (!rule) throw new Error(`${primary.leadId}: unknown status "${primary.status}"`);
  const owner = OWNER_KEYS[primary.owner.trim().toLowerCase()];
  if (!owner) throw new Error(`${primary.leadId}: unknown owner "${primary.owner}"`);

  const today = istDay(ctx.now);
  const tomorrow = istDay(new Date(ctx.now.getTime() + DAY_MS));

  let nextFollowupAt: Date | null = null;
  let followUpMoved = false;
  if (rule.status !== "DISQUALIFIED" && primary.followUp != null) {
    const day = istDay(excelIst(primary.followUp));
    if (day <= today) {
      nextFollowupAt = atTenIst(tomorrow);
      followUpMoved = true;
    } else nextFollowupAt = atTenIst(day);
  }

  let meeting: LeadPlan["meeting"] = null;
  let meetingLine: string | null = null;
  if (primary.meetingDate != null) {
    const at = excelIst(primary.meetingDate, primary.meetingTime ?? 0);
    if (at.getTime() > ctx.now.getTime()) {
      meeting = { scheduledAt: at, status: "SCHEDULED" };
      meetingLine = `Meeting scheduled: ${fmtIst(at)}`;
    } else if (rule.meetingHeld) {
      meeting = { scheduledAt: at, status: "COMPLETED" };
      meetingLine = `Meeting held: ${fmtIst(at)}`;
    } else {
      meetingLine = `Meeting date in the sheet: ${fmtIst(at)} (whether it happened isn't recorded)`;
    }
  }

  const conv = (r: SheetRow) => (r.conversation ?? "").trim();
  const lines = [
    `${IMPORT_MARK} (${primary.leadId}) on ${fmtIst(ctx.now).split(",")[0]}.`,
    rule.hot ? `🔥 Hot — sheet status "${primary.status}". Use "Qualify lead" in the app to create the deal.` : null,
    `Sheet status: ${primary.status}${primary.bucket ? ` · ${primary.bucket}` : ""}`,
    primary.venue ? `Venue / area (sheet): ${primary.venue.trim()}` : null,
    primary.venueStage ? `Venue stage (sheet): ${primary.venueStage}` : null,
    meetingLine,
    followUpMoved && primary.followUp != null
      ? `Follow-up in the sheet was ${istDay(excelIst(primary.followUp))}; moved to ${tomorrow} because it had passed.`
      : null,
    conv(primary) ? `\nConversation so far (newest first):\n${conv(primary)}` : "\nConversation so far: (none in the sheet)",
    ...others.map((o) => `\nAlso listed in the sheet as ${o.leadId} (${o.name}, "${o.status}")${conv(o) ? `: ${conv(o)}` : "."}`),
  ];

  return {
    leadId: primary.leadId,
    alsoListedAs: others.map((o) => o.leadId),
    phone: normalizePhone(primary.phone),
    ownerName: primary.name.trim(),
    email: primary.email?.trim() || null,
    owner,
    status: rule.status,
    disqualifyReason: rule.reason,
    outcome: rule.outcome,
    reached: rule.reached,
    hot: rule.hot,
    nextFollowupAt,
    followUpMoved,
    meeting,
    propertyType: mapPropertyType(primary.venueType),
    propertyStage: mapPropertyStage(primary.venueStage),
    venue: primary.venue?.trim() || null,
    note: lines.filter((l) => l != null).join("\n"),
  };
}

/** Group the sheet by phone number, in sheet order. */
export function groupByPhone(rows: SheetRow[]): SheetRow[][] {
  const groups = new Map<string, SheetRow[]>();
  for (const r of rows) {
    const k = normalizePhone(r.phone);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()];
}
