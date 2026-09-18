// ============================================================
// One-time passcode (OTP) core — passwordless WhatsApp sign-in.
// Plain library (no "use server"): used by the request action, the NextAuth
// "otp" credentials provider (auth.ts) and the team's customer-access actions.
// A plaintext code never leaves the server except inside the WhatsApp message.
//
// Who gets a code, and what a verified code signs in to, is decided by ONE pure
// function — decideOtpLogin, unit-tested in otp.test.ts:
//   1. the number belongs to exactly one active User → that login, role kept;
//   2. no User has it, and exactly ONE non-deleted Contact whose phone or
//      alternate phone IS that number has done business with us (booking,
//      lead, quotation, invoice, contract or an enquiry status) → a new CLIENT
//      login, linked to that contact (CustomerLink, method PHONE);
//   3. no User has it, and a host invited it to a live booking
//      (BookingCollaborator INVITED/ACTIVE) → a new CLIENT login that sees
//      those bookings only.
// Several contacts on the number, or a switched-off login → no sign-in; the
// person who has just proved the number is told to contact the venue.
//
// SECURITY: a code proves control of ONE WhatsApp number. Everything a session
// can reach afterwards comes from records that already carry that exact
// number, compared country-aware ("+1 415 555 2671" never matches
// "4155552671").
// ============================================================

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { CredentialsSignin } from "next-auth";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/hr/geo";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { logActivity } from "@/lib/activity-logger";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5; // tries per code
const LOGIN_PURPOSE = "LOGIN";
/** A code whose WhatsApp send failed: retired, and not counted towards the daily cap. */
const UNSENT_PURPOSE = "LOGIN_UNSENT";
/** Minimum gap between two codes for one number (DB-level, survives restarts). */
export const OTP_RESEND_SECONDS = 60;
/** Most codes one number can be sent in 24 hours (DB-level). */
const DAILY_CODE_CAP = 10;
/** Rows read per phone lookup. Reaching it means the number is widely shared. */
const PHONE_MATCH_LIMIT = 25;

// ============================================================
// Phone numbers
// ============================================================

/** Normalize any Indian/international input to digits incl. country code. */
export function normalizeOtpPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d; // bare 10-digit Indian mobile
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  return d;
}

/** A usable normalized number: country code + subscriber number, E.164 length. */
export function isValidOtpPhone(normalized: string): boolean {
  return /^\d{11,15}$/.test(normalized);
}

/** True when a stored phone, written in any format, is exactly this normalized number. */
export function isSameOtpPhone(stored: string | null | undefined, normalized: string): boolean {
  if (!stored || !normalized) return false;
  return normalizeOtpPhone(stored) === normalized;
}

/** Common stored formats for the same number, so we can match User.phone. */
export function phoneVariants(normalized: string): string[] {
  const last10 = normalized.slice(-10);
  return Array.from(
    new Set([
      normalized,
      `+${normalized}`,
      last10,
      `+91${last10}`,
      `91${last10}`,
      `0${last10}`,
    ])
  );
}

/** "91******3210" — recognisable in a server log, not diallable. */
export function maskPhone(normalized: string): string {
  if (normalized.length <= 6) return "******";
  return `${normalized.slice(0, 2)}${"*".repeat(normalized.length - 6)}${normalized.slice(-4)}`;
}

// ============================================================
// Rate limits (the shared in-memory helper) + client IP
// ============================================================

const OTP_RATE_LIMITS = {
  request: {
    ip: { maxRequests: 10, windowSeconds: 15 * 60 },
    number: { maxRequests: 3, windowSeconds: 5 * 60 },
  },
  verify: {
    ip: { maxRequests: 30, windowSeconds: 15 * 60 },
    number: { maxRequests: 10, windowSeconds: 15 * 60 },
  },
};

/**
 * Per-IP and per-number limits for code requests and code checks. A missing
 * IP skips only the IP bucket: unknown clients are never pooled under one key.
 * The same limits apply to every number, registered or not.
 */
export function otpRateLimit(
  kind: "request" | "verify",
  scope: "ip" | "number",
  key: string | null
): { success: boolean; resetIn: number } {
  if (!key) return { success: true, resetIn: 0 };
  const result = checkRateLimit(`otp-${kind}-${scope}:${key}`, OTP_RATE_LIMITS[kind][scope]);
  return { success: result.success, resetIn: result.resetIn };
}

/**
 * Client IP from request headers, or null. X-Forwarded-For is read from the
 * proxy end (clientIpFromHeaders in src/lib/hr/geo.ts): its first entry is
 * whatever the client sent, so it must never key these limits.
 */
export function clientIpOf(
  headers: { get(name: string): string | null } | null | undefined
): string | null {
  if (!headers) return null;
  return clientIpFromHeaders(headers.get("x-forwarded-for"), headers.get("x-real-ip")) || null;
}

// ============================================================
// Sign-in errors
// ------------------------------------------------------------
// Thrown from the "otp" provider's authorize (auth.ts). NextAuth puts `code` in
// the callback URL and next-auth/react's signIn() returns it, so the screen can
// explain. All but RATE_LIMITED are thrown only AFTER a valid code, so they tell
// nothing to someone who doesn't hold the phone. RATE_LIMITED depends only on
// attempt counts. The customer welcome screen mirrors these strings.
// ============================================================

export const OTP_SIGNIN_ERROR = {
  SHARED_NUMBER: "otp_shared_number",
  LOGIN_DISABLED: "otp_login_disabled",
  NO_RECORD: "otp_no_record",
  RATE_LIMITED: "otp_rate_limited",
  TRY_AGAIN: "otp_try_again",
} as const;

export class OtpSharedNumberError extends CredentialsSignin {
  code: string = OTP_SIGNIN_ERROR.SHARED_NUMBER;
}
export class OtpLoginDisabledError extends CredentialsSignin {
  code: string = OTP_SIGNIN_ERROR.LOGIN_DISABLED;
}
export class OtpNoRecordError extends CredentialsSignin {
  code: string = OTP_SIGNIN_ERROR.NO_RECORD;
}
export class OtpRateLimitedError extends CredentialsSignin {
  code: string = OTP_SIGNIN_ERROR.RATE_LIMITED;
}
export class OtpTryAgainError extends CredentialsSignin {
  code: string = OTP_SIGNIN_ERROR.TRY_AGAIN;
}

// ============================================================
// Pure decisions (unit-tested)
// ============================================================

export type OtpUserFact = { id: string; role: string; isActive: boolean };
export type OtpContactFact = { id: string; hasActivity: boolean };
export type OtpCollaboratorFact = {
  id: string;
  bookingId: string;
  status: string;
  role: string;
  userId: string | null;
  name: string | null;
  /** The booking exists and is not CANCELLED. */
  bookingLive: boolean;
};

/** Everything on our records that carries one normalized number. */
export interface OtpFacts {
  /** Logins whose phone is this number (active or not). */
  users: OtpUserFact[];
  /** Non-deleted contacts whose phone or alternate phone is this number. */
  contacts: OtpContactFact[];
  /** INVITED / ACTIVE collaborator rows for this number. */
  collaborators: OtpCollaboratorFact[];
  /** The user lookup hit its row cap. */
  usersTruncated?: boolean;
  /** The contact lookup hit its row cap. */
  contactsTruncated?: boolean;
}

export type OtpRefusal = "NO_RECORD" | "SHARED_NUMBER" | "LOGIN_DISABLED";

export type OtpDecision =
  | { kind: "EXISTING_USER"; userId: string; linkContactId: string | null; collaboratorIds: string[] }
  | { kind: "NEW_CUSTOMER"; linkContactId: string | null; collaboratorIds: string[] }
  | { kind: "REFUSE"; reason: OtpRefusal };

const CUSTOMER_ROLES = new Set(["CLIENT", "VENDOR"]);

/** External logins (customers, vendors). Every other role is a team login. */
export function isCustomerRole(role: string | null | undefined): boolean {
  return !!role && CUSTOMER_ROLES.has(role);
}

export interface ContactActivity {
  bookings: number;
  /** Non-deleted leads. */
  leads: number;
  quotes: number;
  salesQuotations: number;
  invoices: number;
  contracts: number;
  enquiryStatus: string | null;
}

/**
 * Has this contact done business with us? A booking (a public date hold creates
 * one), a live lead (every captured enquiry creates one), a quotation, invoice
 * or contract, or an enquiry status the team set. Deliberately NOT
 * enquirySource: that is attribution, stamped and backfilled onto contacts
 * automatically, so it says nothing about the person.
 */
export function contactHasActivity(a: ContactActivity): boolean {
  return (
    a.bookings + a.leads + a.quotes + a.salesQuotations + a.invoices + a.contracts > 0 ||
    !!a.enquiryStatus
  );
}

/** Invites a login may take up: open, on a live booking, not bound to another login. */
function openInvites(rows: OtpCollaboratorFact[], userId: string | null): string[] {
  return rows
    .filter(
      (r) =>
        (r.status === "INVITED" || r.status === "ACTIVE") &&
        r.bookingLive &&
        (r.userId === null || r.userId === userId)
    )
    .map((r) => r.id);
}

export function decideOtpLogin(facts: OtpFacts): OtpDecision {
  const active = facts.users.filter((u) => u.isActive);
  const qualifying = facts.contacts.filter((c) => c.hasActivity);
  const contactsShared = !!facts.contactsTruncated || qualifying.length > 1;
  const singleContactId = !contactsShared && qualifying.length === 1 ? qualifying[0].id : null;

  // Two live logins on one number: we can't tell whose session this is.
  if (facts.usersTruncated || active.length > 1) return { kind: "REFUSE", reason: "SHARED_NUMBER" };

  if (active.length === 1) {
    const user = active[0];
    return {
      kind: "EXISTING_USER",
      userId: user.id,
      // Team logins never pick up a customer's contact by phone: a staff
      // member's own number typed onto a lead must not turn their host view
      // into that customer's. The team can link one deliberately (STAFF).
      linkContactId: isCustomerRole(user.role) ? singleContactId : null,
      collaboratorIds: openInvites(facts.collaborators, user.id),
    };
  }

  // Only switched-off logins hold this number: never mint a replacement.
  if (facts.users.length > 0) return { kind: "REFUSE", reason: "LOGIN_DISABLED" };

  const collaboratorIds = openInvites(facts.collaborators, null);
  if (singleContactId || collaboratorIds.length > 0) {
    return { kind: "NEW_CUSTOMER", linkContactId: singleContactId, collaboratorIds };
  }
  if (contactsShared) return { kind: "REFUSE", reason: "SHARED_NUMBER" };
  return { kind: "REFUSE", reason: "NO_RECORD" };
}

/**
 * Send a code whenever verifying it leads somewhere the person needs to know:
 * a sign-in, or a "contact the venue" about records that carry their number.
 * Numbers we hold nothing for get nothing.
 */
export function shouldSendLoginCode(decision: OtpDecision): boolean {
  return decision.kind !== "REFUSE" || decision.reason !== "NO_RECORD";
}

export interface CollaboratorActivationPlan {
  /** INVITED → ACTIVE, bound to the login, accepted now. */
  activateIds: string[];
  /** Already ACTIVE but bound to no login yet → bind. */
  bindIds: string[];
}

export function planCollaboratorActivation(
  rows: Pick<OtpCollaboratorFact, "id" | "status" | "userId" | "bookingLive">[],
  userId: string
): CollaboratorActivationPlan {
  const plan: CollaboratorActivationPlan = { activateIds: [], bindIds: [] };
  for (const r of rows) {
    if (!r.bookingLive) continue;
    if (r.userId !== null && r.userId !== userId) continue; // another login's seat
    if (r.status === "INVITED") plan.activateIds.push(r.id);
    else if (r.status === "ACTIVE" && r.userId === null) plan.bindIds.push(r.id);
  }
  return plan;
}

/** Reserved TLD (RFC 2606): nothing is ever delivered there, and email.ts refuses it. */
const PLACEHOLDER_EMAIL_DOMAIN = "customer.invalid";

/** Login email for a WhatsApp-only customer: wa-<digits>@customer.invalid. */
export function placeholderLoginEmail(normalized: string, suffix?: string): string {
  return `wa-${normalized}${suffix ? `-${suffix}` : ""}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Addresses that reach nobody: reserved ".invalid" ones and the storefront's "@noemail.veloria" filler. */
export function isUndeliverableEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return !e || e.endsWith(".invalid") || e.endsWith("@noemail.veloria");
}

/** A contact's email when it is a real, well-formed address; otherwise null. */
export function usableContactEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (isUndeliverableEmail(e) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export type StaffGrantDecision =
  | { kind: "LINK_EXISTING"; userId: string }
  | { kind: "CREATE_LOGIN" }
  | { kind: "REFUSE"; error: string };

/** "Give access by phone" from the team side (CustomerLink method STAFF). */
export function decideStaffGrant(users: OtpUserFact[], truncated = false): StaffGrantDecision {
  const active = users.filter((u) => u.isActive);
  if (truncated || active.length > 1) {
    return {
      kind: "REFUSE",
      error: "More than one login uses this number. Sort out the duplicate logins first, then try again.",
    };
  }
  if (active.length === 1) {
    if (!isCustomerRole(active[0].role)) {
      return {
        kind: "REFUSE",
        error: "This number belongs to a team member's login. Customer access can only go to a customer login.",
      };
    }
    return { kind: "LINK_EXISTING", userId: active[0].id };
  }
  if (users.length > 0) {
    return {
      kind: "REFUSE",
      error: "This number belongs to a login that has been switched off. Turn that login back on, or use a different number.",
    };
  }
  return { kind: "CREATE_LOGIN" };
}

/** ActivityLog actions for customer access. */
export const CUSTOMER_ACCESS_ACTIVITY = {
  /** A team member gave access (Contact; CustomerLink method STAFF). */
  GRANTED: "customer_access_granted",
  /** A team member removed access (Contact). Blocks automatic re-linking by phone until granted again. */
  REMOVED: "customer_access_removed",
  /** The customer proved the contact's phone with a WhatsApp code (Contact; method PHONE). */
  LINKED: "customer_access_linked",
  /** An invited collaborator signed in and joined the booking (Booking). */
  COLLABORATOR_JOINED: "collaborator_joined",
} as const;

// ============================================================
// Codes
// ============================================================

function hashCode(code: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Cryptographically-uniform 6-digit code (000000–999999). */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Create a fresh login code for a phone. Invalidates prior unconsumed codes.
 * Returns the PLAINTEXT code so the caller can send it over WhatsApp.
 * (The caller must never return this to the browser.) Prefer issueLoginCode,
 * which also checks eligibility, the resend gap and the daily cap.
 */
export async function createLoginOtp(normalized: string): Promise<string> {
  await prisma.otpCode.updateMany({
    where: { phone: normalized, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      phone: normalized,
      codeHash: hashCode(code),
      purpose: LOGIN_PURPOSE,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Verify a submitted code for a phone. Single-use, time-boxed, attempt-capped.
 * Returns true only on an exact, unexpired, unconsumed match. Each try reserves
 * an attempt atomically and success consumes atomically, so parallel requests
 * can neither exceed the cap nor use one code twice.
 */
export async function verifyLoginOtp(normalized: string, code: string): Promise<boolean> {
  if (!normalized || !/^\d{6}$/.test(code)) return false;

  const row = await prisma.otpCode.findFirst({
    where: {
      phone: normalized,
      purpose: LOGIN_PURPOSE,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true },
  });
  if (!row) return false;

  const reserved = await prisma.otpCode.updateMany({
    where: { id: row.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved.count !== 1) {
    await prisma.otpCode.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: new Date() }, // out of tries: lock it
    });
    return false;
  }

  if (!sameHash(row.codeHash, hashCode(code))) return false;

  const consumed = await prisma.otpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return consumed.count === 1;
}

// ============================================================
// Database lookups
// ============================================================

type Db = Prisma.TransactionClient;

/** Free-text phone columns matched digit-normalised: User/Contact phones and PublicHold.customerPhone. */
export type PhoneKeyColumn = "phone" | "alternatePhone" | "customerPhone";

/**
 * SQL twin of normalizeOtpPhone() for one column of the table being queried.
 * Constant SQL only: the column comes from the fixed list above, never from input.
 */
export function phoneKeySql(column: PhoneKeyColumn): Prisma.Sql {
  const digits = `regexp_replace(coalesce("${column}", ''), '[^0-9]', '', 'g')`;
  return Prisma.raw(
    `(CASE WHEN length(${digits}) = 10 THEN '91' || ${digits} ` +
      `WHEN length(${digits}) = 11 AND left(${digits}, 1) = '0' THEN '91' || right(${digits}, 10) ` +
      `ELSE ${digits} END)`
  );
}

const MATCH_LIMIT_SQL = Prisma.raw(String(PHONE_MATCH_LIMIT));

/**
 * Logins whose stored phone, in any format, is this number (active or not).
 * Stored phones are free text ("98765 43210", "+91-98765-43210"), so matching
 * is digit-normalized in SQL and re-checked in JS.
 */
export async function loadPhoneUsers(
  db: Db,
  normalized: string
): Promise<{ users: OtpUserFact[]; truncated: boolean }> {
  const ids = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User"
    WHERE "phone" IS NOT NULL AND ${phoneKeySql("phone")} = ${normalized}
    LIMIT ${MATCH_LIMIT_SQL}`;
  if (ids.length === 0) return { users: [], truncated: false };
  const rows = await db.user.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    select: { id: true, role: true, isActive: true, phone: true },
  });
  return {
    users: rows
      .filter((u) => isSameOtpPhone(u.phone, normalized))
      .map((u) => ({ id: u.id, role: u.role, isActive: u.isActive })),
    truncated: ids.length >= PHONE_MATCH_LIMIT,
  };
}

async function loadPhoneContacts(
  db: Db,
  normalized: string
): Promise<{ contacts: OtpContactFact[]; truncated: boolean }> {
  const ids = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Contact"
    WHERE "deletedAt" IS NULL
      AND (${phoneKeySql("phone")} = ${normalized} OR ${phoneKeySql("alternatePhone")} = ${normalized})
    LIMIT ${MATCH_LIMIT_SQL}`;
  if (ids.length === 0) return { contacts: [], truncated: false };
  const rows = await db.contact.findMany({
    where: { id: { in: ids.map((r) => r.id) }, deletedAt: null },
    select: {
      id: true,
      phone: true,
      alternatePhone: true,
      enquiryStatus: true,
      _count: {
        select: {
          bookings: true,
          quotes: true,
          salesQuotations: true,
          invoices: true,
          contracts: true,
          leads: { where: { deletedAt: null } },
        },
      },
    },
  });
  return {
    contacts: rows
      .filter((c) => isSameOtpPhone(c.phone, normalized) || isSameOtpPhone(c.alternatePhone, normalized))
      .map((c) => ({
        id: c.id,
        hasActivity: contactHasActivity({ ...c._count, enquiryStatus: c.enquiryStatus }),
      })),
    truncated: ids.length >= PHONE_MATCH_LIMIT,
  };
}

async function loadPhoneCollaborators(db: Db, normalized: string): Promise<OtpCollaboratorFact[]> {
  const rows = await db.bookingCollaborator.findMany({
    // Stored in normalizeOtpPhone() form by contract.
    where: { phone: normalized, status: { in: ["INVITED", "ACTIVE"] } },
    select: { id: true, bookingId: true, status: true, role: true, userId: true, name: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (rows.length === 0) return [];
  const live = await db.booking.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.bookingId))] }, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  const liveIds = new Set(live.map((b) => b.id));
  return rows.map((r) => ({ ...r, bookingLive: liveIds.has(r.bookingId) }));
}

export async function loadOtpFacts(db: Db, normalized: string): Promise<OtpFacts> {
  // Sequential: the same client may be an interactive transaction.
  const users = await loadPhoneUsers(db, normalized);
  const contacts = await loadPhoneContacts(db, normalized);
  const collaborators = await loadPhoneCollaborators(db, normalized);
  return {
    users: users.users,
    usersTruncated: users.truncated,
    contacts: contacts.contacts,
    contactsTruncated: contacts.truncated,
    collaborators,
  };
}

/**
 * Find THE active login whose stored phone is this number. If more than one
 * active account shares the phone the match is ambiguous: refuse rather than
 * non-deterministically sign the requester into someone else's account.
 */
export async function findActiveUserByPhone(normalized: string) {
  if (!isValidOtpPhone(normalized)) return null;
  const { users, truncated } = await loadPhoneUsers(prisma, normalized);
  const active = users.filter((u) => u.isActive);
  if (truncated || active.length !== 1) return null; // none, or ambiguous
  return prisma.user.findUnique({
    where: { id: active[0].id },
    select: { id: true, name: true, email: true, image: true, role: true },
  });
}

/** Serialize find-or-create for one number: sign-in and "Give access by phone" share this lock. */
export async function lockPhoneForLogin(tx: Db, normalized: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp-login:${normalized}`}))`;
}

// ============================================================
// Issuing a code
// ============================================================

async function sendLoginCodeMessage(
  normalized: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  let template: { name: string; language: string } | null = null;
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { otpTemplateName: true, otpTemplateLanguage: true },
    });
    const name = config?.otpTemplateName?.trim();
    if (name) template = { name, language: config?.otpTemplateLanguage?.trim() || "en" };
  } catch (error) {
    console.error("[otp] couldn't read the sign-in template setting", error);
  }

  if (template) {
    // An approved template is delivered outside WhatsApp's 24-hour window.
    // `language` rides along for sendWhatsApp's template path.
    const templateMessage: Parameters<typeof sendWhatsApp>[0] = {
      to: normalized,
      template: template.name,
      params: { code },
      language: template.language,
      // Meta authentication templates also need the code on their copy-code button.
      codeButton: code,
    };
    const sent = await sendWhatsApp(templateMessage);
    if (sent.success) return sent;
    console.error(
      `[otp] template "${template.name}" failed, trying plain text · ${maskPhone(normalized)}`,
      sent.error
    );
  }

  return sendWhatsApp({
    to: normalized,
    message: `Your Veloria Grand sign-in code is ${code}. It expires in 5 minutes. Never share this code with anyone.`,
  });
}

export type IssueCodeOutcome = "SENT" | "NOT_ELIGIBLE" | "TOO_SOON" | "DAILY_CAP" | "SEND_FAILED";

/**
 * Send a sign-in code if, and only if, the number may use one. Called after
 * the request action has already answered, so the outcome never reaches the
 * browser.
 */
export async function issueLoginCode(normalized: string): Promise<IssueCodeOutcome> {
  if (!isValidOtpPhone(normalized)) return "NOT_ELIGIBLE";
  const decision = decideOtpLogin(await loadOtpFacts(prisma, normalized));
  if (!shouldSendLoginCode(decision)) return "NOT_ELIGIBLE";

  const issued = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp-issue:${normalized}`}))`;
    const now = Date.now();
    const recent = await tx.otpCode.findFirst({
      where: {
        phone: normalized,
        purpose: LOGIN_PURPOSE,
        consumedAt: null,
        createdAt: { gt: new Date(now - OTP_RESEND_SECONDS * 1000) },
      },
      select: { id: true },
    });
    if (recent) return "TOO_SOON" as const;
    const sentToday = await tx.otpCode.count({
      where: { phone: normalized, purpose: LOGIN_PURPOSE, createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) } },
    });
    if (sentToday >= DAILY_CODE_CAP) return "DAILY_CAP" as const;
    // Only the newest code works.
    await tx.otpCode.updateMany({
      where: { phone: normalized, consumedAt: null },
      data: { consumedAt: new Date(now) },
    });
    const code = generateCode();
    const row = await tx.otpCode.create({
      data: {
        phone: normalized,
        codeHash: hashCode(code),
        purpose: LOGIN_PURPOSE,
        expiresAt: new Date(now + CODE_TTL_MS),
      },
      select: { id: true },
    });
    return { code, id: row.id };
  });
  if (typeof issued === "string") return issued;

  const sent = await sendLoginCodeMessage(normalized, issued.code);
  if (!sent.success) {
    // Nobody received it: retire it, and don't let a provider outage eat the daily cap.
    await prisma.otpCode.updateMany({
      where: { id: issued.id, consumedAt: null },
      data: { consumedAt: new Date(), purpose: UNSENT_PURPOSE },
    });
    console.error(`[otp] WhatsApp send failed · ${maskPhone(normalized)}`, sent.error);
    return "SEND_FAILED";
  }
  return "SENT";
}

// ============================================================
// Completing a sign-in
// ============================================================

export type OtpLogin = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
};

export type OtpLoginResult =
  | { ok: true; user: OtpLogin; created: boolean }
  | { ok: false; reason: OtpRefusal };

const LOGIN_SELECT = { id: true, name: true, email: true, image: true, role: true } as const;

type PendingActivity = Parameters<typeof logActivity>[0];

function contactDisplayName(c: { firstName: string | null; lastName: string | null }): string | null {
  const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.replace(/\s+/g, " ").trim();
  return name || null;
}

/**
 * Create a CLIENT login for a number: no password, and always the
 * non-deliverable placeholder email (wa-<digits>@customer.invalid), never the
 * contact's email. A contact's email is only what someone typed (a public hold
 * takes any email next to any phone) and User.email is unique, so copying it
 * would let whoever holds the phone reserve a stranger's address: its owner
 * could then not sign up, activate a host invite, use /portal/activate or sign
 * in with Google. The customer adds their own address from the account screen.
 * Callers hold lockPhoneForLogin, so two requests can't mint two logins for one
 * number.
 */
export async function createCustomerLogin(
  tx: Db,
  input: {
    normalized: string;
    name: string | null;
    phoneVerifiedAt: Date | null;
  }
): Promise<OtpLogin> {
  let email = placeholderLoginEmail(input.normalized);
  if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
    // An old login kept this placeholder after its phone was changed: stay unique.
    email = placeholderLoginEmail(input.normalized, randomBytes(3).toString("hex"));
  }
  return tx.user.create({
    data: {
      name: input.name,
      email,
      role: "CLIENT",
      phone: input.normalized,
      phoneVerifiedAt: input.phoneVerifiedAt,
      isActive: true,
    },
    select: LOGIN_SELECT,
  });
}

/** True when the latest team decision for (login, contact) was a removal. */
export async function accessRemovedByTeam(db: Db, userId: string, contactId: string): Promise<boolean> {
  const latest = await db.activityLog.findFirst({
    where: {
      entityType: "Contact",
      entityId: contactId,
      action: { in: [CUSTOMER_ACCESS_ACTIVITY.GRANTED, CUSTOMER_ACCESS_ACTIVITY.REMOVED] },
      changes: { path: ["customerUserId"], equals: userId },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  return latest?.action === CUSTOMER_ACCESS_ACTIVITY.REMOVED;
}

/**
 * After a verified code: find or create the login for this number, link the
 * matched contact and take up open collaborator invites — under a per-number
 * lock, in one transaction. Existing logins keep their role; new ones are
 * CLIENT. Nobody is ever upgraded.
 */
export async function completeOtpLogin(normalized: string): Promise<OtpLoginResult> {
  const activity: PendingActivity[] = [];
  const result = await prisma.$transaction(
    async (tx): Promise<OtpLoginResult> => {
      await lockPhoneForLogin(tx, normalized);
      const facts = await loadOtpFacts(tx, normalized);
      const decision = decideOtpLogin(facts);
      if (decision.kind === "REFUSE") return { ok: false, reason: decision.reason };

      const now = new Date();
      let user: OtpLogin;
      let created = false;
      if (decision.kind === "EXISTING_USER") {
        const current = await tx.user.findUniqueOrThrow({
          where: { id: decision.userId },
          select: { role: true, phone: true },
        });
        user = await tx.user.update({
          where: { id: decision.userId },
          data: {
            phoneVerifiedAt: now,
            // Customers get the canonical form; team members keep how it was typed.
            ...(isCustomerRole(current.role) && current.phone !== normalized ? { phone: normalized } : {}),
          },
          select: LOGIN_SELECT,
        });
      } else {
        const contact = decision.linkContactId
          ? await tx.contact.findUnique({
              where: { id: decision.linkContactId },
              select: { firstName: true, lastName: true },
            })
          : null;
        const invitedName =
          facts.collaborators
            .find((c) => decision.collaboratorIds.includes(c.id) && !!c.name?.trim())
            ?.name?.trim() ?? null;
        // The new login gets the placeholder email, never the contact's (createCustomerLogin).
        user = await createCustomerLogin(tx, {
          normalized,
          name: contact ? contactDisplayName(contact) : invitedName,
          phoneVerifiedAt: now,
        });
        created = true;
      }

      if (decision.linkContactId) {
        const contactId = decision.linkContactId;
        const existing = await tx.customerLink.findUnique({
          where: { userId_contactId: { userId: user.id, contactId } },
          select: { id: true },
        });
        // A team removal sticks: proving the number again doesn't undo it.
        const blocked = !existing && !created && (await accessRemovedByTeam(tx, user.id, contactId));
        if (!existing && !blocked) {
          await tx.customerLink.create({
            data: { userId: user.id, contactId, method: "PHONE", verifiedAt: now },
          });
          activity.push({
            userId: user.id,
            action: CUSTOMER_ACCESS_ACTIVITY.LINKED,
            entityType: "Contact",
            entityId: contactId,
            changes: { customerUserId: user.id, method: "PHONE", phone: normalized, newLogin: created },
          });
        }
      }

      const invites = facts.collaborators.filter((c) => decision.collaboratorIds.includes(c.id));
      const plan = planCollaboratorActivation(invites, user.id);
      if (plan.activateIds.length > 0) {
        await tx.bookingCollaborator.updateMany({
          where: { id: { in: plan.activateIds }, status: "INVITED", OR: [{ userId: null }, { userId: user.id }] },
          data: { status: "ACTIVE", userId: user.id, acceptedAt: now },
        });
      }
      if (plan.bindIds.length > 0) {
        await tx.bookingCollaborator.updateMany({
          where: { id: { in: plan.bindIds }, status: "ACTIVE", userId: null },
          data: { userId: user.id },
        });
        await tx.bookingCollaborator.updateMany({
          where: { id: { in: plan.bindIds }, acceptedAt: null },
          data: { acceptedAt: now },
        });
      }
      for (const c of invites) {
        if (!plan.activateIds.includes(c.id) && !plan.bindIds.includes(c.id)) continue;
        activity.push({
          userId: user.id,
          action: CUSTOMER_ACCESS_ACTIVITY.COLLABORATOR_JOINED,
          entityType: "Booking",
          entityId: c.bookingId,
          changes: { collaboratorId: c.id, role: c.role, phone: normalized },
        });
      }

      return { ok: true, user, created };
    },
    { maxWait: 5_000, timeout: 15_000 }
  );

  // Audit trail after commit; logActivity never throws.
  if (result.ok) for (const entry of activity) await logActivity(entry);
  return result;
}
