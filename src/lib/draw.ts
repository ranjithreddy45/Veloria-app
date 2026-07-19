// ============================================================
// Guest Draw — shared, PURE helpers (no IO): event-type vocabulary,
// validation, phone masking, entry-code formatting, and a salted daily
// IP hash for abuse analysis. Used by the public API + staff routes.
// ============================================================

import { createHash } from "crypto";

/** The six event types. Enum value → guest-facing label (also the public-form
 *  option text, so the front-end can map option → value 1:1). */
export const DRAW_EVENT_TYPES = [
  { value: "milestone", label: "Birthday / Milestone" },
  { value: "naming_cradle", label: "Naming or Cradle Ceremony" },
  { value: "wedding_reception", label: "Wedding / Reception" },
  { value: "engagement", label: "Engagement" },
  { value: "corporate", label: "Corporate Event" },
  { value: "other", label: "Other Celebration" },
] as const;

export type DrawEventType = (typeof DRAW_EVENT_TYPES)[number]["value"];

const EVENT_VALUES = new Set(DRAW_EVENT_TYPES.map((e) => e.value));
export function isDrawEventType(v: unknown): v is DrawEventType {
  return typeof v === "string" && EVENT_VALUES.has(v as DrawEventType);
}
export function drawEventLabel(v: string): string {
  return DRAW_EVENT_TYPES.find((e) => e.value === v)?.label ?? v;
}

export const DRAW_SOURCES = new Set(["qr", "tablet", "manual"]);

export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Mask a 10-digit phone for display to staff-lite / public winner cards:
 *  "9845012345" → "98XXXX2345". */
export function maskPhone(p: string): string {
  const s = (p ?? "").replace(/\D/g, "");
  if (s.length !== 10) return "XXXXXXXXXX";
  return `${s.slice(0, 2)}XXXX${s.slice(6)}`;
}

/** VG-0047 from the row id (server-generated, monotonic, unique via the PK). */
export function formatEntryCode(id: number): string {
  return `VG-${String(id).padStart(4, "0")}`;
}

/** "2026-08" for a Date, in IST (draw months are Indian calendar months). */
export function drawMonthKey(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Validate a "YYYY-MM" draw-month key. */
export function isDrawMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** The UTC instant range [start, end) covering a "YYYY-MM" month in IST. */
export function drawMonthRange(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  const IST = 5.5 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(y, m - 1, 1) - IST); // 1st 00:00 IST
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - IST); // next 1st 00:00 IST
  return { start, end };
}

/**
 * Salted daily IP hash for abuse analysis — raw IP is NEVER stored. Salt is
 * per-day (rotates), so a hash can't be trivially reversed to an IP across
 * days. Requires DRAW_IP_SALT; without it we degrade to null (drop the signal)
 * rather than store a guessable value. Never throws.
 */
export function hashDrawIp(ip?: string | null, now: Date = new Date()): string | null {
  const cleanIp = (ip ?? "").trim();
  if (!cleanIp || cleanIp === "unknown") return null;
  const base = (process.env.DRAW_IP_SALT || process.env.AUTH_SECRET || "").trim();
  if (!base) return null;
  const day = drawMonthKey(now) + "-" + String(new Date(now.getTime() + 5.5 * 3600e3).getUTCDate());
  try {
    return createHash("sha256").update(`${base}:${day}:${cleanIp}`).digest("hex");
  } catch {
    return null;
  }
}

export interface DrawEntryInput {
  guest_name?: unknown;
  phone?: unknown;
  host_name?: unknown;
  event_type?: unknown;
  event_date?: unknown;
  consent_whatsapp?: unknown;
}

export type DrawValidation =
  | { ok: true; data: { guestName: string; phone: string; hostName: string; eventType: DrawEventType; eventDate: Date } }
  | { ok: false; field: string; error: string };

/** Server-side validation mirroring the front-end rules — never trust the client. */
export function validateDrawEntry(body: DrawEntryInput): DrawValidation {
  const guestName = String(body.guest_name ?? "").trim();
  if (!guestName) return { ok: false, field: "guest_name", error: "Please enter your name." };
  if (guestName.length > 120) return { ok: false, field: "guest_name", error: "Name is too long." };

  const phone = String(body.phone ?? "").trim();
  if (!INDIAN_MOBILE_RE.test(phone)) return { ok: false, field: "phone", error: "Enter a valid 10-digit mobile number." };

  const hostName = String(body.host_name ?? "").trim();
  if (!hostName) return { ok: false, field: "host_name", error: "Please tell us the host's name." };
  if (hostName.length > 120) return { ok: false, field: "host_name", error: "Host name is too long." };

  const eventType = body.event_type;
  if (!isDrawEventType(eventType)) return { ok: false, field: "event_type", error: "Please choose the event type." };

  const rawDate = String(body.event_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return { ok: false, field: "event_date", error: "Please pick the event date." };
  const eventDate = new Date(rawDate + "T00:00:00.000Z"); // @db.Date, UTC-midnight
  if (Number.isNaN(eventDate.getTime())) return { ok: false, field: "event_date", error: "Please pick a valid event date." };
  // Reject rollover (2026-02-31 → Mar) and absurd future dates.
  const [yy, mm, dd] = rawDate.split("-").map(Number);
  if (eventDate.getUTCFullYear() !== yy || eventDate.getUTCMonth() !== mm - 1 || eventDate.getUTCDate() !== dd) {
    return { ok: false, field: "event_date", error: "Please pick a valid event date." };
  }

  if (body.consent_whatsapp !== true) {
    return { ok: false, field: "consent_whatsapp", error: "Please tick the consent box to enter." };
  }

  return { ok: true, data: { guestName, phone, hostName, eventType, eventDate } };
}
