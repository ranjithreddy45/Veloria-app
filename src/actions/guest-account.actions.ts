"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHostScope, isStaffUser, staffCan, type HostBooking, type HostScope } from "@/lib/guest/host-scope";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { canonicalPhone } from "@/lib/phone";
import { isUndeliverableEmail, normalizeOtpPhone, phoneVariants } from "@/lib/otp";
import { generateUniqueCode, buildReferralLink } from "@/lib/referral-code";
import { buildPartnerLink } from "@/lib/referral-portal/partner-code";
import { bookingBalance } from "@/lib/finance/issued-invoices";
import { RETENTION_DEFAULTS } from "@/lib/privacy/policy";
import { submitPrivacyRequest } from "@/actions/privacy.actions";
import { requestFromConcierge } from "@/actions/guest-host.actions";
import { submitReview } from "@/actions/review.actions";
import {
  NOTIFICATION_PREFERENCES_ENFORCED,
  customerNotificationRows,
  isCustomerNotificationKey,
  serializeNotificationPreferences,
  type CustomerNotificationRow,
} from "@/app/(guest)/app/account/_lib/notification-preferences";
import {
  EMAIL_CHANGE_PREFIX,
  composeDeletionDetails,
  decideContactName,
  emailChangeIdentifier,
  fullName,
  isOpenPrivacyStatus,
  normalizeDisplayName,
  normalizeEmail,
  parseEmailChangeIdentifier,
} from "@/app/(guest)/app/account/_lib/account-rules";
import {
  decidePerks,
  signedPoints,
  tierProgress,
  validateRedemption,
  type PerkLine,
  type RedemptionBlock,
} from "@/app/(guest)/app/rewards/_lib/perks";
import {
  composeReview,
  pickBookingToRate,
  ratingBlockedMessage,
  ratingState,
  reviewState,
  type RatingState,
  type ReviewState,
} from "@/app/(guest)/app/rate/_lib/eligibility";

// ============================================================
// Customer app: the signed-in customer's account, rewards and rating.
//
// One source of truth. Everything here reads and writes the records the team
// already works from:
//   - account details: the customer's User row and their verified Contacts.
//     A name change is logged and noted on each contact; it is copied onto a
//     contact only when no issued invoice or contract prints the old name.
//   - an email change is held as unverified (a VerificationToken row) and never
//     replaces User.email, the key that links bookings once verified.
//   - money: finance's issued-invoice rule (lib/finance/issued-invoices).
//   - loyalty: LoyaltyAccount. Referrals: Referral rows, as the team's form
//     creates them. Referral perks: ReferralRewardRule rows and the customer's
//     own ReferralPartner link.
//   - using points: a CLIENT_REQUEST task via requestFromConcierge(); the
//     coordinator applies it on the loyalty account.
//   - reviews: submitReview(), moderated on /reviews.
//   - deleting data: submitPrivacyRequest(), worked in /settings/privacy.
//
// Identity comes from getHostScope(): verified contacts and customer links
// only, so an unverified email never widens what anyone can see. Bookings a
// login reaches only as an invited collaborator are the host's, not theirs:
// they are listed, but never used for points, referrals, ratings or data
// requests. Team members previewing the host view are read-only, and each
// section is gated on the permission the matching team screen checks (the
// same gates as guest-host.actions.ts).
// ============================================================

export type GuestResult<T> = { success: true; data: T } | { success: false; error: string };

const SIGN_IN = "Please sign in.";
const PREVIEW = "Staff preview: this would change a real customer's account. Sign in as that host (or the demo guest) to try it.";
const SLOW_DOWN = "That's a lot of changes in a short time. Please try again a little later.";
const VIA = "guest-app";
const PRIVACY_LINK_ACTION = "privacy_request_raised_in_app";
const EMAIL_CHANGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** getHostScope(), failing closed: a preview is only ever a team member's. */
async function accountScope(bookingId?: string): Promise<HostScope | null> {
  const s = await getHostScope(bookingId);
  if (!s) return null;
  if (s.preview && !isStaffUser(s.user)) return { ...s, contactIds: [], bookings: [], booking: null, collaboratorRoles: {} };
  return s;
}

/**
 * A customer sees their own data; a previewing team member sees only what their role opens in the team app,
 * by their effective permissions (staffCan), so a permission revoked in Settings → Roles hides it here too.
 */
function canSee(s: HostScope, permission: string): boolean {
  return !s.preview || staffCan(s.user, permission);
}

/** Run a read only when the viewer may see it; otherwise return the fallback without touching the database. */
function readIf<T>(allowed: boolean, read: () => Promise<T>, fallback: T): Promise<T> {
  return allowed ? read() : Promise.resolve(fallback);
}

function isShared(s: HostScope, bookingId: string): boolean {
  return !!s.collaboratorRoles?.[bookingId];
}

/** The customer's own bookings, not ones they reach only as an invited collaborator. */
function ownBookings(s: HostScope): HostBooking[] {
  return s.bookings.filter((b) => !isShared(s, b.id));
}

/** The booking account-level requests attach to: the scope's booking when it is their own, else their next own booking. */
function ownBooking(s: HostScope): HostBooking | null {
  if (s.booking && !isShared(s, s.booking.id)) return s.booking;
  return s.preview ? null : (ownBookings(s)[0] ?? null);
}

function tooMany(key: string, maxRequests: number, windowSeconds: number): boolean {
  return !checkRateLimit(`guest-account:${key}`, { maxRequests, windowSeconds }).success;
}

/** The loyalty account the team sees for this customer: the booking's contact first, else the one with most points earned. */
function pickLoyaltyAccount<T extends { contactId: string; totalEarned: number }>(rows: T[], preferContactId: string | null): T | null {
  if (rows.length === 0) return null;
  const preferred = preferContactId ? rows.find((r) => r.contactId === preferContactId) : undefined;
  return preferred ?? [...rows].sort((a, b) => b.totalEarned - a.totalEarned)[0];
}

/** A real address, or null for the placeholder a WhatsApp-only login carries. */
function deliverableEmail(email: string | null | undefined): string | null {
  return email && !isUndeliverableEmail(email) ? email : null;
}

async function venueNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.venue.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(rows.map((v) => [v.id, v.name]));
}

async function addContactNote(contactId: string, authorId: string, body: string): Promise<void> {
  try {
    await prisma.crmNote.create({ data: { contactId, authorId, kind: "NOTE", body } });
  } catch (error) {
    console.error("[GUEST_ACCOUNT_CONTACT_NOTE_ERROR]", error);
  }
}

// ------------------------------------------------------------ pending email change

export type PendingEmail = { address: string; requestedAt: string };

async function findPendingEmail(userId: string): Promise<PendingEmail | null> {
  const rows = await prisma.verificationToken.findMany({
    where: { identifier: { startsWith: `${EMAIL_CHANGE_PREFIX}${userId}:` } },
    select: { identifier: true, token: true, expires: true },
  });
  const now = Date.now();
  const expired = rows.filter((r) => r.expires.getTime() <= now);
  if (expired.length > 0) {
    await prisma.verificationToken.deleteMany({ where: { token: { in: expired.map((r) => r.token) } } });
  }
  const live = rows
    .filter((r) => r.expires.getTime() > now)
    .sort((a, b) => b.expires.getTime() - a.expires.getTime())[0];
  if (!live) return null;
  const address = parseEmailChangeIdentifier(live.identifier, userId);
  return address ? { address, requestedAt: new Date(live.expires.getTime() - EMAIL_CHANGE_TTL_MS).toISOString() } : null;
}

async function clearPendingEmail(userId: string): Promise<number> {
  const res = await prisma.verificationToken.deleteMany({
    where: { identifier: { startsWith: `${EMAIL_CHANGE_PREFIX}${userId}:` } },
  });
  return res.count;
}

// ------------------------------------------------------------ privacy requests

export interface GuestPrivacyRequest {
  id: string;
  kind: string;
  status: string;
  open: boolean;
  createdAt: string;
  handledAt: string | null;
}

type IdentityRow = { email: string; emailVerified: Date | null; phone: string | null; phoneVerifiedAt: Date | null };

/** Requests raised from this account, plus any raised on the public page with an identifier this account has proven. */
async function findOwnPrivacyRequests(userId: string, me: IdentityRow): Promise<GuestPrivacyRequest[]> {
  const links = await prisma.activityLog.findMany({
    where: { userId, entityType: "PrivacyRequest", action: PRIVACY_LINK_ACTION },
    select: { entityId: true },
    take: 50,
  });
  const or: Prisma.PrivacyRequestWhereInput[] = [];
  if (links.length > 0) or.push({ id: { in: links.map((l) => l.entityId) } });
  const email = deliverableEmail(me.email);
  if (email && me.emailVerified) or.push({ requesterEmail: { equals: email, mode: "insensitive" } });
  if (me.phone && me.phoneVerifiedAt) {
    const normalized = normalizeOtpPhone(me.phone);
    if (normalized.length >= 11) or.push({ requesterPhone: { in: phoneVariants(normalized) } });
  }
  if (or.length === 0) return [];
  const rows = await prisma.privacyRequest.findMany({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, kind: true, status: true, createdAt: true, handledAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    open: isOpenPrivacyStatus(r.status),
    createdAt: r.createdAt.toISOString(),
    handledAt: r.handledAt ? r.handledAt.toISOString() : null,
  }));
}

// ============================================================ account

export interface GuestAccountBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  date: string;
  status: string;
  venueName: string | null;
  /** CO_HOST or VIEWER when the booking is someone else's, shared with this login. */
  sharedRole: string | null;
}

export interface GuestAccountDetails {
  preview: boolean;
  /** The sign-in resolves to at least one of the customer's own contacts. */
  linked: boolean;
  name: string | null;
  /** null when the login only has a WhatsApp placeholder address. */
  email: string | null;
  emailVerified: boolean;
  pendingEmail: PendingEmail | null;
  /** Whether transactional email is configured at all (RESEND_API_KEY). */
  emailDeliveryConfigured: boolean;
  phone: string | null;
  phoneVerified: boolean;
  /** ACCOUNT: the number this sign-in uses. BOOKING: only on the booking's contact. */
  phoneSource: "ACCOUNT" | "BOOKING" | null;
  bookings: GuestAccountBooking[];
  loyalty: { points: number; tier: string } | null;
  /** Issued invoices across the customer's own contacts (finance's rule); null when not linked or hidden in preview. */
  payments: { invoicesIssued: number; balanceDue: number } | null;
  unreadNotifications: number;
  privacyRequests: GuestPrivacyRequest[];
  hasOpenDeletionRequest: boolean;
  retentionYears: number;
  notificationPreferences: CustomerNotificationRow[];
  notificationPreferencesEnforced: boolean;
}

export async function getGuestAccountDetails(): Promise<GuestAccountDetails | null> {
  const scope = await accountScope();
  if (!scope) return null;
  const { user, contactIds, preview } = scope;
  // In preview the scope holds every live booking; show only the one being previewed.
  const bookingRows = preview ? (scope.booking ? [scope.booking] : []) : scope.bookings;
  const hasContacts = contactIds.length > 0;
  const seeLoyalty = hasContacts && canSee(scope, "loyalty:read");
  const seeMoney = hasContacts && canSee(scope, "invoices:read") && canSee(scope, "payments:read");

  const [me, contacts, accounts, invoices, venues, unreadNotifications, pendingEmail] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, emailVerified: true, phone: true, phoneVerifiedAt: true, notificationPreferences: true },
    }),
    readIf(!preview && hasContacts, () => prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, phone: true } }), []),
    readIf(
      seeLoyalty,
      () => prisma.loyaltyAccount.findMany({ where: { contactId: { in: contactIds } }, select: { contactId: true, points: true, tier: true, totalEarned: true } }),
      []
    ),
    readIf(seeMoney, () => prisma.invoice.findMany({ where: { contactId: { in: contactIds } }, select: { status: true, balanceDue: true } }), []),
    venueNames(bookingRows.map((b) => b.venueId)),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    findPendingEmail(user.id),
  ]);
  if (!me) return null;

  const privacyRequests = preview ? [] : await findOwnPrivacyRequests(user.id, me);
  const account = pickLoyaltyAccount(accounts, ownBooking(scope)?.contactId ?? null);
  const bookingPhone = contacts.find((c) => c.phone)?.phone ?? null;
  const email = deliverableEmail(me.email);
  const balance = seeMoney ? bookingBalance(invoices.map((i) => ({ status: String(i.status), balanceDue: Number(i.balanceDue) }))) : null;

  return {
    preview,
    linked: !preview && hasContacts,
    name: me.name,
    email,
    emailVerified: !!email && !!me.emailVerified,
    pendingEmail,
    emailDeliveryConfigured: Boolean(process.env.RESEND_API_KEY),
    phone: me.phone ?? bookingPhone,
    phoneVerified: !!me.phone && !!me.phoneVerifiedAt,
    phoneSource: me.phone ? "ACCOUNT" : bookingPhone ? "BOOKING" : null,
    bookings: bookingRows.map((b) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      eventName: b.eventName,
      date: b.date.toISOString(),
      status: b.status,
      venueName: venues.get(b.venueId) ?? null,
      sharedRole: scope.collaboratorRoles?.[b.id] ?? null,
    })),
    loyalty: account ? { points: account.points, tier: String(account.tier) } : null,
    payments: balance ? { invoicesIssued: balance.issued, balanceDue: balance.balanceDue } : null,
    unreadNotifications,
    privacyRequests,
    hasOpenDeletionRequest: privacyRequests.some((r) => r.kind === "DELETE" && r.open),
    retentionYears: RETENTION_DEFAULTS.bookingsYears,
    notificationPreferences: customerNotificationRows(me.notificationPreferences),
    notificationPreferencesEnforced: NOTIFICATION_PREFERENCES_ENFORCED,
  };
}

export type NameChangeOutcome = "UPDATED" | "SENT_TO_TEAM" | "NONE";

/**
 * The customer's name is always theirs to change (User.name). Each of their
 * own contacts follows it when that is safe (see decideContactName); otherwise
 * the team gets a note on the contact and a notification to review it. Every
 * change is in the activity log under the customer's own user id.
 */
export async function updateGuestName(rawName: string): Promise<GuestResult<{ name: string; contact: NameChangeOutcome }>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const name = normalizeDisplayName(String(rawName ?? ""));
  if (!name) return { success: false, error: "Enter your name, 2 to 120 characters." };
  const userId = scope.user.id;
  if (tooMany(`name:${userId}`, 10, 3600)) return { success: false, error: SLOW_DOWN };

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!before) return { success: false, error: SIGN_IN };
  if ((before.name ?? "") === name) return { success: true, data: { name, contact: "NONE" } };

  const contacts = await prisma.contact.findMany({
    where: { id: { in: scope.contactIds }, deletedAt: null },
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          invoices: { where: { status: { not: "DRAFT" } } },
          contracts: { where: { status: { not: "DRAFT" } } },
        },
      },
    },
  });
  const decisions = contacts.map((contact) => ({
    contact,
    decision: decideContactName(
      {
        type: String(contact.type),
        firstName: contact.firstName,
        lastName: contact.lastName,
        issuedInvoices: contact._count.invoices,
        contracts: contact._count.contracts,
      },
      name
    ),
  }));
  const toUpdate = decisions.filter((d) => d.decision.action === "UPDATE");
  const held = decisions.filter((d) => d.decision.action === "HOLD_FOR_TEAM");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { name } }),
    ...toUpdate.map(({ contact, decision }) =>
      prisma.contact.update({ where: { id: contact.id }, data: { firstName: decision.firstName, lastName: decision.lastName } })
    ),
  ]);

  await logActivity({ userId, action: "customer_updated_name", entityType: "User", entityId: userId, changes: { from: before.name, to: name, via: VIA } });

  for (const { contact, decision } of toUpdate) {
    const from = fullName(contact.firstName, contact.lastName);
    const to = fullName(decision.firstName, decision.lastName);
    await logActivity({ userId, action: "customer_updated_name", entityType: "Contact", entityId: contact.id, changes: { from, to, via: VIA } });
    await addContactNote(
      contact.id,
      userId,
      `The customer changed their name in the Veloria app from "${from}" to "${to}". This contact was updated to match, as no invoice or contract carries the name yet.`
    );
  }

  const own = ownBookings(scope);
  for (const { contact, decision } of held) {
    const current = fullName(contact.firstName, contact.lastName);
    const why = decision.reason === "COMPANY_RECORD" ? "it is a company contact" : "issued invoices or contracts print this contact's name";
    await logActivity({
      userId,
      action: "customer_requested_name_change",
      entityType: "Contact",
      entityId: contact.id,
      changes: { current, requested: name, reason: decision.reason, via: VIA },
    });
    await addContactNote(
      contact.id,
      userId,
      `The customer changed their name in the Veloria app to "${name}". This contact still reads "${current}" because ${why}. Please review it, and update the contact if the new name should be used.`
    );
    const coordinators = [...new Set(own.filter((b) => b.contactId === contact.id).map((b) => b.createdById))];
    for (const coordinatorId of coordinators) {
      notify({
        userId: coordinatorId,
        type: "SYSTEM",
        title: `Customer name change: ${name}`,
        message: `The contact still reads "${current}". Review it on the contact page.`,
        actionUrl: `/contacts/${contact.id}`,
      });
    }
  }

  revalidatePath("/app/account");
  revalidatePath("/app");
  const contactOutcome: NameChangeOutcome = held.length > 0 ? "SENT_TO_TEAM" : toUpdate.length > 0 ? "UPDATED" : "NONE";
  return { success: true, data: { name, contact: contactOutcome } };
}

/**
 * Save a new email address as unverified. The app has no self-service way to
 * prove a mailbox (and transactional email may not be configured), so the
 * address is held as a pending change and User.email is left alone: replacing
 * it would either cut the customer off from their bookings or let an unproven
 * address resolve to someone else's.
 */
export async function requestGuestEmailChange(rawEmail: string): Promise<GuestResult<{ pendingEmail: PendingEmail }>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const email = normalizeEmail(String(rawEmail ?? ""));
  if (!email || isUndeliverableEmail(email)) return { success: false, error: "Enter a valid email address." };
  const userId = scope.user.id;
  if (tooMany(`email:${userId}`, 5, 3600)) return { success: false, error: SLOW_DOWN };

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!me) return { success: false, error: SIGN_IN };
  if (me.email.toLowerCase() === email) {
    await clearPendingEmail(userId);
    revalidatePath("/app/account");
    return { success: false, error: "That's already the email on your account." };
  }

  await clearPendingEmail(userId);
  const now = Date.now();
  await prisma.verificationToken.create({
    data: {
      identifier: emailChangeIdentifier(userId, email),
      token: createHash("sha256").update(randomBytes(32)).digest("hex"),
      expires: new Date(now + EMAIL_CHANGE_TTL_MS),
    },
  });
  await logActivity({
    userId,
    action: "customer_requested_email_change",
    entityType: "User",
    entityId: userId,
    changes: { from: deliverableEmail(me.email), to: email, verified: false, via: VIA },
  });
  revalidatePath("/app/account");
  return { success: true, data: { pendingEmail: { address: email, requestedAt: new Date(now).toISOString() } } };
}

export async function cancelGuestEmailChange(): Promise<GuestResult<{ cleared: boolean }>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const count = await clearPendingEmail(scope.user.id);
  if (count > 0) {
    await logActivity({ userId: scope.user.id, action: "customer_withdrew_email_change", entityType: "User", entityId: scope.user.id, changes: { via: VIA } });
  }
  revalidatePath("/app/account");
  return { success: true, data: { cleared: count > 0 } };
}

/**
 * "Delete my data": a DELETE request in the team's privacy queue, raised
 * through the same action as the public privacy form (validation, rate limit,
 * admin notification), with the account's own name, email and phone. The
 * activity log links the request to this account so its status can be shown.
 */
export async function requestGuestDataDeletion(rawNote: string): Promise<GuestResult<{ id: string }>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const userId = scope.user.id;
  if (tooMany(`privacy:${userId}`, 3, 24 * 3600)) return { success: false, error: SLOW_DOWN };

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, emailVerified: true, phone: true, phoneVerifiedAt: true },
  });
  if (!me) return { success: false, error: SIGN_IN };
  const existing = await findOwnPrivacyRequests(userId, me);
  if (existing.some((r) => r.kind === "DELETE" && r.open)) {
    return { success: false, error: "Your request to delete your data is already with the team. Its progress is shown below." };
  }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: scope.contactIds } },
    select: { firstName: true, lastName: true, phone: true },
  });
  const email = deliverableEmail(me.email);
  const requesterName =
    [me.name?.trim(), ...contacts.map((c) => fullName(c.firstName, c.lastName)), email].find(
      (n): n is string => typeof n === "string" && n.length >= 2
    ) ?? "Veloria app customer";
  const phone = me.phone ?? contacts.find((c) => c.phone)?.phone ?? null;
  const details = composeDeletionDetails({
    email,
    emailVerified: !!email && !!me.emailVerified,
    phone,
    phoneVerified: !!me.phone && !!me.phoneVerifiedAt && phone === me.phone,
    bookings: ownBookings(scope).map((b) => ({ bookingNumber: b.bookingNumber, date: b.date.toISOString() })),
    note: String(rawNote ?? "").slice(0, 1500),
  });

  const res = await submitPrivacyRequest({
    kind: "DELETE",
    requesterName: requesterName.slice(0, 120),
    requesterEmail: email ? (normalizeEmail(email) ?? undefined) : undefined,
    requesterPhone: phone ? phone.slice(0, 30) : undefined,
    details,
    website: "",
  });
  if (!res.success) return { success: false, error: res.error };

  await logActivity({ userId, action: PRIVACY_LINK_ACTION, entityType: "PrivacyRequest", entityId: res.data.id, changes: { kind: "DELETE", via: VIA } });
  revalidatePath("/app/account");
  return { success: true, data: { id: res.data.id } };
}

const preferenceChangesSchema = z
  .array(z.object({ key: z.string().max(64), emailEnabled: z.boolean(), smsEnabled: z.boolean() }))
  .max(20);

/** Writes User.notificationPreferences in the shape the team's settings screen writes and shouldSendNotification() reads. */
export async function updateGuestNotificationPreferences(
  changes: { key: string; emailEnabled: boolean; smsEnabled: boolean }[]
): Promise<GuestResult<{ preferences: CustomerNotificationRow[] }>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const parsed = preferenceChangesSchema.safeParse(changes);
  if (!parsed.success) return { success: false, error: "Those choices couldn't be read. Refresh the page and try again." };
  const userId = scope.user.id;
  if (tooMany(`prefs:${userId}`, 30, 3600)) return { success: false, error: SLOW_DOWN };

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPreferences: true } });
  if (!me) return { success: false, error: SIGN_IN };
  const next = serializeNotificationPreferences(me.notificationPreferences, parsed.data);
  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: next as unknown as Prisma.InputJsonValue },
  });
  // The same audit row the team's settings writer records.
  await logActivity({
    userId,
    action: "updated",
    entityType: "NotificationPreferences",
    entityId: userId,
    changes: { via: VIA, keys: parsed.data.map((c) => c.key).filter(isCustomerNotificationKey) },
  });
  revalidatePath("/app/account");
  return { success: true, data: { preferences: customerNotificationRows(next) } };
}

// ============================================================ rewards

export interface GuestReferralRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface GuestRewardsDetails {
  preview: boolean;
  linked: boolean;
  /** The customer's own booking a request to use points attaches to. */
  bookingId: string | null;
  /** Preview only: the viewer's role can't see loyalty (loyalty:read). */
  loyaltyHidden: boolean;
  /** Preview only: the viewer's role can't see referrals (referrals:read). */
  referralsHidden: boolean;
  /** Preview only: the viewer's role can't see referral reward rules or partner links (referrals:manage). */
  rulesHidden: boolean;
  loyalty: {
    points: number;
    tier: string;
    totalEarned: number;
    progress: { nextTier: string | null; toGo: number; pct: number };
    activity: { id: string; what: string; when: string; points: number }[];
  } | null;
  /** Active referral reward rules, in the customer's words. Empty when the team has none configured. */
  referralRewards: PerkLine[];
  /** The customer's own /refer link, when the team has issued one. */
  partner: { url: string; reward: string | null } | null;
  canRequestRedemption: boolean;
  redemptionBlockedReason: RedemptionBlock | null;
  redemptions: { id: string; text: string; status: string; createdAt: string }[];
  referrals: GuestReferralRow[];
}

export async function getGuestRewardsDetails(): Promise<GuestRewardsDetails | null> {
  const scope = await accountScope();
  if (!scope) return null;
  const { contactIds, preview } = scope;
  const booking = ownBooking(scope);
  const bookingIds = preview ? (booking ? [booking.id] : []) : ownBookings(scope).map((b) => b.id);
  const hasContacts = contactIds.length > 0;
  const seeLoyalty = canSee(scope, "loyalty:read");
  const seeReferrals = canSee(scope, "referrals:read");
  const seeRules = canSee(scope, "referrals:manage");

  const [accounts, rules, partner, referrals, redemptions] = await Promise.all([
    readIf(
      hasContacts && seeLoyalty,
      () =>
        prisma.loyaltyAccount.findMany({
          where: { contactId: { in: contactIds } },
          select: {
            contactId: true,
            points: true,
            tier: true,
            totalEarned: true,
            transactions: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, type: true, points: true, description: true, createdAt: true } },
          },
        }),
      []
    ),
    readIf(
      hasContacts && seeReferrals && seeRules,
      () =>
        prisma.referralRewardRule.findMany({
          where: { isActive: true },
          orderBy: { tierLevel: "asc" },
          select: { id: true, triggerEvent: true, rewardType: true, rewardValue: true, minBookingValue: true, bonusMultiplier: true, isActive: true, tierLevel: true },
        }),
      []
    ),
    readIf(
      hasContacts && seeReferrals && seeRules,
      () =>
        prisma.referralPartner.findFirst({
          where: { contactId: { in: contactIds }, isActive: true },
          orderBy: { createdAt: "desc" },
          select: { code: true, isActive: true, payoutType: true, payoutValue: true, payoutPercent: true },
        }),
      null
    ),
    readIf(
      hasContacts && seeReferrals,
      () =>
        prisma.referral.findMany({
          where: { referrerContactId: { in: contactIds } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, referredName: true, status: true, createdAt: true },
        }),
      []
    ),
    // Requests to use points name the balance, so they follow the loyalty gate.
    readIf(
      bookingIds.length > 0 && seeLoyalty,
      () =>
        prisma.task.findMany({
          where: { bookingId: { in: bookingIds }, taskType: "CLIENT_REQUEST", metadata: { path: ["kind"], equals: "REDEEM" } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, description: true, status: true, createdAt: true },
        }),
      []
    ),
  ]);

  const account = pickLoyaltyAccount(accounts, booking?.contactId ?? null);
  const perks = decidePerks({
    rules: rules.map((r) => ({
      id: r.id,
      triggerEvent: r.triggerEvent,
      rewardType: r.rewardType,
      rewardValue: Number(r.rewardValue),
      minBookingValue: r.minBookingValue === null ? null : Number(r.minBookingValue),
      bonusMultiplier: r.bonusMultiplier === null ? null : Number(r.bonusMultiplier),
      isActive: r.isActive,
      tierLevel: r.tierLevel,
    })),
    partner: partner
      ? {
          code: partner.code,
          isActive: partner.isActive,
          payoutType: partner.payoutType,
          payoutValue: Number(partner.payoutValue),
          payoutPercent: Number(partner.payoutPercent),
        }
      : null,
    points: account?.points ?? 0,
    hasBooking: !!booking,
    preview,
    hasOpenRedemption: redemptions.some((t) => t.status !== "DONE"),
  });

  return {
    preview,
    linked: hasContacts,
    bookingId: booking?.id ?? null,
    loyaltyHidden: !seeLoyalty,
    referralsHidden: !seeReferrals,
    rulesHidden: !seeRules,
    loyalty: account
      ? {
          points: account.points,
          tier: String(account.tier),
          totalEarned: account.totalEarned,
          progress: tierProgress(String(account.tier), account.totalEarned),
          activity: account.transactions.map((t) => ({
            id: t.id,
            what: t.description,
            when: t.createdAt.toISOString(),
            points: signedPoints(String(t.type), t.points),
          })),
        }
      : null,
    referralRewards: perks.referralRewards,
    partner: perks.partner ? { url: buildPartnerLink(perks.partner.code), reward: perks.partner.reward } : null,
    canRequestRedemption: perks.canRequestRedemption && seeLoyalty,
    redemptionBlockedReason: perks.redemptionBlockedReason,
    redemptions: redemptions.map((t) => ({ id: t.id, text: t.description ?? "", status: String(t.status), createdAt: t.createdAt.toISOString() })),
    referrals: referrals.map((r) => ({ id: r.id, name: r.referredName, status: String(r.status), createdAt: r.createdAt.toISOString() })),
  };
}

/**
 * Ask to use points. Nothing is deducted here: the request lands in the
 * coordinator's queue through the team's own path (requestFromConcierge,
 * kind REDEEM), and the team applies it on the loyalty account.
 */
export async function requestGuestRedemption(input: { bookingId: string; points: number; note: string }): Promise<GuestResult<{ id: string }>> {
  const bookingId = String(input?.bookingId ?? "");
  const scope = await accountScope(bookingId || undefined);
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: PREVIEW };
  const booking = scope.booking;
  if (!booking || booking.id !== bookingId) return { success: false, error: "That booking isn't linked to your account." };
  if (isShared(scope, booking.id)) return { success: false, error: "Points can only be used on your own booking." };
  const userId = scope.user.id;
  if (tooMany(`redeem:${userId}`, 5, 3600)) return { success: false, error: SLOW_DOWN };

  const accounts = await prisma.loyaltyAccount.findMany({
    where: { contactId: { in: scope.contactIds } },
    select: { id: true, contactId: true, points: true, totalEarned: true },
  });
  const account = pickLoyaltyAccount(accounts, booking.contactId);
  if (!account || account.points <= 0) return { success: false, error: "You don't have any points to use yet." };
  const check = validateRedemption({ points: input?.points, balance: account.points, note: input?.note });
  if (!check.ok) return { success: false, error: check.error };

  const open = await prisma.task.findFirst({
    where: {
      bookingId: { in: ownBookings(scope).map((b) => b.id) },
      taskType: "CLIENT_REQUEST",
      status: { not: "DONE" },
      metadata: { path: ["kind"], equals: "REDEEM" },
    },
    select: { id: true },
  });
  if (open) return { success: false, error: "Your coordinator is still confirming your last request to use points. You can ask again once it's settled." };

  const res = await requestFromConcierge(
    booking.id,
    `Use ${check.points.toLocaleString("en-IN")} of ${account.points.toLocaleString("en-IN")} loyalty points: ${check.note}`,
    "REDEEM"
  );
  if (!res.success) return { success: false, error: res.error };
  await logActivity({
    userId,
    action: "customer_requested_redemption",
    entityType: "LoyaltyAccount",
    entityId: account.id,
    changes: { points: check.points, balance: account.points, taskId: res.data.id, bookingId: booking.id, via: VIA },
  });
  revalidatePath("/app/rewards");
  return { success: true, data: { id: res.data.id } };
}

/**
 * Introduce a friend: a Referral row exactly as the team's referral form
 * creates it (PENDING, source GUEST, unique code and link, referrer contact
 * and user), logged the same way, with the booking's coordinator notified.
 */
export async function submitGuestFriendReferral(input: { name: string; phone: string; email?: string }): Promise<GuestResult<GuestReferralRow>> {
  const scope = await accountScope();
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: "Staff preview: referrals come from the host's own account." };
  if (scope.contactIds.length === 0) return { success: false, error: "Your account isn't linked to a booking yet." };
  const userId = scope.user.id;
  if (tooMany(`referral:${userId}`, 10, 3600)) return { success: false, error: SLOW_DOWN };

  const referredName = String(input?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (referredName.length < 2) return { success: false, error: "Enter your friend's name." };
  const rawPhone = String(input?.phone ?? "").trim();
  const referredPhone = canonicalPhone(rawPhone);
  const digits = referredPhone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return { success: false, error: "Enter your friend's full mobile number." };
  const rawEmail = String(input?.email ?? "").trim();
  const referredEmail = rawEmail ? normalizeEmail(rawEmail) : null;
  if (rawEmail && !referredEmail) return { success: false, error: "That email address doesn't look right." };

  const last10 = digits.slice(-10);
  const variants = [...new Set([referredPhone, rawPhone, last10, `0${last10}`, `91${last10}`, `+91${last10}`])];
  const [me, ownContacts, duplicate] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } }),
    prisma.contact.findMany({ where: { id: { in: scope.contactIds } }, select: { id: true, firstName: true, lastName: true, phone: true } }),
    prisma.referral.findFirst({ where: { referrerContactId: { in: scope.contactIds }, referredPhone: { in: variants } }, select: { id: true } }),
  ]);
  const ownNumbers = [me?.phone, ...ownContacts.map((c) => c.phone)]
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/\D/g, "").slice(-10));
  if (ownNumbers.includes(last10)) return { success: false, error: "That's your own number. Enter your friend's number instead." };
  if (duplicate) return { success: false, error: "You've already introduced this number, so the team has it." };

  const booking = ownBooking(scope);
  const referrer = ownContacts.find((c) => c.id === booking?.contactId) ?? ownContacts[0];
  if (!referrer) return { success: false, error: "Your account isn't linked to a booking yet." };

  const referralCode = await generateUniqueCode();
  const created = await prisma.referral.create({
    data: {
      referrerContactId: referrer.id,
      referrerUserId: userId,
      referredName,
      referredPhone,
      referredEmail,
      source: "GUEST",
      status: "PENDING",
      referralCode,
      referralLink: buildReferralLink(referralCode),
      notes: "Introduced by the customer in the Veloria app.",
    },
    select: { id: true, referredName: true, status: true, createdAt: true },
  });

  const referrerName = fullName(referrer.firstName, referrer.lastName);
  await logActivity({
    userId,
    action: "created",
    entityType: "Referral",
    entityId: created.id,
    changes: { referredName, referrerName, source: "GUEST", referralCode, via: VIA },
  });
  if (booking) {
    notify({
      userId: booking.createdById,
      type: "LEAD_ASSIGNED",
      title: `Referral from ${me?.name ?? referrerName}: ${referredName}`,
      message: `${referredPhone}${referredEmail ? ` · ${referredEmail}` : ""}. Introduced in the customer app.`,
      actionUrl: `/referrals/${created.id}`,
    });
  }
  revalidatePath("/app/rewards");
  return {
    success: true,
    data: { id: created.id, name: created.referredName, status: String(created.status), createdAt: created.createdAt.toISOString() },
  };
}

// ============================================================ rating

export interface GuestRatingBooking {
  id: string;
  eventName: string;
  date: string;
  status: string;
  venueName: string | null;
}

export interface GuestReviewView {
  rating: number;
  content: string;
  state: ReviewState;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  /** Entered by a team member on the customer's behalf (recordGuestFeedback). */
  recordedByTeam: boolean;
}

export interface GuestRatingDetails {
  preview: boolean;
  firstName: string | null;
  bookings: GuestRatingBooking[];
  booking: GuestRatingBooking | null;
  state: RatingState;
  /** Why this booking can't be rated yet; null when it can. */
  blockedMessage: string | null;
  review: GuestReviewView | null;
  /** Preview only: the viewer's role can't open reviews (reviews:read). */
  reviewsHidden: boolean;
  /** Every booking this login reaches is someone else's, shared with them: the host rates it. */
  sharedOnly: boolean;
}

export async function getGuestRatingDetails(bookingId?: string): Promise<GuestRatingDetails | null> {
  const scope = await accountScope(bookingId);
  if (!scope) return null;
  const { preview } = scope;
  const list: HostBooking[] = preview ? (scope.booking ? [scope.booking] : []) : ownBookings(scope);
  const seeReviews = canSee(scope, "reviews:read");

  const [me, reviews, venues] = await Promise.all([
    prisma.user.findUnique({ where: { id: scope.user.id }, select: { name: true } }),
    readIf(
      seeReviews && list.length > 0,
      () =>
        prisma.review.findMany({
          where: { bookingId: { in: list.map((b) => b.id) } },
          orderBy: { createdAt: "desc" },
          select: { id: true, bookingId: true, contactId: true, rating: true, content: true, isApproved: true, isPublic: true, response: true, respondedAt: true, createdAt: true },
        }),
      []
    ),
    venueNames(list.map((b) => b.venueId)),
  ]);

  // A booking's review is the one submitReview() counts as already submitted: same booking, same contact.
  const reviewFor = (b: HostBooking) => reviews.find((r) => r.bookingId === b.id && r.contactId === b.contactId) ?? null;
  const reviewedIds = new Set(list.filter((b) => reviewFor(b) !== null).map((b) => b.id));
  const now = new Date();
  const requested = bookingId ? (list.find((b) => b.id === bookingId) ?? null) : null;
  const chosen = requested ?? pickBookingToRate(list, reviewedIds, now);
  const review = chosen ? reviewFor(chosen) : null;
  const state = ratingState(chosen, review !== null, now);
  const recordedByTeam = review
    ? (await prisma.activityLog.findFirst({ where: { entityType: "Review", entityId: review.id, action: "recorded_feedback" }, select: { id: true } })) !== null
    : false;

  const shape = (b: HostBooking): GuestRatingBooking => ({
    id: b.id,
    eventName: b.eventName,
    date: b.date.toISOString(),
    status: b.status,
    venueName: venues.get(b.venueId) ?? null,
  });

  return {
    preview,
    firstName: (me?.name ?? "").trim().split(/\s+/)[0] || null,
    bookings: list.map(shape),
    booking: chosen ? shape(chosen) : null,
    state,
    blockedMessage: ratingBlockedMessage(state),
    review: review
      ? {
          rating: review.rating,
          content: review.content,
          state: reviewState(review),
          response: review.response,
          respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
          createdAt: review.createdAt.toISOString(),
          recordedByTeam,
        }
      : null,
    reviewsHidden: !seeReviews,
    sharedOnly: !preview && list.length === 0 && scope.bookings.length > 0,
  };
}

/** A review through the team's own submitReview(): ownership, completed-only, one per booking, /reviews moderation. */
export async function submitGuestReview(input: {
  bookingId: string;
  rating: number;
  tags: string[];
  text: string;
  isPublic: boolean;
}): Promise<GuestResult<{ id: string }>> {
  const bookingId = String(input?.bookingId ?? "");
  const scope = await accountScope(bookingId || undefined);
  if (!scope) return { success: false, error: SIGN_IN };
  if (scope.preview) return { success: false, error: "Staff preview: reviews come from the host's own account." };
  const booking = scope.booking;
  if (!booking || booking.id !== bookingId) return { success: false, error: "That booking isn't linked to your account." };
  if (isShared(scope, booking.id)) return { success: false, error: "Only the booking's host can rate this event." };
  const userId = scope.user.id;
  if (tooMany(`review:${userId}`, 10, 3600)) return { success: false, error: SLOW_DOWN };

  const existing = await prisma.review.findFirst({ where: { bookingId: booking.id, contactId: booking.contactId }, select: { id: true } });
  const blocked = ratingBlockedMessage(ratingState(booking, existing !== null, new Date()));
  if (blocked) return { success: false, error: blocked };

  const composed = composeReview({ rating: input?.rating, tags: Array.isArray(input?.tags) ? input.tags : [], text: input?.text });
  if (!composed.ok) return { success: false, error: composed.error };

  const res = await submitReview({ bookingId: booking.id, rating: composed.rating, content: composed.content, isPublic: input?.isPublic === true });
  if (!res.success) {
    if (res.error === "You have already submitted a review for this booking") {
      return { success: false, error: ratingBlockedMessage("ALREADY_REVIEWED") ?? res.error };
    }
    if (res.error === "Booking not found or event not yet completed" || res.error === "No contact profile found") {
      return {
        success: false,
        error: "We couldn't match this booking to your contact details, so the review wasn't saved. Please message the team and they'll record it for you.",
      };
    }
    return { success: false, error: "Your review couldn't be sent. Please try again." };
  }
  revalidatePath("/app/rate");
  return { success: true, data: { id: String(res.data.id) } };
}
