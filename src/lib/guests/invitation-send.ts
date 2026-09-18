// ============================================================
// Guest invitations on WhatsApp: the ONE send path.
//
// The host portal and the guest app (portal-guest.actions.ts) and the team's
// Guest Manager (invitation.actions.ts) all send through deliverInvitation().
// The action files keep their own front doors (who may act, and the words each
// audience reads). Every rule about the send itself lives here, so the host and
// the team never disagree:
//
//  - Only a committed booking sends: TENTATIVE, CONFIRMED or IN_PROGRESS. A
//    HOLD, a CANCELLED or a COMPLETED booking doesn't (its guest list stays
//    editable).
//  - Who may be invited is guest-invites.ts's rule: a usable phone, not yet
//    invited, no reply on record. A team re-send needs a phone and no reply.
//  - An RSVP token is created once and never replaced, so a link a host has
//    already shared keeps working.
//  - A short lease on whatsappMessageId stops two requests (a host and the
//    team, two tabs) from sending one guest two invitations.
//  - The approved invite template (WhatsAppConfig.guestInviteTemplateName)
//    when one is set, else a text message. Guest, event and host names are
//    capped and stripped of links; the date is formatted in UTC (a @db.Date),
//    the time in IST.
//  - SENT and sentAt are written only after WhatsApp accepted the message. A
//    refusal hands the row back as it was, and a reply that came in while
//    sending keeps its status.
//  - Reminders are scheduled with the first invitation only.
//  - Customer sends (portal, guest app) count against a 24-hour quota per
//    booking and per signed-in customer. Team sends don't.
//  - Bulk sends run a few at a time, and only an accepted send counts as sent.
//
// Server-only (Prisma, WhatsApp). A plain module, not "use server", so both
// action files can import its constants and helpers.
// ============================================================

import type { BookingStatus, InvitationStatus, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sanitizeTemplateParam } from "@/lib/customer-notify";
import { scheduleReminders } from "@/lib/reminder-engine";
import { logActivity } from "@/lib/activity-logger";
import {
  buildInvitationMessage,
  buildInvitationTemplateParams,
  buildRsvpUrl,
} from "@/lib/invitation-message-builder";
import {
  canSendInvite,
  hasReplied,
  hasUsablePhone,
  type InviteOutcome,
} from "@/app/(guest)/app/event/guests/_lib/guest-invites";

// ------------------------------------------------------------ the booking

export const INVITE_BOOKING_SELECT = {
  id: true,
  eventName: true,
  date: true,
  startTime: true,
  status: true,
  venue: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
} as const;
export type InviteBooking = Prisma.BookingGetPayload<{ select: typeof INVITE_BOOKING_SELECT }>;

/** Booking statuses that send invitations: the booking is committed and the event isn't over. */
export const INVITE_SENDABLE_STATUSES: readonly BookingStatus[] = ["TENTATIVE", "CONFIRMED", "IN_PROGRESS"];

/** Why this booking can't send WhatsApp invitations, in words the host and the team can both read; null when it can. */
export function bookingInviteRefusal(status: string): string | null {
  if ((INVITE_SENDABLE_STATUSES as readonly string[]).includes(status)) return null;
  if (status === "CANCELLED") return "This booking is cancelled, so invitations can't be sent.";
  if (status === "COMPLETED") return "This event has already taken place, so invitations can't be sent.";
  return "Invitations can be sent on WhatsApp once the booking is confirmed.";
}

export interface InviteDetails {
  eventName: string;
  eventDate: string;
  eventTime?: string;
  venueName: string;
  hostName: string;
}

/** The event as an invitation describes it, formatted the same whoever sends it. */
export function inviteDetails(
  b: Pick<InviteBooking, "eventName" | "date" | "startTime" | "venue" | "contact">
): InviteDetails {
  return {
    eventName: b.eventName,
    // booking.date is a @db.Date (UTC midnight): format in UTC so the day never shifts.
    eventDate: b.date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    // startTime is an IST wall-clock instant: format in Asia/Kolkata, as the RSVP page does.
    eventTime: b.startTime
      ? b.startTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
      : undefined,
    venueName: b.venue.name,
    hostName: `${b.contact.firstName} ${b.contact.lastName ?? ""}`.trim(),
  };
}

export interface InviteChannel {
  /** An active WhatsApp configuration exists, so a send can be attempted. */
  ready: boolean;
  /** The approved invite template; null sends a text message. */
  templateName: string | null;
}

/** Which WhatsApp path invitations take: the approved invite template when one is set, else a text message. */
export async function inviteChannel(): Promise<InviteChannel> {
  try {
    const c = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { guestInviteTemplateName: true },
    });
    return { ready: !!c, templateName: c?.guestInviteTemplateName?.trim() || null };
  } catch {
    return { ready: false, templateName: null };
  }
}

// ------------------------------------------------------------ what the message says

/** The longest guest, event or host name an invitation carries. */
export const INVITE_NAME_MAX = 60;

// Zero-width and direction marks can split a link so that a filter misses it.
const INVISIBLE_FORMAT = /[­​-‏‪-‮⁠-⁤﻿]/g;
const SCHEME_LINK = /\b[a-z][a-z0-9+.-]*:\/\/\S*/gi;
const WWW_LINK = /\bwww\.\S*/gi;
const IP_LINK = /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?(?:[/?#]\S*)?/g;
// Bare domains ("bit.ly/x", "evil.co.in") are matched on common and link-shortener
// endings only, so dotted initials in names ("A.K.Sharma", "Dr.Rao", "K.Dev") survive.
const LINK_TLDS = [
  "com", "net", "org", "info", "biz", "mobi", "in", "co", "io", "ly", "me", "id", "gy", "gd", "gl", "gg", "to", "cc",
  "tk", "ml", "ga", "cf", "gq", "pw", "ws", "su", "ru", "cn", "us", "uk", "eu", "ca", "au", "fr", "nl", "es", "it",
  "pk", "bd", "lk", "np", "ae", "sa", "sg", "my", "ph", "vn", "th", "tv", "ai", "at", "app", "xyz", "site", "online",
  "top", "club", "shop", "store", "link", "click", "tech", "space", "website", "page", "cloud", "email", "icu", "cyou",
  "sbs", "bond", "lol", "today", "work", "loan", "bid", "win", "fun", "live", "host", "digital", "network", "services",
  "support", "finance", "bank", "pay", "buzz", "monster", "quest", "zip", "mov",
];
const BARE_DOMAIN = new RegExp(
  `\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${LINK_TLDS.join("|")})\\b(?::\\d{1,5})?(?:[/?#]\\S*)?`,
  "gi"
);
const EMPTY_BRACKETS = /[([{<]\s*[)\]}>]/g;
const EDGE_JUNK_START = /^[\s–—:;,|([{<-]+/;
const EDGE_JUNK_END = /[\s–—:;,|([{<-]+$/;

/** Takes the links out of text someone typed: scheme and www. links, bare domains and IP addresses. */
export function stripLinks(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE_FORMAT, "")
    .replace(SCHEME_LINK, " ")
    .replace(WWW_LINK, " ")
    .replace(IP_LINK, " ")
    .replace(BARE_DOMAIN, " ");
}

/**
 * A guest, event or host name as an invitation carries it: one line, no links,
 * at most INVITE_NAME_MAX characters. A name that was nothing but a link becomes
 * `fallback`, because WhatsApp refuses an empty template variable.
 */
export function inviteName(value: string | null | undefined, fallback: string): string {
  const cleaned = stripLinks(value ?? "")
    .replace(EMPTY_BRACKETS, " ")
    .replace(/\s+/g, " ")
    .replace(EDGE_JUNK_START, "")
    .replace(EDGE_JUNK_END, "");
  return sanitizeTemplateParam(cleaned, INVITE_NAME_MAX) || fallback;
}

export interface InviteContent {
  /** The text message, and what the invitation row records as sent. */
  messageContent: string;
  /** The approved template's seven body variables, in order. */
  templateParams: Record<string, string>;
  /** A personal note was given, but the template's wording is fixed, so it isn't sent. */
  noteLeftOut: boolean;
}

/**
 * The invitation's words, for the text message and for the template alike. The
 * RSVP link is ours and passes through; every name a customer could have typed
 * goes through inviteName().
 */
export function buildInviteContent(input: {
  guestName: string;
  details: InviteDetails;
  rsvpLink: string;
  templateName: string | null;
  customMessage?: string;
}): InviteContent {
  const facts = {
    ...input.details,
    guestName: inviteName(input.guestName, "Guest"),
    eventName: inviteName(input.details.eventName, "the celebration"),
    hostName: inviteName(input.details.hostName, "Your host"),
    rsvpLink: input.rsvpLink,
  };
  const note = input.customMessage?.trim() || undefined;
  // An approved template's wording is fixed, so a personal note only travels in a text message.
  const noteLeftOut = !!note && !!input.templateName;
  const messageContent = buildInvitationMessage({ ...facts, customMessage: noteLeftOut ? undefined : note });
  // The template's seven body variables in their approved order ({{1}} guest name, {{2}} event,
  // {{3}} date, {{4}} time or "TBD", {{5}} venue, {{6}} host, {{7}} RSVP link), flattened the way
  // WhatsApp requires (no line breaks, tabs or runs of spaces).
  const templateParams = Object.fromEntries(
    Object.entries(buildInvitationTemplateParams(facts)).map(([k, v]) => [k, sanitizeTemplateParam(v, 500)])
  );
  return { messageContent, templateParams, noteLeftOut };
}

// ------------------------------------------------------------ the invitation row

const INVITATION_SELECT = {
  id: true,
  rsvpToken: true,
  invitationStatus: true,
  sentAt: true,
  rsvpRespondedAt: true,
  whatsappMessageId: true,
} as const;

/** The guest's invitation row, created NOT_SENT with an RSVP token when missing. An existing token is never replaced. */
export async function ensureInvitation(guestId: string, bookingId: string) {
  const existing = await prisma.guestInvitation.findUnique({ where: { guestId }, select: INVITATION_SELECT });
  if (existing) return existing;
  try {
    return await prisma.guestInvitation.create({
      data: { guestId, bookingId, rsvpToken: nanoid(16), invitationStatus: "NOT_SENT" },
      select: INVITATION_SELECT,
    });
  } catch (e) {
    // Another request created it first (one invitation per guest): use that row and its token.
    if ((e as { code?: unknown } | null)?.code === "P2002") {
      const again = await prisma.guestInvitation.findUnique({ where: { guestId }, select: INVITATION_SELECT });
      if (again) return again;
    }
    throw e;
  }
}

/** Written into whatsappMessageId while one request sends. */
export const LEASE_PREFIX = "pending:";
/** A lease older than this was abandoned (its request died), so another send may take the row. */
export const LEASE_STALE_MS = 2 * 60 * 1000;

/** A re-send may go to any invitation the guest hasn't answered through the link. */
const RESENDABLE_STATUSES: InvitationStatus[] = ["NOT_SENT", "SENT", "DELIVERED", "OPENED"];

// ------------------------------------------------------------ customer quotas

/** Owner decision: most WhatsApp invitations sent for one booking in 24 hours before a host or co-host must wait. */
export const CUSTOMER_INVITES_PER_BOOKING = 600;
/** Owner decision: most WhatsApp invitations one signed-in customer may send, across bookings, in 24 hours. */
export const CUSTOMER_INVITES_PER_USER = 800;
export const INVITE_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DAILY_LIMIT_MESSAGE =
  `You've reached the WhatsApp invitation limit for now: ${CUSTOMER_INVITES_PER_BOOKING} per event and ` +
  `${CUSTOMER_INVITES_PER_USER} per account in 24 hours. Send the rest later, or share their RSVP links yourself.`;

/** How many more invitations a customer may send now, given what went out in the last 24 hours. */
export function quotaRemaining(used: { booking: number; user: number }): number {
  return Math.max(0, Math.min(CUSTOMER_INVITES_PER_BOOKING - used.booking, CUSTOMER_INVITES_PER_USER - used.user));
}

/**
 * The customer quota left for this booking and user. The booking's count is every
 * invitation sent for it in 24 hours (GuestInvitation.sentAt, whoever sent it);
 * the user's is their own sends on any booking (the sent_invitation activity).
 */
export async function customerInviteAllowance(bookingId: string, userId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - INVITE_QUOTA_WINDOW_MS);
  const [booking, user] = await Promise.all([
    prisma.guestInvitation.count({ where: { bookingId, sentAt: { gte: since } } }),
    prisma.activityLog.count({
      where: { userId, entityType: "GuestInvitation", action: "sent_invitation", createdAt: { gte: since } },
    }),
  ]);
  return quotaRemaining({ booking, user });
}

// ------------------------------------------------------------ sending one invitation

/** Who is sending: the host portal, the guest app (both customers) or the team. */
export type InviteVia = "portal" | "guest-app" | "team";
export type SendMode = "send" | "resend";

export interface SendGuest {
  id: string;
  name: string;
  phone: string | null;
  rsvpStatus: string;
}

export type SkipReason =
  | "BOOKING_NOT_ACTIVE"
  | "NO_PHONE"
  | "ALREADY_INVITED"
  | "REPLIED"
  | "IN_PROGRESS"
  | "DAILY_LIMIT";

export type SendOutcome =
  | { outcome: "SENT"; invitationId: string; noteLeftOut: boolean }
  | { outcome: "SKIPPED"; reason: SkipReason }
  | { outcome: "FAILED"; error: string };

export type NotSentOutcome = Exclude<SendOutcome, { outcome: "SENT" }>;

/** Provider errors can run long; people need the gist. */
const MAX_REASON_LENGTH = 300;

/** WhatsApp's reason for a refusal, on one line and short enough to show. */
export function shortReason(error: string | undefined): string {
  const text = (error ?? "").replace(/\s+/g, " ").trim() || "WhatsApp gave no answer.";
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…` : text;
}

/**
 * Send (mode "send") or re-send (mode "resend", team only) one guest's invitation
 * on WhatsApp, and record it only if WhatsApp accepted it.
 */
export async function deliverInvitation(input: {
  guest: SendGuest;
  booking: InviteBooking;
  channel: Pick<InviteChannel, "templateName">;
  /** The signed-in user: the customer for portal and guest-app sends, the staff member for team sends. */
  actorId: string;
  via: InviteVia;
  mode?: SendMode;
  /** The team's personal note (text messages only). */
  customMessage?: string;
}): Promise<SendOutcome> {
  const { guest, booking, channel, actorId, via, mode = "send" } = input;
  // The team's log lines keep their STAFF_ prefix.
  const tag = via === "team" ? "STAFF_GUEST_INVITE" : "GUEST_INVITE";

  if (bookingInviteRefusal(booking.status)) return { outcome: "SKIPPED", reason: "BOOKING_NOT_ACTIVE" };
  const to = guest.phone;
  if (!to || !hasUsablePhone(to)) return { outcome: "SKIPPED", reason: "NO_PHONE" };

  const inv = await ensureInvitation(guest.id, booking.id);
  const facts = { phone: to, rsvpStatus: String(guest.rsvpStatus), invitation: inv };
  if (hasReplied(facts)) return { outcome: "SKIPPED", reason: "REPLIED" };
  // A first send only goes to a guest who was never sent one; a re-send to anyone who hasn't replied.
  if (mode === "send" && !canSendInvite(facts)) return { outcome: "SKIPPED", reason: "ALREADY_INVITED" };
  if (via !== "team" && (await customerInviteAllowance(booking.id, actorId)) <= 0) {
    return { outcome: "SKIPPED", reason: "DAILY_LIMIT" };
  }
  const firstSend = inv.invitationStatus === "NOT_SENT";

  // Claim the row for this request. If WhatsApp refuses, the last real message id goes back.
  const previousMessageId =
    inv.whatsappMessageId && !inv.whatsappMessageId.startsWith(LEASE_PREFIX) ? inv.whatsappMessageId : null;
  const lease = `${LEASE_PREFIX}${nanoid(10)}`;
  const claimed = await prisma.guestInvitation.updateMany({
    where: {
      id: inv.id,
      rsvpRespondedAt: null,
      invitationStatus: mode === "send" ? "NOT_SENT" : { in: RESENDABLE_STATUSES },
      OR: [
        { whatsappMessageId: null },
        { NOT: { whatsappMessageId: { startsWith: LEASE_PREFIX } } },
        { updatedAt: { lt: new Date(Date.now() - LEASE_STALE_MS) } },
      ],
    },
    data: { whatsappMessageId: lease },
  });
  if (claimed.count === 0) return { outcome: "SKIPPED", reason: "IN_PROGRESS" };

  const content = buildInviteContent({
    guestName: guest.name,
    details: inviteDetails(booking),
    rsvpLink: buildRsvpUrl(inv.rsvpToken),
    templateName: channel.templateName,
    customMessage: input.customMessage,
  });

  let res: { success: boolean; messageId?: string; error?: string } | undefined;
  try {
    res = channel.templateName
      ? await sendWhatsApp({ to, template: channel.templateName, params: content.templateParams })
      : await sendWhatsApp({ to, message: content.messageContent });
  } catch (e) {
    res = { success: false, error: e instanceof Error ? e.message : "Send failed" };
  }

  if (!res?.success) {
    // Not sent: hand the row back as it was. Status, sentAt and the token are untouched.
    await prisma.guestInvitation
      .updateMany({ where: { id: inv.id, whatsappMessageId: lease }, data: { whatsappMessageId: previousMessageId } })
      .catch((e) => console.error(`[${tag}_RELEASE_ERR]`, e));
    console.error(`[${tag}_NOT_SENT]`, { guestId: guest.id, via, mode, error: res?.error ?? "no result" });
    return { outcome: "FAILED", error: shortReason(res?.error) };
  }

  // WhatsApp accepted it: record the send (even if the lease went stale, the message is out).
  // A reply that came in through the link while this was sending keeps its RSVP status.
  const sent = { sentAt: new Date(), messageContent: content.messageContent, whatsappMessageId: res.messageId ?? null };
  const recorded = await prisma.guestInvitation.updateMany({
    where: { id: inv.id, rsvpRespondedAt: null },
    data: { ...sent, invitationStatus: "SENT" },
  });
  if (recorded.count === 0) await prisma.guestInvitation.update({ where: { id: inv.id }, data: sent });

  // Reminders are scheduled once, with the first invitation: rescheduling on a
  // re-send would rewrite the status of reminders already sent.
  if (firstSend) {
    await scheduleReminders(guest.id, booking.id, booking.date).catch((e) => console.error(`[${tag}_REMIND_ERR]`, e));
  }
  await logActivity({
    userId: actorId,
    action: mode === "resend" ? "resent_invitation" : "sent_invitation",
    entityType: "GuestInvitation",
    entityId: inv.id,
    changes: {
      guestId: guest.id,
      guestName: guest.name,
      bookingId: booking.id,
      via,
      channel: channel.templateName ? "WHATSAPP_TEMPLATE" : "WHATSAPP_TEXT",
    },
  });
  return { outcome: "SENT", invitationId: inv.id, noteLeftOut: content.noteLeftOut };
}

// ------------------------------------------------------------ sending many

/** Invitations sent at the same time by a bulk send. */
export const BULK_SEND_CONCURRENCY = 4;
export const BULK_SEND_ERROR = "Something went wrong while sending.";

/** A bulk send's outcome for one guest. NOT_FOUND: the id isn't on this booking's guest list. */
export type BulkSendOutcome = SendOutcome | { outcome: "SKIPPED"; reason: "NOT_FOUND" };

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * One send per item, BULK_SEND_CONCURRENCY at a time (each waits for WhatsApp's
 * answer; the lease keeps any two from sending the same guest). A send that
 * throws is FAILED, never sent.
 */
export async function sendInBulk<T>(
  items: readonly T[],
  send: (item: T) => Promise<BulkSendOutcome>,
  logTag: string
): Promise<BulkSendOutcome[]> {
  return mapWithConcurrency(items, BULK_SEND_CONCURRENCY, async (item): Promise<BulkSendOutcome> => {
    try {
      return await send(item);
    } catch (e) {
      console.error(logTag, e);
      return { outcome: "FAILED", error: BULK_SEND_ERROR };
    }
  });
}

export interface BulkSendCounts {
  sent: number;
  /** WhatsApp didn't accept it, or the send broke. */
  notAccepted: number;
  needPhone: number;
  /** Not on this booking's guest list. */
  notFound: number;
  alreadyInvited: number;
  inProgress: number;
  replied: number;
  /** The booking can't send invitations (callers check first, so only a status change mid-run). */
  bookingNotActive: number;
  /** Over a customer quota. */
  overLimit: number;
}

export interface BulkSendTally {
  counts: BulkSendCounts;
  /** WhatsApp's reasons for refusing: the first three different ones. */
  reasons: string[];
  /** Nothing new was needed: already invited, already being sent, or already replied. */
  alreadySent: number;
  /** Not sent for any other reason. With `sent` and `alreadySent`, every guest lands in exactly one. */
  failed: number;
  /** A personal note was left out of at least one sent invitation (the template can't carry it). */
  noteLeftOut: boolean;
}

const MAX_REASONS = 3;

/** Honest bulk counts: only an accepted send is "sent", and every guest is counted once. */
export function tallySendOutcomes(outcomes: readonly BulkSendOutcome[]): BulkSendTally {
  const counts: BulkSendCounts = {
    sent: 0,
    notAccepted: 0,
    needPhone: 0,
    notFound: 0,
    alreadyInvited: 0,
    inProgress: 0,
    replied: 0,
    bookingNotActive: 0,
    overLimit: 0,
  };
  const reasons = new Set<string>();
  let noteLeftOut = false;
  for (const o of outcomes) {
    if (o.outcome === "SENT") {
      counts.sent++;
      if (o.noteLeftOut) noteLeftOut = true;
      continue;
    }
    if (o.outcome === "FAILED") {
      counts.notAccepted++;
      if (reasons.size < MAX_REASONS) reasons.add(o.error);
      continue;
    }
    switch (o.reason) {
      case "NO_PHONE":
        counts.needPhone++;
        break;
      case "NOT_FOUND":
        counts.notFound++;
        break;
      case "ALREADY_INVITED":
        counts.alreadyInvited++;
        break;
      case "IN_PROGRESS":
        counts.inProgress++;
        break;
      case "REPLIED":
        counts.replied++;
        break;
      case "BOOKING_NOT_ACTIVE":
        counts.bookingNotActive++;
        break;
      case "DAILY_LIMIT":
        counts.overLimit++;
        break;
    }
  }
  return {
    counts,
    reasons: [...reasons],
    alreadySent: counts.alreadyInvited + counts.inProgress + counts.replied,
    failed: counts.notAccepted + counts.needPhone + counts.notFound + counts.bookingNotActive + counts.overLimit,
    noteLeftOut,
  };
}

/** A send outcome as the host's "Invite all" summary counts it (guest-invites.ts). */
export function inviteOutcomeKind(o: BulkSendOutcome): InviteOutcome {
  if (o.outcome === "SENT") return "SENT";
  if (o.outcome === "FAILED") return "FAILED";
  if (o.reason === "DAILY_LIMIT") return "LIMITED";
  // The booking stopped being able to send mid-run: that guest couldn't be sent, it isn't "in progress".
  if (o.reason === "BOOKING_NOT_ACTIVE") return "FAILED";
  return "SKIPPED";
}
