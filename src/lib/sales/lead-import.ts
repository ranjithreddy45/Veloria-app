// ============================================================
// Sales lead bulk-import — pure transforms (no server imports, safe on client
// and server). Maps the sales team's spreadsheet columns onto Lead/Contact
// fields, with resilient parsing of the messy real-world values (typo'd
// statuses, half-formed dates, phone numbers as floats, single-token names).
// ============================================================

// One row as parsed from the uploaded CSV (values are raw strings).
export interface RawLeadRow {
  leadName?: string;
  phone?: string;
  owner?: string;
  company?: string;
  email?: string;
  enquiryDate?: string;
  eventDate?: string;
  eventDetails?: string;
  attendees?: string;
  hall?: string;
  timeSlot?: string;
  diningType?: string;
  addOns?: string;
  quoteValue?: string;
  discount?: string;
  status?: string;
  tokenPayment?: string;
  remarks?: string;
}

// Header label (lower-cased, trimmed) -> RawLeadRow key. Tolerant of minor
// spelling/spacing differences in the sheet.
const HEADER_MAP: Record<string, keyof RawLeadRow> = {
  "lead name": "leadName",
  name: "leadName",
  "phone no.": "phone",
  "phone no": "phone",
  phone: "phone",
  "phone number": "phone",
  "lead owner": "owner",
  owner: "owner",
  company: "company",
  email: "email",
  "enquiry date": "enquiryDate",
  "event date": "eventDate",
  "event details": "eventDetails",
  "no of attendees": "attendees",
  attendees: "attendees",
  guests: "attendees",
  "hall required": "hall",
  hall: "hall",
  venue: "hall",
  "time slot": "timeSlot",
  slot: "timeSlot",
  "dining type": "diningType",
  dining: "diningType",
  "add ons": "addOns",
  addons: "addOns",
  "quote value": "quoteValue",
  value: "quoteValue",
  discount: "discount",
  status: "status",
  "token payment": "tokenPayment",
  token: "tokenPayment",
  remarks: "remarks",
  notes: "remarks",
};

// ------------------------------------------------------------
// CSV parsing (RFC-4180-ish: quoted fields, embedded commas/newlines/quotes).
// ------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // Flush trailing field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty rows.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Parse CSV text into header-mapped RawLeadRow objects (skips the header row). */
export function rowsFromCsv(text: string): RawLeadRow[] {
  const grid = parseCsv(text);
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const keys = headers.map((h) => HEADER_MAP[h]);
  const out: RawLeadRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const obj: RawLeadRow = {};
    let any = false;
    for (let c = 0; c < keys.length; c++) {
      const key = keys[c];
      if (!key) continue;
      const val = (cells[c] ?? "").trim();
      if (val) {
        obj[key] = val;
        any = true;
      }
    }
    if (any) out.push(obj);
  }
  return out;
}

// ------------------------------------------------------------
// Field mappers
// ------------------------------------------------------------

// LeadStatus enum target. Tolerant of the sheet's free-text + typos.
export function mapLeadStatus(raw?: string): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "NEW";
  if (s.startsWith("boo")) return "WON"; // "Booked" / "Boooked" (typo-tolerant)
  if (s.startsWith("won")) return "WON";
  if (s.startsWith("lost") || s.startsWith("dead")) return "LOST";
  if (s.startsWith("neg")) return "NEGOTIATION";
  if (s.startsWith("propos") || s.startsWith("quote")) return "PROPOSAL_SENT";
  if (s.startsWith("posit") || s.startsWith("hot") || s.startsWith("warm") || s.startsWith("qualif"))
    return "QUALIFIED";
  if (s.startsWith("contact") || s.startsWith("follow")) return "CONTACTED";
  return "NEW";
}

/** Phone as a clean string. Handles the "7666379810.0" float artefact. */
export function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (/^\d+\.0$/.test(v)) v = v.slice(0, -2); // strip trailing .0
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return v.startsWith("+") ? v : digits;
}

/** Split a single "Name" cell into first/last (lastName may be ""). */
export function splitName(raw?: string): { firstName: string; lastName: string } {
  const v = (raw ?? "").trim();
  if (!v) return { firstName: "Unknown", lastName: "" };
  const parts = v.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Number from a messy money/count string ("146853", "₹1,46,853", "30000.0"). */
export function toNumber(raw?: string): number | null {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a date that may be an ISO string, an Excel serial, dd/mm/yyyy,
 * dd-mm-yyyy, or half-formed ("19/072026"). Returns null when unparseable
 * rather than guessing wrong.
 */
export function parseFlexibleDate(raw?: string): Date | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;

  // ISO / native-parseable (covers "2026-08-28", "2026-08-28T00:00:00Z").
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // Excel serial number (days since 1899-12-30).
  if (/^\d{4,5}(\.\d+)?$/.test(v)) {
    const serial = parseFloat(v);
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  // dd/mm/yyyy or dd-mm-yyyy.
  let m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
    return isNaN(d.getTime()) ? null : d;
  }
  // Half-formed "19/072026" -> dd / mmyyyy.
  m = v.match(/^(\d{1,2})[/-](\d{2})(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(v);
  return isNaN(fallback.getTime()) ? null : fallback;
}
