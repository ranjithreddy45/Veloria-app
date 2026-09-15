import { Prisma } from "@prisma/client";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  pickThread,
  requestEntries,
  taskActionForCustomerMessage,
  taskStatusAfterTeamReply,
  type ConciergeViewer,
  type RequestEntry,
} from "./concierge-rules";

// ============================================================
// Concierge data layer: the ONE place conversation rows are read and written.
//
// Server-only (Prisma). Used by guest-concierge.actions (the customer) and
// concierge-inbox.actions (the team), so both sides write the same rows the
// same way. Deliberately NOT a "use server" file: nothing in here checks who
// is calling, so none of it may become a browser-callable action. Callers
// authorize first, then call these.
// ============================================================

export const THREAD_SELECT = {
  id: true,
  contactId: true,
  bookingId: true,
  status: true,
  assignedToId: true,
  lastMessageAt: true,
  lastCustomerAt: true,
  lastStaffAt: true,
  createdAt: true,
} as const;
export type ThreadRow = Prisma.ConciergeThreadGetPayload<{ select: typeof THREAD_SELECT }>;

export const MESSAGE_SELECT = {
  id: true,
  threadId: true,
  authorType: true,
  authorUserId: true,
  body: true,
  customerReadAt: true,
  staffReadAt: true,
  createdAt: true,
} as const;
export type MessageRow = Prisma.ConciergeMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

type Db = Prisma.TransactionClient;

/** Newest messages loaded into a screen; older history stays in the database. */
export const CONVERSATION_LIMIT = 300;

/** The CLIENT_REQUEST task(s) that mirror a conversation in the team's work queue. */
function conversationTasks(threadId: string): Prisma.TaskWhereInput {
  return { taskType: "CLIENT_REQUEST", metadata: { path: ["threadId"], equals: threadId } };
}

/** Serializable transaction, retried on a Postgres serialization failure (P2034), as payment-split does. */
async function serializable<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2034" || attempt >= 2) throw e;
    }
  }
}

// ------------------------------------------------------------ reads

/** The thread a conversation lives in (see pickThread), without writing anything. */
export async function findThread(
  target: { contactIds: string[]; bookingId: string | null; bookingOnly?: boolean },
  db: Db = prisma
): Promise<{ thread: ThreadRow | null; attachBooking: boolean }> {
  if (target.contactIds.length === 0) return { thread: null, attachBooking: false };
  const rows = await db.conciergeThread.findMany({
    where: {
      contactId: { in: target.contactIds },
      OR: target.bookingId
        ? target.bookingOnly
          ? [{ bookingId: target.bookingId }]
          : [{ bookingId: target.bookingId }, { bookingId: null }]
        : [{ bookingId: null }],
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    select: THREAD_SELECT,
  });
  return pickThread(rows, target);
}

export async function loadMessages(threadId: string): Promise<MessageRow[]> {
  const rows = await prisma.conciergeMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: CONVERSATION_LIMIT,
    select: MESSAGE_SELECT,
  });
  return rows.reverse();
}

/** Package / redemption / older requests on the booking, as conversation entries with their live status. */
export async function loadRequestEntries(bookingId: string | null): Promise<RequestEntry[]> {
  if (!bookingId) return [];
  const tasks = await prisma.task.findMany({
    where: { bookingId, taskType: "CLIENT_REQUEST" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, title: true, description: true, status: true, createdAt: true, metadata: true },
  });
  return requestEntries(tasks);
}

/** The newest work-queue task mirroring this conversation (any status). */
export async function latestTaskFor(threadId: string): Promise<{ id: string; status: string } | null> {
  return prisma.task.findFirst({ where: conversationTasks(threadId), orderBy: { createdAt: "desc" }, select: { id: true, status: true } });
}

export interface Person {
  name: string | null;
  email: string;
}

export async function loadPeople(ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, Person>();
  if (unique.length === 0) return map;
  const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  for (const u of rows) map.set(u.id, { name: u.name?.trim() || null, email: u.email });
  return map;
}

/**
 * Who on the team looks after a conversation: the thread's assignee; else the
 * coordinator on the booking's event operation; else the booking owner; else
 * (no booking yet) the salesperson on the contact's latest lead. Inactive
 * accounts are skipped. null = nobody yet (the inbox lists it as unassigned).
 */
export async function resolveTeamOwner(
  input: { assignedToId: string | null; bookingId: string | null; contactId: string },
  db: Db = prisma
): Promise<string | null> {
  if (input.assignedToId) {
    const u = await db.user.findUnique({ where: { id: input.assignedToId }, select: { isActive: true, role: true } });
    if (u?.isActive && u.role !== "CLIENT" && u.role !== "VENDOR") return input.assignedToId;
  }
  if (input.bookingId) {
    const [op, booking] = await Promise.all([
      db.eventOperation.findUnique({
        where: { bookingId: input.bookingId },
        select: { staffAssignments: { select: { role: true, userId: true, user: { select: { isActive: true } } } } },
      }),
      db.booking.findUnique({
        where: { id: input.bookingId },
        select: { createdById: true, createdBy: { select: { isActive: true } } },
      }),
    ]);
    const coordinator = op?.staffAssignments.find((s) => /coordinat/i.test(s.role) && s.user.isActive);
    if (coordinator) return coordinator.userId;
    if (booking?.createdBy.isActive) return booking.createdById;
  }
  const lead = await db.lead.findFirst({
    where: { contactId: input.contactId, assignedTo: { isActive: true } },
    orderBy: { updatedAt: "desc" },
    select: { assignedToId: true },
  });
  return lead?.assignedToId ?? null;
}

/** Nobody owns the conversation yet: the sales heads hear about it (admins if there are none), so a message never sits unseen. */
export async function fallbackTeamRecipients(): Promise<string[]> {
  const heads = await prisma.user.findMany({ where: { role: "SALES_HEAD", isActive: true }, select: { id: true }, take: 10 });
  if (heads.length > 0) return heads.map((u) => u.id);
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
    take: 10,
  });
  return admins.map((u) => u.id);
}

// ------------------------------------------------------------ writes

/** Marks the other side's messages as opened by `viewer`. Returns how many changed. */
export async function markReadBy(viewer: ConciergeViewer, threadId: string): Promise<number> {
  const now = new Date();
  const res =
    viewer === "CUSTOMER"
      ? await prisma.conciergeMessage.updateMany({
          where: { threadId, authorType: "STAFF", customerReadAt: null },
          data: { customerReadAt: now },
        })
      : await prisma.conciergeMessage.updateMany({
          where: { threadId, authorType: "CUSTOMER", staffReadAt: null },
          data: { staffReadAt: now },
        });
  return res.count;
}

export interface CustomerMessageInput {
  customerUserId: string;
  /** Contacts the customer may act for (just the booking's contact when there is a booking). */
  contactIds: string[];
  /** Contact a brand-new thread is keyed to. */
  contactId: string;
  bookingId: string | null;
  body: string;
  /** Short subject for the work-queue task title, e.g. "Reception (Priya Sharma)". */
  subject: string;
  /** Invited collaborator: only the booking's own thread (the host's pre-booking conversation stays private). */
  bookingOnly?: boolean;
}

export interface CustomerMessageResult {
  thread: ThreadRow;
  message: MessageRow;
  taskId: string;
  /** The team member the conversation is with, or null when nobody owns it yet. */
  ownerId: string | null;
  /** Thread times BEFORE this message (for the ping rule). */
  previousCustomerAt: Date | null;
  previousStaffAt: Date | null;
}

/**
 * A customer message, atomically: find or create the thread, write the
 * message (authored by the signed-in login, host or co-host), bump the
 * thread's times, and create or update the CLIENT_REQUEST task
 * (metadata.threadId) in the owner's work queue. Notifying is the caller's
 * job, after this commits.
 */
export async function writeCustomerMessage(input: CustomerMessageInput): Promise<CustomerMessageResult> {
  const target = { contactIds: input.contactIds, bookingId: input.bookingId, bookingOnly: input.bookingOnly ?? false };
  // Owner lookups are plain reads, kept out of the serializable section.
  const before = await findThread(target);
  const resolvedOwner = await resolveTeamOwner({
    assignedToId: before.thread?.assignedToId ?? null,
    bookingId: input.bookingId,
    contactId: before.thread?.contactId ?? input.contactId,
  });

  return serializable(async (tx) => {
    const now = new Date();
    const pick = await findThread(target, tx);
    let thread = pick.thread;
    // Keep a live assignee; replace one resolveTeamOwner skipped as inactive.
    const staleAssignee =
      !!thread?.assignedToId && thread.assignedToId === before.thread?.assignedToId && resolvedOwner !== thread.assignedToId;
    const ownerId = thread?.assignedToId && !staleAssignee ? thread.assignedToId : resolvedOwner;
    const previousCustomerAt = thread?.lastCustomerAt ?? null;
    const previousStaffAt = thread?.lastStaffAt ?? null;

    if (!thread) {
      thread = await tx.conciergeThread.create({
        data: {
          contactId: input.contactId,
          bookingId: input.bookingId,
          status: "OPEN",
          assignedToId: ownerId,
          lastMessageAt: now,
          lastCustomerAt: now,
        },
        select: THREAD_SELECT,
      });
    } else {
      thread = await tx.conciergeThread.update({
        where: { id: thread.id },
        data: {
          status: "OPEN",
          lastMessageAt: now,
          lastCustomerAt: now,
          ...(pick.attachBooking && input.bookingId ? { bookingId: input.bookingId } : {}),
          ...(ownerId !== thread.assignedToId ? { assignedToId: ownerId } : {}),
        },
        select: THREAD_SELECT,
      });
    }

    const message = await tx.conciergeMessage.create({
      data: { threadId: thread.id, authorType: "CUSTOMER", authorUserId: input.customerUserId, body: input.body, createdAt: now },
      select: MESSAGE_SELECT,
    });

    const latest = await tx.task.findFirst({
      where: conversationTasks(thread.id),
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, assigneeId: true },
    });
    const metadata: Prisma.InputJsonValue = {
      kind: "MESSAGE",
      via: "guest-concierge",
      threadId: thread.id,
      contactId: thread.contactId,
      fromUserId: input.customerUserId,
      lastMessageId: message.id,
    };
    let taskId: string;
    if (latest && taskActionForCustomerMessage(latest) === "UPDATE") {
      await tx.task.update({
        where: { id: latest.id },
        data: { description: input.body, bookingId: thread.bookingId, assigneeId: latest.assigneeId ?? ownerId, metadata },
      });
      taskId = latest.id;
    } else {
      const created = await tx.task.create({
        data: {
          title: `Concierge message · ${input.subject}`.slice(0, 200),
          description: input.body,
          status: "TODO",
          priority: "MEDIUM",
          taskType: "CLIENT_REQUEST",
          bookingId: thread.bookingId,
          creatorId: input.customerUserId,
          assigneeId: ownerId,
          metadata,
        },
        select: { id: true },
      });
      taskId = created.id;
    }

    return { thread, message, taskId, ownerId: thread.assignedToId, previousCustomerAt, previousStaffAt };
  });
}

export interface TeamMessageInput {
  staffUserId: string;
  body: string;
  /** Reply inside an existing conversation… */
  threadId?: string | null;
  /** …or continue / start the conversation for a contact (and booking) from a panel. */
  contactId?: string | null;
  bookingId?: string | null;
}

/**
 * A team reply, atomically: resolve (or start) the thread, write the message,
 * mark what the customer sent before it as read by the team, reopen and
 * claim an unassigned thread, and move the open task from to-do to in
 * progress. Returns null when the thread does not exist.
 */
export async function writeTeamMessage(
  input: TeamMessageInput
): Promise<{ thread: ThreadRow; message: MessageRow; taskId: string | null } | null> {
  return serializable(async (tx) => {
    const now = new Date();
    let thread: ThreadRow | null = null;
    if (input.threadId) {
      thread = await tx.conciergeThread.findUnique({ where: { id: input.threadId }, select: THREAD_SELECT });
    } else if (input.contactId) {
      const pick = await findThread({ contactIds: [input.contactId], bookingId: input.bookingId ?? null }, tx);
      thread = pick.thread;
      if (thread && pick.attachBooking && input.bookingId) {
        thread = await tx.conciergeThread.update({
          where: { id: thread.id },
          data: { bookingId: input.bookingId },
          select: THREAD_SELECT,
        });
      }
      if (!thread) {
        thread = await tx.conciergeThread.create({
          data: {
            contactId: input.contactId,
            bookingId: input.bookingId ?? null,
            status: "OPEN",
            assignedToId: input.staffUserId,
            lastMessageAt: now,
          },
          select: THREAD_SELECT,
        });
      }
    }
    if (!thread) return null;

    const message = await tx.conciergeMessage.create({
      data: { threadId: thread.id, authorType: "STAFF", authorUserId: input.staffUserId, body: input.body, createdAt: now },
      select: MESSAGE_SELECT,
    });
    // Replying means the team has read everything the customer sent before it.
    await tx.conciergeMessage.updateMany({
      where: { threadId: thread.id, authorType: "CUSTOMER", staffReadAt: null, createdAt: { lte: now } },
      data: { staffReadAt: now },
    });
    const updated = await tx.conciergeThread.update({
      where: { id: thread.id },
      data: {
        status: "OPEN",
        lastMessageAt: now,
        lastStaffAt: now,
        ...(thread.assignedToId ? {} : { assignedToId: input.staffUserId }),
      },
      select: THREAD_SELECT,
    });

    const task = await tx.task.findFirst({
      where: { ...conversationTasks(updated.id), status: { not: "DONE" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, assigneeId: true },
    });
    if (task) {
      const next = taskStatusAfterTeamReply(task.status) as TaskStatus;
      if (next !== task.status || !task.assigneeId) {
        await tx.task.update({
          where: { id: task.id },
          data: { status: next, assigneeId: task.assigneeId ?? updated.assignedToId },
        });
      }
    }
    return { thread: updated, message, taskId: task?.id ?? null };
  });
}

/**
 * Close or reopen. A SYSTEM line records it in the conversation both sides
 * read; closing completes the conversation's open task. Returns null when the
 * thread does not exist; `changed` is false when it was already in that state.
 */
export async function setThreadStatus(input: {
  threadId: string;
  status: "OPEN" | "CLOSED";
  staffUserId: string;
}): Promise<{ thread: ThreadRow; changed: boolean } | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conciergeThread.findUnique({ where: { id: input.threadId }, select: THREAD_SELECT });
    if (!current) return null;
    if (current.status === input.status) return { thread: current, changed: false };
    const now = new Date();
    const thread = await tx.conciergeThread.update({
      where: { id: current.id },
      data: { status: input.status },
      select: THREAD_SELECT,
    });
    await tx.conciergeMessage.create({
      data: {
        threadId: current.id,
        authorType: "SYSTEM",
        authorUserId: input.staffUserId,
        body: input.status === "CLOSED" ? "The team marked this conversation as resolved." : "The team reopened this conversation.",
        createdAt: now,
      },
    });
    if (input.status === "CLOSED") {
      await tx.task.updateMany({
        where: { ...conversationTasks(current.id), status: { not: "DONE" } },
        data: { status: "DONE", completedAt: now },
      });
    }
    return { thread, changed: true };
  });
}

/** Assign (or unassign) a conversation; its open task follows, so the work queue and the inbox agree. */
export async function assignThread(
  threadId: string,
  assigneeId: string | null
): Promise<{ previousAssigneeId: string | null; thread: ThreadRow } | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conciergeThread.findUnique({ where: { id: threadId }, select: THREAD_SELECT });
    if (!current) return null;
    const thread = await tx.conciergeThread.update({
      where: { id: threadId },
      data: { assignedToId: assigneeId },
      select: THREAD_SELECT,
    });
    await tx.task.updateMany({
      where: { ...conversationTasks(threadId), status: { not: "DONE" } },
      data: { assigneeId },
    });
    return { previousAssigneeId: current.assignedToId, thread };
  });
}
