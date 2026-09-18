// ============================================================
// Business contact rules — pure and client-safe.
//
// No Prisma and nothing server-only, so the team's settings form, the server
// actions that save it and the customer-facing contact buttons all apply the
// SAME rules. A value is either normalised or rejected with a message the team
// can act on; nothing is guessed or filled in.
// ============================================================

import { canonicalPhone } from "@/lib/phone";

export type RuleResult<T> = { ok: true; value: T } | { ok: false; error: string };
export type FieldErrors<F extends string> = Partial<Record<F, string>>;
export type Validated<F extends string> =
  | { ok: true; data: Record<F, string | null> }
  | { ok: false; errors: FieldErrors<F> };

function ok<T>(value: T): RuleResult<T> {
  return { ok: true, value };
}
function fail(error: string): RuleResult<never> {
  return { ok: false, error };
}

/** Strings pass through, null/undefined read as empty, anything else is invalid (never String(false)). */
function asText(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";
  return null;
}

// ------------------------------------------------------------
// Text
// ------------------------------------------------------------

/** One line of text: trimmed, inner whitespace collapsed. Empty → null. */
export function cleanLine(raw: unknown, max: number, label: string): RuleResult<string | null> {
  const text = asText(raw);
  if (text === null) return fail(`${label} is invalid.`);
  const v = text.replace(/\s+/g, " ").trim();
  if (!v) return ok(null);
  if (v.length > max) return fail(`${label} must be ${max} characters or fewer.`);
  return ok(v);
}

/** Multi-line text: line breaks kept, trailing spaces and runs of blank lines tidied. Empty → null. */
export function cleanText(raw: unknown, max: number, label: string): RuleResult<string | null> {
  const text = asText(raw);
  if (text === null) return fail(`${label} is invalid.`);
  const v = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!v) return ok(null);
  if (v.length > max) return fail(`${label} must be ${max} characters or fewer.`);
  return ok(v);
}

// ------------------------------------------------------------
// Phone and WhatsApp numbers (India)
// ------------------------------------------------------------

const PHONE_SHAPE = /^\+?[\d\s\-().]+$/;
/** 1800 / 1860 toll-free numbers: dialled as-is, never with +91. */
const TOLL_FREE = /^18[06]0\d{6,7}$/;
/** National significant number: 10 digits, never starting with the trunk 0. */
const NATIONAL = /^[1-9]\d{9}$/;

function indianNationalNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (input.startsWith("+")) {
    national = digits.slice(2); // caller has checked the 91
    if (national.length === 11 && national.startsWith("0")) national = national.slice(1); // "+91 (0) 80 …"
  } else if (digits.startsWith("0091")) {
    national = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }
  return NATIONAL.test(national) ? national : null;
}

/**
 * An Indian phone or WhatsApp number, stored as +91XXXXXXXXXX.
 * Accepts the shapes people type (98765 43210, 098765…, 91…, +91-…, (080) …).
 * Toll-free 1800/1860 numbers are allowed for calls, not for WhatsApp.
 */
export function normalizePhoneNumber(raw: unknown, kind: "phone" | "whatsapp" = "phone"): RuleResult<string | null> {
  const label = kind === "whatsapp" ? "WhatsApp number" : "Phone number";
  const text = asText(raw);
  if (text === null) return fail(`${label} is invalid.`);
  const input = text.trim();
  if (!input) return ok(null);
  if (!PHONE_SHAPE.test(input)) {
    return fail(`${label} can only contain digits, spaces, brackets, dashes and a leading +.`);
  }
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+") && !digits.startsWith("91")) {
    return fail(`${label} must be an Indian (+91) number.`);
  }
  if (!input.startsWith("+") && TOLL_FREE.test(digits)) {
    return kind === "phone"
      ? ok(digits)
      : fail("WhatsApp can't use a toll-free number. Enter the 10-digit number your WhatsApp account is on.");
  }
  const national = indianNationalNumber(input);
  if (!national) {
    return fail(`${label} must be a 10-digit Indian number, e.g. 98765 43210 or 080 1234 5678.`);
  }
  return ok(`+91${national}`);
}

/** "+91 98765 43210" for a stored number; toll-free as "1800 123 4567"; anything else unchanged. */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const canonical = canonicalPhone(value);
  const indian = /^\+91(\d{5})(\d{5})$/.exec(canonical);
  if (indian) return `+91 ${indian[1]} ${indian[2]}`;
  const digits = canonical.replace(/\D/g, "");
  if (TOLL_FREE.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return value.trim();
}

/** wa.me link. Uses the app-wide phone rule, so a bare 10-digit Indian mobile still gets its 91. */
export function waMeHref(number: string, text?: string): string {
  const digits = canonicalPhone(number).replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** tel: link, in the canonical dialable form. */
export function telLink(number: string): string {
  return `tel:${canonicalPhone(number).replace(/[^\d+]/g, "")}`;
}

// ------------------------------------------------------------
// Email and web links
// ------------------------------------------------------------

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function normalizeEmail(raw: unknown): RuleResult<string | null> {
  const text = asText(raw);
  if (text === null) return fail("Email is invalid.");
  const v = text.trim();
  if (!v) return ok(null);
  if (v.length > 254 || !EMAIL.test(v)) return fail("Enter a valid email address, e.g. name@example.com.");
  return ok(v.toLowerCase());
}

/**
 * A public web link (http/https only). A bare "maps.app.goo.gl/…" gets https://;
 * javascript:, data:, credentials in the URL and hostless values are refused.
 */
export function normalizeWebUrl(raw: unknown, label = "Link"): RuleResult<string | null> {
  const text = asText(raw);
  if (text === null) return fail(`${label} is invalid.`);
  const v = text.trim();
  if (!v) return ok(null);
  const bad = fail(`${label} must be a full web address starting with https://`);
  if (v.length > 2000 || /\s/.test(v)) return bad;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(v);
  if (hasScheme && !/^https?:\/\//i.test(v)) return bad;
  let url: URL;
  try {
    url = new URL(hasScheme ? v : `https://${v}`);
  } catch {
    return bad;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return bad;
  const host = url.hostname;
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || url.username || url.password) return bad;
  return ok(url.toString());
}

// ------------------------------------------------------------
// Field sets
// ------------------------------------------------------------

/** Gather per-field results into data or a field → message map. */
export function collectResults<F extends string>(results: Record<F, RuleResult<string | null>>): Validated<F> {
  const data = {} as Record<F, string | null>;
  const errors: FieldErrors<F> = {};
  for (const key of Object.keys(results) as F[]) {
    const r = results[key];
    if (r.ok) data[key] = r.value;
    else errors[key] = r.error;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

/** Before → after for the fields that actually changed (what ActivityLog records). */
export function diffFields<F extends string>(
  before: Partial<Record<F, string | null | undefined>> | null | undefined,
  after: Record<F, string | null>
): Partial<Record<F, { from: string | null; to: string | null }>> {
  const out: Partial<Record<F, { from: string | null; to: string | null }>> = {};
  for (const key of Object.keys(after) as F[]) {
    const from = before?.[key] ?? null;
    const to = after[key];
    if (from !== to) out[key] = { from, to };
  }
  return out;
}

export const BUSINESS_PROFILE_FIELDS = ["displayName", "phone", "whatsapp", "email", "address", "mapUrl", "supportHours"] as const;
export type BusinessProfileField = (typeof BUSINESS_PROFILE_FIELDS)[number];
export type BusinessProfileInput = Partial<Record<BusinessProfileField, string | null>>;
export type BusinessProfileData = Record<BusinessProfileField, string | null>;

/** Everything Settings → Business contact saves, validated and normalised in one pass. */
export function validateBusinessProfileInput(input: BusinessProfileInput | null | undefined): Validated<BusinessProfileField> {
  const i = input ?? {};
  return collectResults<BusinessProfileField>({
    displayName: cleanLine(i.displayName, 120, "Display name"),
    phone: normalizePhoneNumber(i.phone, "phone"),
    whatsapp: normalizePhoneNumber(i.whatsapp, "whatsapp"),
    email: normalizeEmail(i.email),
    address: cleanText(i.address, 500, "Address"),
    mapUrl: normalizeWebUrl(i.mapUrl, "Map link"),
    supportHours: cleanLine(i.supportHours, 120, "Support hours"),
  });
}
