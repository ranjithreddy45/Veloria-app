"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { getHostScope, getHostUser, isTeamRole, staffCan, type HostBooking, type HostScope } from "@/lib/guest/host-scope";
import {
  asAuthor,
  cleanMessageBody,
  customerAccess,
  excerpt,
  firstNameOf,
  initialsOf,
  isUnreadFor,
  lastOwnIndex,
  receiptFor,
  shouldPingTeam,
  unreadCount,
  visibleRequestEntries,
  type ConciergeAuthor,
  type CustomerAccess,
  type Receipt,
  type RequestEntry,
} from "@/app/(guest)/app/concierge/_lib/concierge-rules";
import {
  fallbackTeamRecipients,
  findThread,
  loadMessages,
  loadPeople,
  loadRequestEntries,
  markReadBy,
  resolveTeamOwner,
  writeCustomerMessage,
  type CustomerMessageResult,
  type MessageRow,
  type Person,
} from "@/app/(guest)/app/concierge/_lib/concierge-server";

// ============================================================
// Guest app: the customer's side of a concierge conversation, and the
// customer's own notifications.
//
// The conversation is the SAME ConciergeThread / ConciergeMessage rows the
// team inbox (/concierge) and the booking panel read. Nothing is copied.
// Identity and booking scope come from getHostScope:
//  - the host (their own booking, or their enquiry before a booking) reads,
//    writes and marks the team's messages as seen;
//  - an invited CO_HOST does the same on that booking's thread only (never the
//    host's pre-booking conversation) and is recorded as the author;
//  - an invited VIEWER has no concierge access (the collaborator permission
//    matrix, enforced here): nothing of the conversation is loaded for them;
//  - a team member previewing (bookings:read by their effective permissions,
//    see getHostScope) only reads and never marks anything as seen: a receipt
//    must mean the customer side really opened it.
// Package and points requests shown in the conversation belong to the
// booking's own customer: co-hosts never get them, and a preview gets each
// kind only with the team access its contents need
// (concierge-rules REQUEST_PREVIEW_PERMISSIONS).
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ConciergeMessageDTO {
  id: string;
  author: ConciergeAuthor;
  body: string;
  createdAt: string;
  /** Written by the signed-in person themself. */
  mine: boolean;
  /**
   * Team messages: the team member's first name. Customer-side messages by
   * someone else on the booking (the host or a co-host): their first name.
   * Never an email address.
   */
  authorName: string | null;
  /** On the customer side's latest message: sent, or seen by the team. */
  receipt: Receipt | null;
  /** A team message nobody on the customer side had opened when this was loaded. */
  unread: boolean;
}

export interface ConciergeBookingDTO {
  id: string;
  eventName: string;
  date: string;
}

export interface CustomerConversation {
  /**
   * READY: a conversation can be read (and, with canSend, written). UNLINKED:
   * this sign-in has no enquiry or booking, so there is nobody to route to.
   * NO_ACCESS: an invited viewer; the conversation is between the host, the
   * co-hosts and the team, so nothing of it is loaded.
   */
  state: "READY" | "UNLINKED" | "NO_ACCESS" | "SIGNED_OUT";
  /** HOST, CO_HOST or VIEWER (invited to the booking), or PREVIEW (a team member). */
  access: CustomerAccess;
  canSend: boolean;
  preview: boolean;
  threadId: string | null;
  threadStatus: "OPEN" | "CLOSED" | null;
  booking: ConciergeBookingDTO | null;
  bookings: ConciergeBookingDTO[];
  /** The real team member messages go to, when one is known. */
  coordinator: { name: string; initials: string; role: string } | null;
  messages: ConciergeMessageDTO[];
  /**
   * Package / redemption requests on the booking, with their live status: for the
   * booking's own customer (and a preview, per kind, with the team access it needs).
   */
  requests: RequestEntry[];
  unread: number;
  /** Co-hosts on the booking (active, not counting the signed-in person): the others who can read this conversation. */
  sharedWith: number;
  /** Server time of this read (ISO). */
  syncedAt: string;
}

export interface CustomerNotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

const PREVIEW_REFUSAL = "Staff preview: this is the customer's screen, so it can't send. Reply from the team inbox instead.";
const VIEWER_REFUSAL = "Messages with the team are for the host and co-hosts of this booking.";

function shapeBooking(b: HostBooking): ConciergeBookingDTO {
  return { id: b.id, eventName: b.eventName, date: b.date.toISOString() };
}

/** Scope for a booking id from the browser. An unknown id falls back to the default booking for READS. */
async function readScope(bookingId: string | null | undefined): Promise<HostScope | null> {
  const id = typeof bookingId === "string" && bookingId ? bookingId : undefined;
  const scope = await getHostScope(id);
  if (scope && id && !scope.booking) return getHostScope();
  return scope;
}

/** What the signed-in person may do on the scope's booking (or enquiry). */
function rightsOf(scope: HostScope) {
  const collaboratorRole = scope.booking ? scope.collaboratorRoles?.[scope.booking.id] ?? null : null;
  return { collaboratorRole, ...customerAccess({ preview: scope.preview, collaboratorRole }) };
}

function customerMessages(rows: MessageRow[], people: Map<string, Person>, viewerId: string): ConciergeMessageDTO[] {
  const lastSide = lastOwnIndex(rows, "CUSTOMER");
  return rows.map((r, i) => {
    const author = asAuthor(r.authorType);
    const mine = author === "CUSTOMER" && r.authorUserId === viewerId;
    const named = author === "STAFF" || (author === "CUSTOMER" && !mine);
    return {
      id: r.id,
      author,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      mine,
      authorName: named && r.authorUserId ? firstNameOf(people.get(r.authorUserId)?.name) : null,
      receipt: i === lastSide ? receiptFor(r, "CUSTOMER") : null,
      unread: isUnreadFor(r, "CUSTOMER"),
    };
  });
}

// ------------------------------------------------------------ conversation

/** The signed-in person's conversation for a booking (or, before any booking, for their enquiry). */
export async function getMyConversation(bookingId?: string | null): Promise<CustomerConversation> {
  const syncedAt = new Date().toISOString();
  const scope = await readScope(bookingId);
  const booking = scope?.booking ?? null;
  const rights = scope ? rightsOf(scope) : null;
  const base: CustomerConversation = {
    state: "SIGNED_OUT",
    access: rights?.access ?? "HOST",
    canSend: false,
    preview: scope?.preview ?? false,
    threadId: null,
    threadStatus: null,
    booking: booking ? shapeBooking(booking) : null,
    bookings: scope ? (scope.preview ? (booking ? [shapeBooking(booking)] : []) : scope.bookings.map(shapeBooking)) : [],
    coordinator: null,
    messages: [],
    requests: [],
    unread: 0,
    sharedWith: 0,
    syncedAt,
  };
  if (!scope || !rights) return base;
  // The collaborator permission matrix, on the server: an invited viewer has no
  // concierge access, so the thread, its requests and its people are never read.
  if (!rights.canRead) return { ...base, state: "NO_ACCESS" };
  const contactIds = booking ? [booking.contactId] : scope.contactIds;
  if (contactIds.length === 0) return { ...base, state: "UNLINKED" };

  const { thread } = await findThread({
    contactIds,
    bookingId: booking?.id ?? null,
    bookingOnly: rights.collaboratorRole !== null,
  });
  // Requests are the booking's own customer's: read only for the host and a preview, then filtered per kind.
  const requestsVisible = rights.access === "HOST" || rights.access === "PREVIEW";
  const [rows, requestRows, ownerId, sharedWith] = await Promise.all([
    thread ? loadMessages(thread.id) : Promise.resolve<MessageRow[]>([]),
    requestsVisible ? loadRequestEntries(booking?.id ?? null) : Promise.resolve<RequestEntry[]>([]),
    resolveTeamOwner({
      assignedToId: thread?.assignedToId ?? null,
      bookingId: booking?.id ?? null,
      contactId: thread?.contactId ?? contactIds[0],
    }),
    booking
      ? prisma.bookingCollaborator.count({
          where: {
            bookingId: booking.id,
            status: "ACTIVE",
            role: "CO_HOST",
            OR: [{ userId: null }, { userId: { not: scope.user.id } }],
          },
        })
      : Promise.resolve(0),
  ]);
  const requests = visibleRequestEntries(requestRows, rights.access, (permission) => staffCan(scope.user, permission));
  const people = await loadPeople([ownerId, ...rows.map((r) => (r.authorUserId !== scope.user.id ? r.authorUserId : null))]);
  const ownerName = ownerId ? people.get(ownerId)?.name ?? null : null;

  return {
    ...base,
    state: "READY",
    canSend: rights.canSend,
    threadId: thread?.id ?? null,
    threadStatus: thread ? (thread.status === "CLOSED" ? "CLOSED" : "OPEN") : null,
    coordinator: ownerName
      ? { name: ownerName, initials: initialsOf(ownerName), role: booking ? "Your coordinator" : "Veloria events team" }
      : null,
    messages: customerMessages(rows, people, scope.user.id),
    requests,
    unread: unreadCount(rows, "CUSTOMER"),
    sharedWith,
  };
}

/**
 * The host or a co-host writes to the team. One transaction writes the
 * message, the thread times and the CLIENT_REQUEST task in the owner's work
 * queue; then the owner (or, with nobody owning it yet, the sales heads) is
 * notified, once per burst of messages.
 */
export async function sendConciergeMessage(input: {
  bookingId?: string | null;
  body: string;
}): Promise<Result<{ threadId: string; message: ConciergeMessageDTO }>> {
  const requested = typeof input?.bookingId === "string" && input.bookingId ? input.bookingId : null;
  const scope = await getHostScope(requested ?? undefined);
  if (!scope) return { success: false, error: "Please sign in." };
  if (scope.preview) return { success: false, error: PREVIEW_REFUSAL };
  if (requested && scope.booking?.id !== requested) return { success: false, error: "Not authorized." };
  const rights = rightsOf(scope);
  if (!rights.canSend) return { success: false, error: VIEWER_REFUSAL };
  const body = cleanMessageBody(input?.body);
  if (!body) return { success: false, error: "Type a message first." };

  const booking = scope.booking;
  const invited = rights.collaboratorRole !== null;
  const contactIds = booking ? [booking.contactId] : scope.contactIds;
  if (contactIds.length === 0) {
    return {
      success: false,
      error: "This sign-in isn't linked to an enquiry or booking yet, so there's nobody to route a message to. Please call or WhatsApp us instead.",
    };
  }
  const limit = checkRateLimit(`concierge-send:${scope.user.id}`, { maxRequests: 20, windowSeconds: 300 });
  if (!limit.success) {
    return { success: false, error: "That's a lot of messages in a few minutes. Please wait a little before sending more." };
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactIds[0] },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!contact) return { success: false, error: "Not authorized." };
  const hostName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
  // The team sees who actually wrote: an invited co-host is named as one.
  const writer = invited ? `${scope.user.name?.trim() || "A co-host"} (co-host)` : hostName || scope.user.name || "A customer";

  let sent: CustomerMessageResult;
  try {
    sent = await writeCustomerMessage({
      customerUserId: scope.user.id,
      contactIds,
      contactId: contact.id,
      bookingId: booking?.id ?? null,
      bookingOnly: invited,
      body,
      subject: booking ? `${booking.eventName} (${hostName || writer})` : writer,
    });
  } catch (err) {
    console.error("[CONCIERGE_SEND]", err);
    return { success: false, error: "Your message couldn't be sent. Please try again." };
  }

  if (shouldPingTeam({ previousCustomerAt: sent.previousCustomerAt, lastStaffAt: sent.previousStaffAt, now: sent.message.createdAt })) {
    const recipients = sent.ownerId ? [sent.ownerId] : await fallbackTeamRecipients().catch(() => [] as string[]);
    const title = `Message from ${writer}${booking ? ` · ${booking.eventName}` : ""}`.slice(0, 160);
    for (const userId of recipients) {
      notify({
        userId,
        type: "TASK_ASSIGNED",
        title,
        message: excerpt(body, 180),
        actionUrl: `/concierge?thread=${sent.thread.id}`,
        metadata: { kind: "CONCIERGE_MESSAGE", threadId: sent.thread.id, taskId: sent.taskId },
      });
    }
  }

  return {
    success: true,
    data: {
      threadId: sent.thread.id,
      message: {
        id: sent.message.id,
        author: "CUSTOMER",
        body: sent.message.body,
        createdAt: sent.message.createdAt.toISOString(),
        mine: true,
        authorName: null,
        receipt: { state: "SENT", at: null },
        unread: false,
      },
    },
  };
}

/**
 * The host or a co-host has opened the conversation: the team's messages
 * become "seen". Viewers and staff previews change nothing.
 */
export async function markConciergeRead(threadId: string): Promise<Result<{ updated: number }>> {
  const scope = await getHostScope();
  if (!scope) return { success: false, error: "Please sign in." };
  if (scope.preview) return { success: true, data: { updated: 0 } };
  if (typeof threadId !== "string" || !threadId) return { success: false, error: "Not found." };
  const thread = await prisma.conciergeThread.findUnique({
    where: { id: threadId },
    select: { id: true, contactId: true, bookingId: true },
  });
  if (!thread) return { success: false, error: "Not found." };
  const own = scope.contactIds.includes(thread.contactId);
  const role = thread.bookingId ? scope.collaboratorRoles?.[thread.bookingId] : undefined;
  if (!own && !role) return { success: false, error: "Not found." };
  const rights = customerAccess({ preview: false, collaboratorRole: own ? null : role });
  // A viewer can't read the conversation, so for them it doesn't exist.
  if (!rights.canRead) return { success: false, error: "Not found." };
  if (!rights.marksSeen) return { success: true, data: { updated: 0 } };
  return { success: true, data: { updated: await markReadBy("CUSTOMER", thread.id) } };
}

/**
 * Team messages the signed-in person hasn't opened, across the conversations
 * they can act on (their own, and bookings where they are a co-host), for a
 * badge. 0 in a staff preview.
 */
export async function getConciergeUnreadCount(): Promise<number> {
  const scope = await getHostScope();
  if (!scope || scope.preview) return 0;
  const coHostBookings = Object.entries(scope.collaboratorRoles ?? {})
    .filter(([, role]) => role === "CO_HOST")
    .map(([id]) => id);
  if (scope.contactIds.length === 0 && coHostBookings.length === 0) return 0;
  const threads = await prisma.conciergeThread.findMany({
    where: {
      OR: [
        ...(scope.contactIds.length > 0 ? [{ contactId: { in: scope.contactIds } }] : []),
        ...(coHostBookings.length > 0 ? [{ bookingId: { in: coHostBookings } }] : []),
      ],
    },
    select: { id: true },
  });
  if (threads.length === 0) return 0;
  return prisma.conciergeMessage.count({
    where: { threadId: { in: threads.map((t) => t.id) }, authorType: "STAFF", customerReadAt: null },
  });
}

// ------------------------------------------------------------ notifications

/**
 * Notifications addressed to the signed-in user's own id. A team member's
 * team alerts stay in the ERP bell: here they see only notices sent to them
 * as a customer.
 */
function notificationScope(userId: string, role: string | null): Prisma.NotificationWhereInput {
  // Any team login, whatever its permissions: a role override must never pull team alerts into the customer app.
  return isTeamRole(role) ? { userId, metadata: { path: ["audience"], equals: "CUSTOMER" } } : { userId };
}

export async function getMyNotifications(): Promise<{ items: CustomerNotificationDTO[]; now: string }> {
  const now = new Date().toISOString();
  const user = await getHostUser();
  if (!user) return { items: [], now };
  const rows = await prisma.notification.findMany({
    where: notificationScope(user.id, user.role),
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, type: true, title: true, message: true, isRead: true, actionUrl: true, createdAt: true },
  });
  return {
    items: rows.map((n) => ({
      id: n.id,
      type: String(n.type),
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      actionUrl: n.actionUrl,
      createdAt: n.createdAt.toISOString(),
    })),
    now,
  };
}

/** Mark the given notifications read (or all of them when no list is passed). Only ever the caller's own. */
export async function markMyNotificationsRead(ids?: string[]): Promise<Result<{ updated: number }>> {
  const user = await getHostUser();
  if (!user) return { success: false, error: "Please sign in." };
  const only = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 200) : null;
  if (only && only.length === 0) return { success: true, data: { updated: 0 } };
  const res = await prisma.notification.updateMany({
    where: { ...notificationScope(user.id, user.role), isRead: false, ...(only ? { id: { in: only } } : {}) },
    data: { isRead: true },
  });
  // The unread count on the home screen reads these rows.
  if (res.count > 0) revalidatePath("/app");
  return { success: true, data: { updated: res.count } };
}
