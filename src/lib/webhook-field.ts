// ============================================================
// Reading one field out of an ad-platform lead payload.
//
// These payloads are untrusted and loosely typed: the same column arrives as a
// string on one delivery and a JSON number on the next, and Google sends
// `false` for a column the user left blank. Two bugs came out of that, in
// opposite directions, and this module exists so the fix lives in ONE place:
//
//   1. Coercing blindly with String(v) turned `false` into the text "false",
//      which was stored as a customer's phone number. Staff rang it.
//   2. Hardening to `typeof v === "string"` fixed that but threw away a phone
//      sent as a JSON *number* (9611360491, unquoted) — so the number went from
//      wrong to missing, which is just as useless to the person calling back.
//
// The rule that satisfies both: take strings and finite numbers, reject
// booleans and everything else, and treat placeholder text as absent.
// ============================================================

/**
 * Values that are technically strings but mean "nothing was filled in".
 * Stored verbatim they look like real data, which is worse than blank — a blank
 * field is obviously missing, "N/A" gets dialled.
 */
const PLACEHOLDER_VALUES = new Set([
  "false",
  "true",
  "null",
  "undefined",
  "nil",
  "none",
  "n/a",
  "na",
  "-",
  "--",
]);

/**
 * Coerce ONE candidate value to usable text, or null if it carries no content.
 *
 * Booleans are rejected outright rather than stringified: no lead form has ever
 * legitimately answered a name/email/phone question with a bare true or false,
 * so a boolean here always means "unfilled".
 */
export function usableValue(raw: unknown): string | null {
  if (typeof raw === "string") {
    const v = raw.trim();
    if (!v) return null;
    return PLACEHOLDER_VALUES.has(v.toLowerCase()) ? null : v;
  }
  // A phone or postcode sent unquoted. It must be a whole number within a
  // plausible magnitude: E.164 caps a phone at 15 digits, and beyond ~1e21
  // String() switches to exponent notation ("1e+21"), which would store
  // literal garbage. Number.isInteger alone does NOT catch that — 1e21 is an
  // integer — so the bound is checked explicitly.
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    if (Math.abs(raw) >= 1e16) return null;
    return String(raw);
  }
  return null; // boolean, null, undefined, object, array
}

/**
 * First usable value across the several key spellings these APIs use for the
 * same thing. Google alone sends `string_value` / `stringValue`, and flattened
 * integrations send a plain `value`.
 *
 * Every candidate is tried, so a column carrying `string_value: false` AND a
 * real `number_value` still yields the number — the earlier code stopped at the
 * first key that was merely *present*, and `false` is present.
 */
export function fieldValue(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): string {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const v = usableValue(source[key]);
    if (v) return v;
  }
  return "";
}

/** The key spellings a Google Ads lead-form column may carry its value under. */
export const LEAD_VALUE_KEYS = [
  "string_value",
  "stringValue",
  "number_value",
  "numberValue",
  "value",
] as const;

/**
 * First usable entry of an array-valued field (Facebook returns `values: [...]`,
 * and an unfilled field can be `[]`, `[null]` or `[false]`).
 */
export function firstUsable(values: unknown): string {
  if (!Array.isArray(values)) return usableValue(values) ?? "";
  for (const v of values) {
    const u = usableValue(v);
    if (u) return u;
  }
  return "";
}
