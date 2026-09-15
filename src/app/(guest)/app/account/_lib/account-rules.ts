import { z } from "zod";

// ============================================================
// Account rules for the customer app: the pure decisions behind
// guest-account.actions.ts, kept here so they can be tested without a
// database.
// ============================================================

const ASCII_PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/** Spaces collapsed, 2 to 120 characters, and at least one character that is not a digit or punctuation. */
export function normalizeDisplayName(raw: string): string | null {
  const printable = Array.from(String(raw ?? ""))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  const clean = printable.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 120) return null;
  const hasNameCharacter = Array.from(clean).some((ch) => !/[\d\s]/.test(ch) && !ASCII_PUNCTUATION.includes(ch));
  return hasNameCharacter ? clean : null;
}

/** "Priya Sharma" becomes Priya / Sharma. A single word leaves lastName empty (Contact.lastName is required but may be ""). */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export function fullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

export type ContactNameAction = "UPDATE" | "UNCHANGED" | "HOLD_FOR_TEAM";
export type ContactHoldReason = "ON_DOCUMENTS" | "COMPANY_RECORD";

export interface ContactNameInput {
  type: string;
  firstName: string;
  lastName: string | null;
  /** Invoices on this contact that are past DRAFT. */
  issuedInvoices: number;
  /** Contracts on this contact that are past DRAFT. */
  contracts: number;
}

export interface ContactNameDecision {
  action: ContactNameAction;
  reason: ContactHoldReason | null;
  firstName: string;
  lastName: string;
}

/**
 * What a customer's name change does to one of their Contact rows.
 *  - Same name: nothing, even if the team split it into first/last differently.
 *  - Company contacts are the company's record, not the person's: the team decides.
 *  - Invoices and contracts print the contact's name live, so once any exist a
 *    silent rename would rewrite an issued tax invoice: the team decides.
 *  - Otherwise the contact follows the customer, so the two never drift.
 */
export function decideContactName(contact: ContactNameInput, newFullName: string): ContactNameDecision {
  const next = splitFullName(newFullName);
  if (fullName(contact.firstName, contact.lastName) === fullName(next.firstName, next.lastName)) {
    return { action: "UNCHANGED", reason: null, ...next };
  }
  if (contact.type === "CORPORATE") return { action: "HOLD_FOR_TEAM", reason: "COMPANY_RECORD", ...next };
  if (contact.issuedInvoices > 0 || contact.contracts > 0) return { action: "HOLD_FOR_TEAM", reason: "ON_DOCUMENTS", ...next };
  return { action: "UPDATE", reason: null, ...next };
}

const emailSchema = z.string().trim().max(254).email();

export function normalizeEmail(raw: string): string | null {
  const result = emailSchema.safeParse(String(raw ?? ""));
  return result.success ? result.data.toLowerCase() : null;
}

/**
 * A requested email change is held as a VerificationToken row (the same table
 * portal invites use) until the address can be proven. The user id and the
 * requested address live in the identifier; User.email is never touched.
 */
export const EMAIL_CHANGE_PREFIX = "guest-email-change:";

export function emailChangeIdentifier(userId: string, email: string): string {
  return `${EMAIL_CHANGE_PREFIX}${userId}:${email}`;
}

/** The requested address, or null when the identifier belongs to someone else or is malformed. */
export function parseEmailChangeIdentifier(identifier: string, userId: string): string | null {
  const prefix = `${EMAIL_CHANGE_PREFIX}${userId}:`;
  if (!userId || !identifier.startsWith(prefix)) return null;
  return normalizeEmail(identifier.slice(prefix.length));
}

/** Privacy queue status, expressed in the shared customer-request vocabulary of status-labels.ts. */
export function privacyStatusForCustomer(status: string): "SUBMITTED" | "IN_PROGRESS" | "DONE" | "DECLINED" {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "DONE":
      return "DONE";
    case "REJECTED":
      return "DECLINED";
    default:
      return "SUBMITTED";
  }
}

export function isOpenPrivacyStatus(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

export interface DeletionDetailsInput {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  bookings: readonly { bookingNumber: string; date: string }[];
  note: string;
}

const DETAILS_MAX = 2000;

/** The "details" the privacy queue shows: facts that help the admin verify identity, then the customer's note. */
export function composeDeletionDetails(input: DeletionDetailsInput): string {
  const lines = ["Raised from the Veloria customer app while signed in."];
  if (input.email) lines.push(`Account email: ${input.email} (${input.emailVerified ? "verified" : "not verified"})`);
  if (input.phone) lines.push(`Account phone: ${input.phone} (${input.phoneVerified ? "verified by WhatsApp code" : "not verified"})`);
  if (input.bookings.length > 0) {
    const list = input.bookings
      .slice(0, 10)
      .map((b) => `${b.bookingNumber} (${b.date.slice(0, 10)})`)
      .join(", ");
    lines.push(`Linked bookings: ${list}`);
  }
  const head = lines.join("\n");
  const note = String(input.note ?? "").trim();
  if (!note) return head.slice(0, DETAILS_MAX);
  return `${head}\n\nCustomer's note: ${note}`.slice(0, DETAILS_MAX);
}
