"use server";

import { UserRole } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import {
  describeCustomerReach,
  notifyCustomerDetailed,
  type WhatsAppOutcome,
  type WhatsAppSkipReason,
} from "@/lib/customer-notify";
import {
  asAuthor,
  cleanMessageBody,
  excerpt,
  firstNameOf,
  type ConciergeAuthor,
  type RequestEntry,
} from "@/app/(guest)/app/concierge/_lib/concierge-rules";
import {
  THREAD_SELECT,
  assignThread,
  findThread,
  latestTaskFor,
  loadMessages,
  loadPeople,
  loadRequestEntries,
  markReadBy,
  setThreadStatus,
  writeTeamMessage,
  type TeamMessageInput,
  type ThreadRow,
} from "@/app/(guest)/app/concierge/_lib/concierge-server";

// ============================================================
// Team concierge inbox: the team's side of the customer conversations.
//
// Reads and writes the SAME ConciergeThread / ConciergeMessage rows the
// customer app shows; nothing is copied. Reading needs bookings:read; replying,
// assigning and closing need bookings:update or communications:create, checked
// the way middleware does (admins pass; session permissions, which include
// role overrides, win over the role defaults). Staff-wide visibility is by
// design in this single-company ERP. Writes are logged to ActivityLog.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const READ = "bookings:read";
const WRITE = ["bookings:update", "communications:create"] as const;

interface TeamUser {
  id: string;
  role: string;
  perms: string[] | null;
}

async function teamUser(): Promise<TeamUser | null> {
  const s = await auth();
  const u = s?.user as { id?: string; role?: string; perms?: unknown } | undefined;
  if (!u?.id) return null;
  return {
    id: u.id,
    role: u.role ?? "",
    perms: Array.isArray(u.perms) ? u.perms.filter((p): p is string => typeof p === "string") : null,
  };
}

function can(u: TeamUser, permission: string): boolean {
  if (!u.role || u.role === "CLIENT" || u.role === "VENDOR") return false;
  if (u.role === "SUPER_ADMIN" || u.role === "ADMIN") return true;
  return u.perms ? u.perms.includes("*") || u.perms.includes(permission) : hasPermission(u.role, permission);
}
const canRead = (u: TeamUser) => can(u, READ);
const canWrite = (u: TeamUser) => canRead(u) && WRITE.some((p) => can(u, p));

const UNAUTHORIZED = { success: false as const, error: "Unauthorized" };
const NO_READ = { success: false as const, error: "You don't have access to customer conversations." };
const NO_WRITE = { success: false as const, error: "You don't have permission to message customers." };
const NOT_FOUND = { success: false as const, error: "Conversation not found." };

// ------------------------------------------------------------ DTOs

export type InboxAssigneeFilter = "mine" | "unassigned" | "all";
export type InboxStatusFilter = "OPEN" | "CLOSED" | "ALL";

export interface InboxThreadRow {
  id: string;
  status: "OPEN" | "CLOSED";
  contactId: string;
  contactName: string;
  bookingId: string | null;
  bookingNumber: string | null;
  eventName: string | null;
  eventDate: string | null;
  assignedToId: string | null;
  assigneeName: string | null;
  lastMessageAt: string;
  lastMessage: { author: ConciergeAuthor; excerpt: string } | null;
  /** Customer messages nobody on the team has opened. */
  unread: number;
  /** Open, and the customer wrote after the team's last reply. */
  waitingOnTeam: boolean;
}

export interface InboxCounts {
  mineOpen: number;
  unassignedOpen: number;
  allOpen: number;
  unreadConversations: number;
}

export interface InboxMessage {
  id: string;
  author: ConciergeAuthor;
  body: string;
  createdAt: string;
  /**
   * STAFF / SYSTEM lines: the team member's name. Customer messages: "Name · co-host"
   * when someone the host invited wrote it; null when the host wrote it.
   */
  authorName: string | null;
  /** STAFF: when the customer opened it. CUSTOMER: when the team first opened it. */
  seenAt: string | null;
}

export type WhatsAppReach = { ready: true; phone: string } | { ready: false; reason: WhatsAppSkipReason };

export interface CustomerReachDTO {
  /** Customer app sign-ins that get an in-app notice; null when it couldn't be checked. */
  appLogins: number | null;
  /** null when it couldn't be checked. */
  whatsapp: WhatsAppReach | null;
}

export interface InboxThreadDetail {
  thread: InboxThreadRow;
  contact: { id: string; name: string; phone: string | null; email: string | null };
  booking: { id: string; bookingNumber: string; eventName: string; date: string; status: string } | null;
  messages: InboxMessage[];
  requests: RequestEntry[];
  /** The newest work-queue task mirroring this conversation. */
  task: { id: string; status: string } | null;
  reach: CustomerReachDTO;
}

export interface PanelThreadOption {
  id: string;
  label: string;
  status: "OPEN" | "CLOSED";
  unread: number;
}

export interface ConciergePanelData {
  canReply: boolean;
  target: { contactId: string; bookingId: string | null; contactName: string };
  /** A contact's conversations (contact page). Empty on a booking panel, which has at most one. */
  threads: PanelThreadOption[];
  detail: InboxThreadDetail | null;
  reach: CustomerReachDTO;
}

export interface ReplyResult {
  threadId: string;
  message: InboxMessage;
  /** What actually happened, so the screen can tell staff the truth. */
  delivery: { inApp: number; whatsapp: WhatsAppOutcome };
}

export interface AssigneeOption {
  id: string;
  name: string;
  role: string;
}

// ------------------------------------------------------------ shaping

function fullName(c: { firstName: string; lastName: string | null; company?: string | null } | null | undefined): string {
  if (!c) return "Unknown contact";
  return `${c.firstName} ${c.lastName ?? ""}`.trim() || c.company || "Unnamed contact";
}

async function shapeRows(rows: ThreadRow[]): Promise<InboxThreadRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const contactIds = [...new Set(rows.map((r) => r.contactId))];
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter((id): id is string => Boolean(id)))];
  const [contacts, bookings, people, unread, latest] = await Promise.all([
    prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, company: true },
    }),
    bookingIds.length > 0
      ? prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, bookingNumber: true, eventName: true, date: true },
        })
      : Promise.resolve([] as { id: string; bookingNumber: string; eventName: string; date: Date }[]),
    loadPeople(rows.map((r) => r.assignedToId)),
    prisma.conciergeMessage.groupBy({
      by: ["threadId"],
      where: { threadId: { in: ids }, authorType: "CUSTOMER", staffReadAt: null },
      _count: { _all: true },
    }),
    prisma.conciergeMessage.groupBy({
      by: ["threadId"],
      where: { threadId: { in: ids }, authorType: { in: ["CUSTOMER", "STAFF"] } },
      _max: { createdAt: true },
    }),
  ]);

  const lastKeys = latest.flatMap((g) => (g._max.createdAt ? [{ threadId: g.threadId, createdAt: g._max.createdAt }] : []));
  const lastRows =
    lastKeys.length > 0
      ? await prisma.conciergeMessage.findMany({
          where: { OR: lastKeys },
          select: { threadId: true, authorType: true, body: true, createdAt: true },
        })
      : [];

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const unreadMap = new Map(unread.map((g) => [g.threadId, g._count._all]));
  const lastMap = new Map<string, { authorType: string; body: string; createdAt: Date }>();
  for (const m of lastRows) {
    const current = lastMap.get(m.threadId);
    if (!current || current.createdAt < m.createdAt) lastMap.set(m.threadId, m);
  }

  return rows.map((r): InboxThreadRow => {
    const booking = r.bookingId ? bookingMap.get(r.bookingId) : undefined;
    const last = lastMap.get(r.id);
    const assignee = r.assignedToId ? people.get(r.assignedToId) : undefined;
    return {
      id: r.id,
      status: r.status === "CLOSED" ? "CLOSED" : "OPEN",
      contactId: r.contactId,
      contactName: fullName(contactMap.get(r.contactId)),
      bookingId: r.bookingId,
      bookingNumber: booking?.bookingNumber ?? null,
      eventName: booking?.eventName ?? null,
      eventDate: booking ? booking.date.toISOString() : null,
      assignedToId: r.assignedToId,
      assigneeName: assignee ? assignee.name ?? assignee.email : null,
      lastMessageAt: r.lastMessageAt.toISOString(),
      lastMessage: last ? { author: asAuthor(last.authorType), excerpt: excerpt(last.body, 120) } : null,
      unread: unreadMap.get(r.id) ?? 0,
      waitingOnTeam: r.status !== "CLOSED" && !!r.lastCustomerAt && (!r.lastStaffAt || r.lastCustomerAt > r.lastStaffAt),
    };
  });
}

async function reachFor(contactId: string, bookingId: string | null): Promise<CustomerReachDTO> {
  // The audience a reply goes to (replyToConcierge): the host and the booking's co-hosts, never viewers.
  const r = await describeCustomerReach(contactId, bookingId, "HOST_AND_CO_HOSTS");
  const whatsapp: WhatsAppReach | null =
    r.whatsapp === null ? null : r.whatsapp.send ? { ready: true, phone: r.whatsapp.to } : { ready: false, reason: r.whatsapp.reason };
  return { appLogins: r.appLogins, whatsapp };
}

async function buildDetail(thread: ThreadRow): Promise<InboxThreadDetail> {
  const [rows, messages, requests, contact, booking, task, reach] = await Promise.all([
    shapeRows([thread]),
    loadMessages(thread.id),
    loadRequestEntries(thread.bookingId),
    prisma.contact.findUnique({
      where: { id: thread.contactId },
      select: { id: true, firstName: true, lastName: true, company: true, phone: true, email: true },
    }),
    thread.bookingId
      ? prisma.booking.findUnique({
          where: { id: thread.bookingId },
          select: { id: true, bookingNumber: true, eventName: true, date: true, status: true },
        })
      : Promise.resolve(null),
    latestTaskFor(thread.id),
    reachFor(thread.contactId, thread.bookingId),
  ]);
  const customerAuthors = [...new Set(messages.flatMap((m) => (m.authorType === "CUSTOMER" && m.authorUserId ? [m.authorUserId] : [])))];
  const [people, collaborators] = await Promise.all([
    loadPeople(messages.map((m) => m.authorUserId)),
    thread.bookingId && customerAuthors.length > 0
      ? prisma.bookingCollaborator.findMany({
          where: { bookingId: thread.bookingId, userId: { in: customerAuthors } },
          select: { userId: true, role: true, name: true },
        })
      : Promise.resolve([] as { userId: string | null; role: string; name: string | null }[]),
  ]);
  // A customer-side message from someone the host invited carries their name, so the team sees who wrote it.
  const invited = new Map(collaborators.flatMap((c) => (c.userId ? [[c.userId, c] as const] : [])));
  const invitedAuthorLabel = (userId: string | null): string | null => {
    const c = userId ? invited.get(userId) : undefined;
    if (!c || !userId) return null;
    const name = c.name?.trim() || people.get(userId)?.name || "Invited guest";
    return `${name} · ${c.role === "CO_HOST" ? "co-host" : "viewer"}`;
  };
  return {
    thread: rows[0],
    contact: { id: thread.contactId, name: fullName(contact), phone: contact?.phone ?? null, email: contact?.email ?? null },
    booking: booking
      ? {
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          eventName: booking.eventName,
          date: booking.date.toISOString(),
          status: String(booking.status),
        }
      : null,
    messages: messages.map((m): InboxMessage => {
      const author = asAuthor(m.authorType);
      const person = m.authorUserId ? people.get(m.authorUserId) : undefined;
      return {
        id: m.id,
        author,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        authorName: author === "CUSTOMER" ? invitedAuthorLabel(m.authorUserId) : person ? person.name ?? person.email : null,
        seenAt:
          author === "STAFF"
            ? m.customerReadAt?.toISOString() ?? null
            : author === "CUSTOMER"
              ? m.staffReadAt?.toISOString() ?? null
              : null,
      };
    }),
    requests,
    task,
    reach,
  };
}

async function resolveTarget(input: {
  bookingId?: string | null;
  contactId?: string | null;
}): Promise<ConciergePanelData["target"] | null> {
  if (typeof input.bookingId === "string" && input.bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, contactId: true, contact: { select: { firstName: true, lastName: true, company: true } } },
    });
    return b ? { contactId: b.contactId, bookingId: b.id, contactName: fullName(b.contact) } : null;
  }
  if (typeof input.contactId === "string" && input.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: input.contactId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, company: true },
    });
    return c ? { contactId: c.id, bookingId: null, contactName: fullName(c) } : null;
  }
  return null;
}

// ------------------------------------------------------------ reads

export async function listConciergeThreads(filter?: {
  assignee?: InboxAssigneeFilter;
  status?: InboxStatusFilter;
}): Promise<Result<{ threads: InboxThreadRow[]; counts: InboxCounts; canReply: boolean }>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canRead(u)) return NO_READ;
  const assignee: InboxAssigneeFilter = filter?.assignee === "mine" || filter?.assignee === "unassigned" ? filter.assignee : "all";
  const status: InboxStatusFilter = filter?.status === "CLOSED" || filter?.status === "ALL" ? filter.status : "OPEN";

  const rows = await prisma.conciergeThread.findMany({
    where: {
      ...(status === "ALL" ? {} : { status }),
      ...(assignee === "mine" ? { assignedToId: u.id } : assignee === "unassigned" ? { assignedToId: null } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 150,
    select: THREAD_SELECT,
  });
  const [threads, mineOpen, unassignedOpen, allOpen, unreadGroups] = await Promise.all([
    shapeRows(rows),
    prisma.conciergeThread.count({ where: { status: "OPEN", assignedToId: u.id } }),
    prisma.conciergeThread.count({ where: { status: "OPEN", assignedToId: null } }),
    prisma.conciergeThread.count({ where: { status: "OPEN" } }),
    prisma.conciergeMessage.groupBy({ by: ["threadId"], where: { authorType: "CUSTOMER", staffReadAt: null } }),
  ]);
  return {
    success: true,
    data: {
      threads,
      counts: { mineOpen, unassignedOpen, allOpen, unreadConversations: unreadGroups.length },
      canReply: canWrite(u),
    },
  };
}

/** Conversations with customer messages nobody on the team has opened (for a navigation badge). */
export async function getConciergeInboxBadge(): Promise<number> {
  const u = await teamUser();
  if (!u || !canRead(u)) return 0;
  const groups = await prisma.conciergeMessage.groupBy({
    by: ["threadId"],
    where: { authorType: "CUSTOMER", staffReadAt: null },
  });
  return groups.length;
}

/** One conversation. With markRead, the customer's messages are recorded as opened by the team. */
export async function getConciergeThread(threadId: string, opts?: { markRead?: boolean }): Promise<Result<InboxThreadDetail>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canRead(u)) return NO_READ;
  if (typeof threadId !== "string" || !threadId) return NOT_FOUND;
  const thread = await prisma.conciergeThread.findUnique({ where: { id: threadId }, select: THREAD_SELECT });
  if (!thread) return NOT_FOUND;
  if (opts?.markRead) await markReadBy("STAFF", thread.id);
  return { success: true, data: await buildDetail(thread) };
}

/** The conversation for a booking, or a contact's conversations, for the panel on those pages. */
export async function getConciergePanel(
  input: { bookingId?: string | null; contactId?: string | null; threadId?: string | null },
  opts?: { markRead?: boolean }
): Promise<Result<ConciergePanelData>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canRead(u)) return NO_READ;
  const target = await resolveTarget(input ?? {});
  if (!target) return { success: false, error: "Booking or contact not found." };

  let thread: ThreadRow | null = null;
  let threads: PanelThreadOption[] = [];
  if (target.bookingId) {
    thread = (await findThread({ contactIds: [target.contactId], bookingId: target.bookingId })).thread;
  } else {
    const all = await prisma.conciergeThread.findMany({
      where: { contactId: target.contactId },
      orderBy: { lastMessageAt: "desc" },
      take: 20,
      select: THREAD_SELECT,
    });
    threads = (await shapeRows(all)).map((t) => ({
      id: t.id,
      label: t.bookingNumber ? `${t.eventName ?? "Booking"} · ${t.bookingNumber}` : "Before a booking",
      status: t.status,
      unread: t.unread,
    }));
    thread = all.find((t) => t.id === input?.threadId) ?? all[0] ?? null;
  }
  if (thread && opts?.markRead) await markReadBy("STAFF", thread.id);
  const detail = thread ? await buildDetail(thread) : null;
  return {
    success: true,
    data: {
      canReply: canWrite(u),
      target,
      threads,
      detail,
      reach: detail?.reach ?? (await reachFor(target.contactId, target.bookingId)),
    },
  };
}

export async function getConciergeAssignees(): Promise<Result<AssigneeOption[]>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canRead(u)) return NO_READ;
  const roles = (Object.values(UserRole) as UserRole[]).filter(
    (r) => r !== "CLIENT" && r !== "VENDOR" && hasPermission(r, READ) && WRITE.some((p) => hasPermission(r, p))
  );
  const rows = await prisma.user.findMany({
    where: { isActive: true, role: { in: roles } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: 300,
  });
  return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name ?? r.email, role: String(r.role) })) };
}

// ------------------------------------------------------------ writes

/**
 * The team replies. One transaction writes the message, marks the customer's
 * earlier messages as read by the team, reopens / claims the thread and moves
 * its task to in progress. Then the customer is notified (in-app, push, and
 * WhatsApp when set up) and the result reports what really happened.
 * Give a threadId, or a bookingId / contactId to continue or start the
 * conversation from a booking or contact page.
 */
export async function replyToConcierge(input: {
  threadId?: string | null;
  bookingId?: string | null;
  contactId?: string | null;
  body: string;
}): Promise<Result<ReplyResult>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canWrite(u)) return NO_WRITE;
  const body = cleanMessageBody(input?.body);
  if (!body) return { success: false, error: "Type a reply first." };

  const place = input.bookingId || input.contactId ? await resolveTarget(input) : null;
  let where: Pick<TeamMessageInput, "threadId" | "contactId" | "bookingId">;
  if (typeof input.threadId === "string" && input.threadId) {
    where = { threadId: input.threadId };
    if (place?.bookingId) {
      // Replying on a booking page inside the customer's pre-booking thread carries that thread over to the booking.
      const t = await prisma.conciergeThread.findUnique({ where: { id: input.threadId }, select: { contactId: true, bookingId: true } });
      if (t && !t.bookingId && t.contactId === place.contactId) where = { contactId: place.contactId, bookingId: place.bookingId };
    }
  } else if (place) {
    where = { contactId: place.contactId, bookingId: place.bookingId };
  } else {
    return NOT_FOUND;
  }

  let written: Awaited<ReturnType<typeof writeTeamMessage>>;
  try {
    written = await writeTeamMessage({ staffUserId: u.id, body, ...where });
  } catch (err) {
    console.error("[CONCIERGE_REPLY]", err);
    return { success: false, error: "The reply couldn't be saved. Please try again." };
  }
  if (!written) return NOT_FOUND;
  const { thread, message, taskId } = written;

  const me = (await loadPeople([u.id])).get(u.id);
  const first = firstNameOf(me?.name);
  const delivery = await notifyCustomerDetailed({
    contactId: thread.contactId,
    bookingId: thread.bookingId,
    type: "BOOKING_UPDATED",
    title: first ? `${first} from Veloria replied` : "The Veloria team replied",
    message: excerpt(body, 180),
    actionUrl: thread.bookingId ? `/app/concierge?booking=${thread.bookingId}` : "/app/concierge",
    // Only people who may read the conversation: invited viewers have no concierge access.
    audience: "HOST_AND_CO_HOSTS",
  });

  await logActivity({
    userId: u.id,
    action: "concierge_reply",
    entityType: "ConciergeThread",
    entityId: thread.id,
    changes: {
      messageId: message.id,
      contactId: thread.contactId,
      bookingId: thread.bookingId,
      taskId,
      inAppNotified: delivery.inApp,
      whatsapp: delivery.whatsapp.status,
    },
  });

  return {
    success: true,
    data: {
      threadId: thread.id,
      message: {
        id: message.id,
        author: "STAFF",
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        authorName: me ? me.name ?? me.email : null,
        seenAt: null,
      },
      delivery,
    },
  };
}

export async function assignConciergeThread(
  threadId: string,
  assigneeId: string | null
): Promise<Result<{ assignedToId: string | null; assigneeName: string | null }>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canWrite(u)) return NO_WRITE;
  if (typeof threadId !== "string" || !threadId) return NOT_FOUND;
  const nextId = typeof assigneeId === "string" && assigneeId ? assigneeId : null;

  let assigneeName: string | null = null;
  if (nextId) {
    const person = await prisma.user.findUnique({
      where: { id: nextId },
      select: { name: true, email: true, isActive: true, role: true },
    });
    if (!person || !person.isActive || person.role === "CLIENT" || person.role === "VENDOR" || !hasPermission(person.role, READ)) {
      return { success: false, error: "Choose an active team member who can see bookings." };
    }
    assigneeName = person.name ?? person.email;
  }

  const res = await assignThread(threadId, nextId);
  if (!res) return NOT_FOUND;
  if (nextId && nextId !== u.id && nextId !== res.previousAssigneeId) {
    const contact = await prisma.contact.findUnique({
      where: { id: res.thread.contactId },
      select: { firstName: true, lastName: true, company: true },
    });
    notify({
      userId: nextId,
      type: "TASK_ASSIGNED",
      title: `Customer conversation assigned to you: ${fullName(contact)}`.slice(0, 160),
      message: "Open the concierge inbox to read and reply.",
      actionUrl: `/concierge?thread=${res.thread.id}`,
      metadata: { kind: "CONCIERGE_ASSIGNED", threadId: res.thread.id },
    });
  }
  await logActivity({
    userId: u.id,
    action: "concierge_assigned",
    entityType: "ConciergeThread",
    entityId: res.thread.id,
    changes: { from: res.previousAssigneeId, to: nextId },
  });
  return { success: true, data: { assignedToId: nextId, assigneeName } };
}

/** Close (resolved) or reopen. Closing completes the conversation's task; both leave a line in the conversation. */
export async function setConciergeThreadStatus(
  threadId: string,
  status: "OPEN" | "CLOSED"
): Promise<Result<{ status: "OPEN" | "CLOSED" }>> {
  const u = await teamUser();
  if (!u) return UNAUTHORIZED;
  if (!canWrite(u)) return NO_WRITE;
  if (status !== "OPEN" && status !== "CLOSED") return { success: false, error: "Unknown status." };
  if (typeof threadId !== "string" || !threadId) return NOT_FOUND;
  const res = await setThreadStatus({ threadId, status, staffUserId: u.id });
  if (!res) return NOT_FOUND;
  if (res.changed) {
    await logActivity({
      userId: u.id,
      action: status === "CLOSED" ? "concierge_closed" : "concierge_reopened",
      entityType: "ConciergeThread",
      entityId: threadId,
      changes: { status },
    });
  }
  return { success: true, data: { status } };
}
