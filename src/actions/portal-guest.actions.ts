"use server";

// ============================================================
// HOST-SIDE guest management. Two front doors, one set of records:
//
//  - portal*  — the desktop client portal (/portal/guests). Authorised by
//               ownedBooking(): the booking must belong to one of the caller's
//               verified contacts.
//  - host*    — the guest app (/app/event/guests). Authorised by
//               getMyBookingAccess(): the booking's own customer, an ACTIVE
//               co-host (can change things), an ACTIVE viewer or a team preview
//               (read-only).
//
// Both write the same GuestList / Guest / GuestInvitation rows the team's guest
// list and check-in read, and the public /rsvp/[token] page answers those same
// invitations. Staff guest.actions / invitation.actions stay separate because
// they gate on staff permissions a host doesn't hold.
//
// Honesty: an invitation is marked SENT only after WhatsApp accepted it. A link
// the host copies or shares by hand creates the invitation row (so the RSVP link
// works) but leaves it NOT_SENT — it is never recorded as sent.
//
// Every WhatsApp send (here and the team's) goes through one module,
// src/lib/guests/invitation-send.ts: eligibility, the send lease, the message,
// the booking-status gate, the customer quotas and the bulk counts live there.
// This file adds the host-side limits in front of it: a rate limit on every send
// action (the portal and the app share one budget per user) and one phone
// number per guest on the list.
// ============================================================

import { auth } from "@/../auth";
import type { GuestCategory, Prisma, RSVPStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { guestSchema, bulkImportSchema } from "@/schemas/guest.schema";
import { buildRsvpUrl } from "@/lib/invitation-message-builder";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { canDo, type BookingAction, type CollaboratorRole } from "@/lib/customer-app/collaborator-permissions";
import { getMyBookingAccess, type BookingAccessKind, type MyBookingAccess } from "@/actions/guest-collaborators.actions";
import {
  checkPhone,
  displayPhone,
  guestPhoneForStorage,
  samePhone,
  splitDuplicatePhones,
} from "@/app/(guest)/app/event/guests/_lib/host-phone";
import {
  INVITE_ALL_BATCH,
  canShareRsvpLink,
  inviteAllMessage,
  planInviteAll,
  summarizeInviteAll,
  type InviteAllSummary,
} from "@/app/(guest)/app/event/guests/_lib/guest-invites";
import {
  DAILY_LIMIT_MESSAGE,
  INVITE_BOOKING_SELECT,
  bookingInviteRefusal,
  customerInviteAllowance,
  deliverInvitation,
  ensureInvitation,
  inviteChannel,
  inviteDetails,
  inviteOutcomeKind,
  sendInBulk,
  type InviteBooking,
  type InviteDetails as SharedInviteDetails,
  type NotSentOutcome,
  type SendGuest,
} from "@/lib/guests/invitation-send";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PREVIEW_ERROR =
  "Staff preview — this would change a real customer's booking. Sign in as that host (or the demo guest) to try it.";
const CATEGORIES = new Set<string>(["VIP", "FAMILY", "FRIEND", "CORPORATE", "OTHER"]);
const RSVP_VALUES = new Set<string>(["PENDING", "ACCEPTED", "DECLINED"]);

// Rate limits on WhatsApp sends, per signed-in user. The portal and the guest app
// use the same keys, so moving between them doesn't reset the budget.
const SEND_ONE_LIMIT = { maxRequests: 60, windowSeconds: 600 };
const SEND_ALL_LIMIT = { maxRequests: 20, windowSeconds: 600 };
const RATE_LIMITED = "That's a lot of invitations at once. Try again in a few minutes.";

/** Most rows one host guest import may carry (bulkImportSchema's cap, pinned here with the other host limits). */
const IMPORT_MAX_ROWS = 500;

// The ONLY portal authorization gate: resolve the caller → their verified contacts → the
// booking, and return it only when the booking belongs to one of those contacts.
async function ownedBooking(bookingId: string): Promise<{ uid: string; booking: InviteBooking } | null> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid || !bookingId || typeof bookingId !== "string") return null;
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.length === 0) return null;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, contactId: { in: contactIds } },
    select: INVITE_BOOKING_SELECT,
  });
  return booking ? { uid, booking } : null;
}

async function recalcTotals(guestListId: string) {
  const guests = await prisma.guest.findMany({
    where: { guestListId },
    select: { plusOnes: true, rsvpStatus: true, isCheckedIn: true },
  });
  await prisma.guestList.update({
    where: { id: guestListId },
    data: {
      totalInvited: guests.reduce((s, g) => s + 1 + g.plusOnes, 0),
      totalRSVP: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
      totalCheckedIn: guests.filter((g) => g.isCheckedIn).length,
    },
  });
}

async function ensureGuestList(bookingId: string): Promise<string> {
  const list = await prisma.guestList.upsert({ where: { bookingId }, update: {}, create: { bookingId }, select: { id: true } });
  return list.id;
}

/** Every screen that shows this booking's guests — host portal, guest app and the team's list. */
function revalidateGuestViews(bookingId: string) {
  revalidatePath(`/portal/guests/${bookingId}`);
  revalidatePath(`/bookings/${bookingId}/guests`);
  revalidatePath("/app/event/guests");
}

/** One phone rule for every host-side writer: empty is fine, anything else must be a reachable number. */
function optionalGuestPhone(raw: string | null | undefined): { ok: true; phone: string | null } | { ok: false; error: string } {
  const c = checkPhone(raw);
  if (c.kind === "EMPTY") return { ok: true, phone: null };
  if (c.kind === "INVALID") return { ok: false, error: c.error };
  return { ok: true, phone: guestPhoneForStorage(c.digits) };
}

async function findPhoneDuplicate(guestListId: string, phone: string, exceptGuestId?: string) {
  const rows = await prisma.guest.findMany({
    where: { guestListId, phone: { not: null }, ...(exceptGuestId ? { id: { not: exceptGuestId } } : {}) },
    select: { id: true, name: true, phone: true },
  });
  return rows.find((r) => samePhone(r.phone, phone)) ?? null;
}

// ------------------------------------------------------------
// Invitations — the one send path (src/lib/guests/invitation-send.ts)
// ------------------------------------------------------------

export type InviteDetails = SharedInviteDetails;

/** Why a host's send didn't go out, in the host's words. */
function sendErrorMessage(
  res: NotSentOutcome,
  name: string,
  via: "portal" | "guest-app",
  bookingStatus: string
): string {
  if (res.outcome === "FAILED") {
    return via === "guest-app"
      ? `We couldn't send ${name}'s invitation on WhatsApp just now. Share their RSVP link instead, or try again later.`
      : `We couldn't send ${name}'s invitation on WhatsApp just now. Please try again later.`;
  }
  if (res.reason === "BOOKING_NOT_ACTIVE") {
    return bookingInviteRefusal(bookingStatus) ?? "Invitations can't be sent for this booking right now.";
  }
  if (res.reason === "DAILY_LIMIT") return DAILY_LIMIT_MESSAGE;
  if (res.reason === "NO_PHONE") return "Add a phone number for this guest first.";
  if (res.reason === "REPLIED") return `${name} has already replied.`;
  if (res.reason === "IN_PROGRESS") return `${name}'s invitation is already being sent.`;
  return "This guest was already invited.";
}

type InviteAllGuest = SendGuest & {
  invitation: { invitationStatus: string; sentAt: Date | null; rsvpRespondedAt: Date | null } | null;
};

/**
 * "Invite all" for a host: one batch of eligible guests, no more than the
 * customer quota still allows, sent through the shared module a few at a time.
 */
async function runInviteAll(
  guests: readonly InviteAllGuest[],
  booking: InviteBooking,
  actorId: string,
  via: "portal" | "guest-app"
): Promise<InviteAllSummary> {
  const [channel, allowance] = await Promise.all([inviteChannel(), customerInviteAllowance(booking.id, actorId)]);
  const plan = planInviteAll(
    guests.map((g) => ({ ...g, rsvpStatus: String(g.rsvpStatus) })),
    INVITE_ALL_BATCH,
    allowance
  );
  const outcomes = await sendInBulk(
    plan.toSend,
    (g) => deliverInvitation({ guest: g, booking, channel, actorId, via }),
    "[GUEST_INVITE_ALL_ERR]"
  );
  const summary = summarizeInviteAll(plan, outcomes.map(inviteOutcomeKind));
  await logActivity({ userId: actorId, action: "bulk_sent_invitations", entityType: "GuestInvitation", entityId: booking.id, changes: { ...summary, via } });
  return summary;
}

// ------------------------------------------------------------
// Portal reads
// ------------------------------------------------------------

/** The host's own bookings, with guest-list summary — the /portal/guests landing. */
export async function getPortalGuestBookings() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return [];
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.length === 0) return [];
  const bookings = await prisma.booking.findMany({
    where: { contactId: { in: contactIds }, status: { notIn: ["CANCELLED"] } },
    orderBy: { date: "asc" },
    select: {
      id: true, eventName: true, bookingNumber: true, date: true,
      venue: { select: { name: true } },
      guestList: { select: { totalInvited: true, totalRSVP: true, _count: { select: { guests: true } } } },
    },
  });
  return serialize(bookings);
}

/** Full guest list + RSVP stats for ONE of the host's bookings. */
export async function getPortalGuestList(bookingId: string) {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false as const, error: "Not found." };
  const guestList = await prisma.guestList.findUnique({
    where: { bookingId },
    include: {
      guests: {
        orderBy: { createdAt: "desc" },
        include: { invitation: { select: { invitationStatus: true, sentAt: true, rsvpRespondedAt: true } } },
      },
    },
  });
  const guests = guestList?.guests ?? [];
  const stats = {
    total: guests.length,
    invited: guests.reduce((s, g) => s + 1 + g.plusOnes, 0),
    accepted: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
    declined: guests.filter((g) => g.rsvpStatus === "DECLINED").length,
    pending: guests.filter((g) => g.rsvpStatus === "PENDING").length,
    // Actually sent — a hand-shared link someone answered has no sentAt and isn't counted.
    sent: guests.filter((g) => g.invitation && g.invitation.invitationStatus !== "NOT_SENT" && g.invitation.sentAt).length,
  };
  return {
    success: true as const,
    data: serialize({
      booking: { id: own.booking.id, eventName: own.booking.eventName, date: own.booking.date, venueName: own.booking.venue.name },
      guestListId: guestList?.id ?? null,
      guests,
      stats,
    }),
  };
}

// ------------------------------------------------------------
// Portal writes (all own-booking-scoped)
// ------------------------------------------------------------

export async function portalAddGuest(bookingId: string, data: unknown): Promise<Result<{ id: string }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const parsed = guestSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid guest details." };
  const g = parsed.data;
  const phone = optionalGuestPhone(g.phone);
  if (!phone.ok) return { success: false, error: phone.error };
  const guestListId = await ensureGuestList(bookingId);
  // One number, one guest: the guest app's rule (hostAddGuest).
  if (phone.phone) {
    const dup = await findPhoneDuplicate(guestListId, phone.phone);
    if (dup) return { success: false, error: `${dup.name} already has this number on your list.` };
  }
  const guest = await prisma.guest.create({
    data: {
      guestListId, name: g.name, email: g.email || null, phone: phone.phone,
      category: g.category, plusOnes: g.plusOnes ?? 0,
      dietaryRestrictions: g.dietaryRestrictions || null, notes: g.notes || null,
    },
    select: { id: true },
  });
  await recalcTotals(guestListId);
  revalidateGuestViews(bookingId);
  return { success: true, data: { id: guest.id } };
}

/**
 * Adds a pasted list. `count` is the guests added; `duplicates` the rows left out
 * because their number is already on the list or appears earlier in the paste.
 */
export async function portalBulkImportGuests(
  bookingId: string,
  data: unknown
): Promise<Result<{ count: number; duplicates: number }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const parsed = bulkImportSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid import — check the rows." };
  if (parsed.data.guests.length > IMPORT_MAX_ROWS) {
    return { success: false, error: `Import up to ${IMPORT_MAX_ROWS} guests at a time.` };
  }
  const rows: Prisma.GuestCreateManyInput[] = [];
  const guestListId = await ensureGuestList(bookingId);
  for (const [i, g] of parsed.data.guests.entries()) {
    const phone = optionalGuestPhone(g.phone);
    if (!phone.ok) return { success: false, error: `Line ${i + 1} (${g.name}): ${phone.error}` };
    rows.push({ guestListId, name: g.name, email: g.email || null, phone: phone.phone, category: g.category ?? "OTHER", plusOnes: g.plusOnes ?? 0 });
  }
  const onList = await prisma.guest.findMany({ where: { guestListId, phone: { not: null } }, select: { phone: true } });
  const { keep, duplicates } = splitDuplicatePhones(rows, onList.map((row) => row.phone));
  if (keep.length === 0) return { success: false, error: "Every number in this list is already on your guest list." };
  const res = await prisma.guest.createMany({ data: keep });
  await recalcTotals(guestListId);
  revalidateGuestViews(bookingId);
  return { success: true, data: { count: res.count, duplicates: duplicates.length } };
}

export async function portalRemoveGuest(bookingId: string, guestId: string): Promise<Result<{ id: string }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  // The guest must belong to THIS booking's list (never another host's).
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, guestList: { bookingId } },
    select: { id: true, guestListId: true },
  });
  if (!guest) return { success: false, error: "Guest not found." };
  await prisma.guest.delete({ where: { id: guest.id } });
  await recalcTotals(guest.guestListId);
  revalidateGuestViews(bookingId);
  return { success: true, data: { id: guestId } };
}

export async function portalSendInvitation(bookingId: string, guestId: string): Promise<Result<{ sent: boolean }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const limit = checkRateLimit(`guest-invite:${own.uid}`, SEND_ONE_LIMIT);
  if (!limit.success) return { success: false, error: RATE_LIMITED };
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, guestList: { bookingId } },
    select: { id: true, name: true, phone: true, rsvpStatus: true },
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!guest.phone) return { success: false, error: "Add a phone number for this guest first." };
  const res = await deliverInvitation({ guest, booking: own.booking, channel: await inviteChannel(), actorId: own.uid, via: "portal" });
  if (res.outcome !== "SENT") return { success: false, error: sendErrorMessage(res, guest.name, "portal", own.booking.status) };
  revalidateGuestViews(bookingId);
  return { success: true, data: { sent: true } };
}

/** `limited`: eligible guests over the 24-hour customer quota, left to send later. */
export async function portalBulkSendInvitations(
  bookingId: string
): Promise<Result<{ sent: number; skipped: number; failed: number; needPhone: number; later: number; limited: number }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const limit = checkRateLimit(`guest-invite-all:${own.uid}`, SEND_ALL_LIMIT);
  if (!limit.success) return { success: false, error: RATE_LIMITED };
  const refusal = bookingInviteRefusal(own.booking.status);
  if (refusal) return { success: false, error: refusal };
  const guests = await prisma.guest.findMany({
    where: { guestList: { bookingId } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, rsvpStatus: true, invitation: { select: { invitationStatus: true, sentAt: true, rsvpRespondedAt: true } } },
  });
  const summary = await runInviteAll(guests, own.booking, own.uid, "portal");
  revalidateGuestViews(bookingId);
  // Nothing went out only because the quota is used up: say that, not "0 sent".
  if (summary.sent === 0 && summary.failed === 0 && summary.limited > 0) return { success: false, error: DAILY_LIMIT_MESSAGE };
  return {
    success: true,
    data: {
      sent: summary.sent,
      skipped: guests.length - summary.sent,
      failed: summary.failed,
      needPhone: summary.needPhone,
      later: summary.later,
      limited: summary.limited,
    },
  };
}

/**
 * Host marks a guest's RSVP by hand (a phone call, a WhatsApp reply). It writes
 * Guest.rsvpStatus — the same field the team's list and the RSVP link write.
 * Guarded by ownership like every other portal write.
 */
export async function portalSetGuestRsvp(
  bookingId: string,
  guestId: string,
  status: "PENDING" | "ACCEPTED" | "DECLINED"
): Promise<Result<{ id: string }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  if (!RSVP_VALUES.has(status)) return { success: false, error: "Unknown RSVP status." };
  const guest = await prisma.guest.findFirst({ where: { id: guestId, guestList: { bookingId } }, select: { id: true, guestListId: true } });
  if (!guest) return { success: false, error: "Guest not found." };
  await prisma.guest.update({ where: { id: guest.id }, data: { rsvpStatus: status } });
  await recalcTotals(guest.guestListId);
  revalidateGuestViews(bookingId);
  return { success: true, data: { id: guest.id } };
}

// ------------------------------------------------------------
// Guest app (/app/event/guests) — the host and their co-hosts
// ------------------------------------------------------------

export interface HostGuestRow {
  id: string;
  name: string;
  phone: string | null;
  phoneDisplay: string | null;
  category: string;
  plusOnes: number;
  rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  dietary: string | null;
  /** Checked in at the door by the team — needed so counts match the team's Guest Manager. */
  isCheckedIn: boolean;
  invitation: { invitationStatus: string; sentAt: string | null; rsvpRespondedAt: string | null } | null;
  /** The guest's own RSVP link: only for people who may manage the list, once a link exists and no reply is in. */
  rsvpUrl: string | null;
}

export interface HostGuestListData {
  bookingId: string;
  eventName: string;
  access: BookingAccessKind;
  role: CollaboratorRole | null;
  preview: boolean;
  /** Add guests, record RSVPs, invite, copy/share links. */
  canManage: boolean;
  /** Invites can be attempted: an active WhatsApp configuration exists and the booking's status allows sending. */
  whatsappReady: boolean;
  /** Why this booking can't send WhatsApp invitations (its status), or null. Copying and sharing RSVP links still works. */
  invitesBlockedReason: string | null;
  /** What the invitation says; the client builds share text with the same builder the WhatsApp text uses. */
  invite: InviteDetails;
  guests: HostGuestRow[];
}

const HOST_GUEST_SELECT = {
  id: true,
  guestListId: true,
  name: true,
  phone: true,
  category: true,
  plusOnes: true,
  rsvpStatus: true,
  dietaryRestrictions: true,
  isCheckedIn: true,
  invitation: { select: { invitationStatus: true, sentAt: true, rsvpRespondedAt: true, rsvpToken: true } },
} as const;
type HostGuestRecord = Prisma.GuestGetPayload<{ select: typeof HOST_GUEST_SELECT }>;

function shapeHostGuest(g: HostGuestRecord, canManage: boolean): HostGuestRow {
  const invitation = g.invitation
    ? {
        invitationStatus: String(g.invitation.invitationStatus),
        sentAt: g.invitation.sentAt?.toISOString() ?? null,
        rsvpRespondedAt: g.invitation.rsvpRespondedAt?.toISOString() ?? null,
      }
    : null;
  const facts = { phone: g.phone, rsvpStatus: String(g.rsvpStatus), invitation };
  return {
    id: g.id,
    name: g.name,
    phone: g.phone,
    phoneDisplay: displayPhone(g.phone),
    category: String(g.category),
    plusOnes: g.plusOnes,
    rsvpStatus: g.rsvpStatus as HostGuestRow["rsvpStatus"],
    dietary: g.dietaryRestrictions,
    isCheckedIn: g.isCheckedIn,
    invitation,
    rsvpUrl: canManage && g.invitation && canShareRsvpLink(facts) ? buildRsvpUrl(g.invitation.rsvpToken) : null,
  };
}

/** Why a write is refused, or null when it may go ahead. */
function writeRefusal(access: MyBookingAccess | null, action: BookingAction): string | null {
  if (!access) return "Not authorized.";
  if (access.preview) return PREVIEW_ERROR;
  if (!canDo(access.actions, action)) {
    return access.role === "VIEWER" ? "You can view this guest list, but only the host or a co-host can change it." : "Not authorized.";
  }
  return null;
}

async function guestInBooking(bookingId: string, guestId: unknown): Promise<HostGuestRecord | null> {
  if (typeof guestId !== "string" || !guestId) return null;
  return prisma.guest.findFirst({ where: { id: guestId, guestList: { bookingId } }, select: HOST_GUEST_SELECT });
}

/** The guest list for a booking the caller can see (their default booking when no id is given). */
export async function getHostGuestList(bookingId?: string): Promise<HostGuestListData | null> {
  const access = await getMyBookingAccess(bookingId);
  if (!access || !canDo(access.actions, "guests:view")) return null;
  const [booking, rows, channel] = await Promise.all([
    prisma.booking.findUnique({ where: { id: access.bookingId }, select: INVITE_BOOKING_SELECT }),
    prisma.guest.findMany({ where: { guestList: { bookingId: access.bookingId } }, orderBy: { createdAt: "desc" }, select: HOST_GUEST_SELECT }),
    inviteChannel(),
  ]);
  if (!booking) return null;
  const canManage = !access.preview && canDo(access.actions, "guests:manage");
  // The send path refuses a booking that isn't committed; the screen says why instead of offering Send.
  const invitesBlockedReason = bookingInviteRefusal(booking.status);
  return {
    bookingId: booking.id,
    eventName: booking.eventName,
    access: access.kind,
    role: access.role,
    preview: access.preview,
    canManage,
    whatsappReady: channel.ready && !invitesBlockedReason,
    invitesBlockedReason,
    invite: inviteDetails(booking),
    guests: rows.map((g) => shapeHostGuest(g, canManage)),
  };
}

export interface HostGuestInput {
  name: string;
  phone?: string | null;
  plusOnes?: number;
  category?: string;
}

export async function hostAddGuest(bookingId: string, input: HostGuestInput): Promise<Result<{ guest: HostGuestRow }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };

  const name = String(input?.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2) return { success: false, error: "Enter the guest's name." };
  if (name.length > 120) return { success: false, error: "Keep the name under 120 characters." };
  const plusOnes = Number(input?.plusOnes ?? 0);
  if (!Number.isInteger(plusOnes) || plusOnes < 0 || plusOnes > 20) return { success: false, error: "Plus-ones must be between 0 and 20." };
  const category = String(input?.category ?? "OTHER");
  if (!CATEGORIES.has(category)) return { success: false, error: "Choose a category." };
  const phone = optionalGuestPhone(input?.phone);
  if (!phone.ok) return { success: false, error: phone.error };

  const guestListId = await ensureGuestList(access.bookingId);
  if (phone.phone) {
    const dup = await findPhoneDuplicate(guestListId, phone.phone);
    if (dup) return { success: false, error: `${dup.name} already has this number on your list.` };
  }
  const created = await prisma.guest.create({
    data: { guestListId, name, phone: phone.phone, category: category as GuestCategory, plusOnes },
    select: HOST_GUEST_SELECT,
  });
  await recalcTotals(guestListId);
  await logActivity({ userId: access.userId, action: "created", entityType: "Guest", entityId: created.id, changes: { guestName: name, bookingId: access.bookingId, via: "guest-app" } });
  revalidateGuestViews(access.bookingId);
  return { success: true, data: { guest: shapeHostGuest(created, true) } };
}

export async function hostSetGuestPhone(bookingId: string, guestId: string, rawPhone: string): Promise<Result<{ guest: HostGuestRow }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };
  const guest = await guestInBooking(access.bookingId, guestId);
  if (!guest) return { success: false, error: "Guest not found." };

  const check = checkPhone(rawPhone);
  if (check.kind === "EMPTY") return { success: false, error: "Enter a phone number." };
  if (check.kind === "INVALID") return { success: false, error: check.error };
  const phone = guestPhoneForStorage(check.digits);
  const dup = await findPhoneDuplicate(guest.guestListId, phone, guest.id);
  if (dup) return { success: false, error: `${dup.name} already has this number on your list.` };

  const updated = await prisma.guest.update({ where: { id: guest.id }, data: { phone }, select: HOST_GUEST_SELECT });
  await logActivity({ userId: access.userId, action: "updated", entityType: "Guest", entityId: guest.id, changes: { guestName: guest.name, phone: displayPhone(phone), via: "guest-app" } });
  revalidateGuestViews(access.bookingId);
  return { success: true, data: { guest: shapeHostGuest(updated, true) } };
}

export async function hostSetGuestRsvp(bookingId: string, guestId: string, status: string): Promise<Result<{ guest: HostGuestRow }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };
  if (!RSVP_VALUES.has(status)) return { success: false, error: "Unknown RSVP status." };
  const guest = await guestInBooking(access.bookingId, guestId);
  if (!guest) return { success: false, error: "Guest not found." };

  const updated = await prisma.guest.update({ where: { id: guest.id }, data: { rsvpStatus: status as RSVPStatus }, select: HOST_GUEST_SELECT });
  await recalcTotals(guest.guestListId);
  await logActivity({ userId: access.userId, action: "updated", entityType: "Guest", entityId: guest.id, changes: { guestName: guest.name, rsvpStatus: status, via: "guest-app" } });
  revalidateGuestViews(access.bookingId);
  return { success: true, data: { guest: shapeHostGuest(updated, true) } };
}

export async function hostSendGuestInvite(bookingId: string, guestId: string): Promise<Result<{ guest: HostGuestRow }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };
  const limit = checkRateLimit(`guest-invite:${access.userId}`, SEND_ONE_LIMIT);
  if (!limit.success) return { success: false, error: RATE_LIMITED };

  const [guest, booking] = await Promise.all([
    guestInBooking(access.bookingId, guestId),
    prisma.booking.findUnique({ where: { id: access.bookingId }, select: INVITE_BOOKING_SELECT }),
  ]);
  if (!guest || !booking) return { success: false, error: "Guest not found." };

  const res = await deliverInvitation({ guest, booking, channel: await inviteChannel(), actorId: access.userId, via: "guest-app" });
  if (res.outcome !== "SENT") return { success: false, error: sendErrorMessage(res, guest.name, "guest-app", booking.status) };
  const fresh = (await guestInBooking(access.bookingId, guest.id)) ?? guest;
  revalidateGuestViews(access.bookingId);
  return { success: true, data: { guest: shapeHostGuest(fresh, true) } };
}

export async function hostInviteAllGuests(
  bookingId: string
): Promise<Result<{ summary: InviteAllSummary; message: string; guests: HostGuestRow[] }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };
  const limit = checkRateLimit(`guest-invite-all:${access.userId}`, SEND_ALL_LIMIT);
  if (!limit.success) return { success: false, error: RATE_LIMITED };

  const booking = await prisma.booking.findUnique({ where: { id: access.bookingId }, select: INVITE_BOOKING_SELECT });
  if (!booking) return { success: false, error: "Not authorized." };
  const statusRefusal = bookingInviteRefusal(booking.status);
  if (statusRefusal) return { success: false, error: statusRefusal };
  // Oldest first, so batches go out in the order guests were added.
  const rows = await prisma.guest.findMany({ where: { guestList: { bookingId: booking.id } }, orderBy: { createdAt: "asc" }, select: HOST_GUEST_SELECT });
  const summary = await runInviteAll(rows, booking, access.userId, "guest-app");

  const fresh = await prisma.guest.findMany({ where: { guestList: { bookingId: booking.id } }, orderBy: { createdAt: "desc" }, select: HOST_GUEST_SELECT });
  revalidateGuestViews(booking.id);
  return { success: true, data: { summary, message: inviteAllMessage(summary), guests: fresh.map((g) => shapeHostGuest(g, true)) } };
}

/**
 * The guest's own RSVP link, for the host to copy or share by hand. Creates the
 * invitation row (NOT_SENT) if needed so the link works — and records nothing as
 * sent. The reply still lands on this guest when they answer.
 */
export async function hostGetRsvpLink(bookingId: string, guestId: string): Promise<Result<{ url: string; guest: HostGuestRow }>> {
  const access = await getMyBookingAccess(bookingId);
  const refusal = writeRefusal(access, "guests:manage");
  if (refusal || !access) return { success: false, error: refusal ?? "Not authorized." };
  const guest = await guestInBooking(access.bookingId, guestId);
  if (!guest) return { success: false, error: "Guest not found." };
  const facts = { phone: guest.phone, rsvpStatus: String(guest.rsvpStatus), invitation: guest.invitation };
  if (!canShareRsvpLink(facts)) return { success: false, error: `${guest.name} has already replied.` };

  const inv = await ensureInvitation(guest.id, access.bookingId);
  const fresh = (await guestInBooking(access.bookingId, guest.id)) ?? guest;
  return { success: true, data: { url: buildRsvpUrl(inv.rsvpToken), guest: shapeHostGuest(fresh, true) } };
}
