import { normalizeOtpPhone } from "@/lib/otp";

// ============================================================
// Phone numbers a host types into the customer app — ONE rule.
//
// Normalised with normalizeOtpPhone, the function WhatsApp sign-in uses, so a
// number a host types for a co-host is byte-for-byte the number that person
// later verifies with (BookingCollaborator.phone is stored in exactly that
// form, and activation matches on it).
//
// Guests are stored as "+<country><number>" — the app's canonical display
// form. The team's guest list prints it as-is and the WhatsApp sender accepts
// it, so the host and the team read one value.
//
// SERVER-ONLY: otp.ts imports prisma. Client components receive phones already
// checked and formatted by the actions.
// ============================================================

export type PhoneCheck =
  | { kind: "EMPTY" }
  | { kind: "VALID"; digits: string }
  | { kind: "INVALID"; error: string };

export const PHONE_INVALID_MESSAGE = "Enter a 10-digit mobile number, or the full number with its country code.";

// Contacts apps paste direction marks and zero-width characters around numbers.
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;
const ALLOWED = /^[\d\s()+.-]+$/;

function toDigits(raw: string): string {
  let digits = raw.replace(INVISIBLE, "").replace(/\D/g, "");
  // "0091 98765 43210" is how +91 is dialled from a landline.
  if (digits.startsWith("00")) digits = digits.slice(2);
  return normalizeOtpPhone(digits);
}

/**
 * Validate and normalise an optional phone number.
 *  - EMPTY: nothing typed (the phone is optional for guests)
 *  - VALID: `digits` is normalizeOtpPhone's form, e.g. "919876543210"
 *  - INVALID: a message to show next to the field
 */
export function checkPhone(raw: string | null | undefined): PhoneCheck {
  const input = (raw ?? "").replace(INVISIBLE, "").trim();
  if (!input) return { kind: "EMPTY" };
  const invalid = { kind: "INVALID", error: PHONE_INVALID_MESSAGE } as const;
  if (!ALLOWED.test(input)) return invalid;
  const digits = toDigits(input);
  // Country code + number: 11–15 digits (E.164), never starting with 0.
  if (!/^[1-9]\d{10,14}$/.test(digits)) return invalid;
  // India: exactly ten digits after 91, and a mobile starts with 6–9.
  if (digits.startsWith("91") && !/^91[6-9]\d{9}$/.test(digits)) return invalid;
  return { kind: "VALID", digits };
}

/** Guest.phone form: "+919876543210". */
export function guestPhoneForStorage(digits: string): string {
  return `+${digits}`;
}

/** BookingCollaborator.phone form: normalizeOtpPhone's "919876543210". */
export function collaboratorPhoneForStorage(digits: string): string {
  return digits;
}

/**
 * The comparable form of a number however it was typed or stored ("+91 98765 43210",
 * "09876543210", "919876543210" all give "919876543210"); null when it is too short to be anyone's.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = toDigits(raw);
  return digits.length >= 11 ? digits : null;
}

/** The same number however each side was stored ("+91 98765 43210", "09876543210", "919876543210"). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = phoneKey(a);
  return x !== null && x === phoneKey(b);
}

/**
 * Guest-import rows split by the one-number-one-guest rule (hostAddGuest's): a row
 * whose number is already on the list, or came earlier in the same import, is a
 * duplicate. Rows without a number are always kept.
 */
export function splitDuplicatePhones<T extends { phone?: string | null }>(
  rows: readonly T[],
  existingPhones: readonly (string | null | undefined)[]
): { keep: T[]; duplicates: T[] } {
  const seen = new Set<string>();
  for (const p of existingPhones) {
    const key = phoneKey(p);
    if (key) seen.add(key);
  }
  const keep: T[] = [];
  const duplicates: T[] = [];
  for (const row of rows) {
    const key = phoneKey(row.phone);
    if (key && seen.has(key)) {
      duplicates.push(row);
      continue;
    }
    if (key) seen.add(key);
    keep.push(row);
  }
  return { keep, duplicates };
}

/** "+91 98765 43210" for Indian mobiles; "+<digits>" for other full international numbers; otherwise as stored. */
export function displayPhone(stored: string | null | undefined): string | null {
  const trimmed = (stored ?? "").replace(INVISIBLE, "").trim();
  if (!trimmed) return null;
  const digits = toDigits(trimmed);
  if (/^91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (/^[1-9]\d{10,14}$/.test(digits) && /^(\+|00)/.test(trimmed)) return `+${digits}`;
  return trimmed;
}
