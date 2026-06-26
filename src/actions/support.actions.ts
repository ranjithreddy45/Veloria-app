"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { assertTransition } from "@/lib/ops/state-machine";

// ============================================================
// Customer Support / Ticketing actions
// ------------------------------------------------------------
// Reads gated to `support:read`, writes to `support:write`.
// All Date values are serialized to ISO strings at the action
// boundary so client components never touch a Date instance.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];
const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

// Staff who can own/handle a ticket. Mirrors the assignable-role pattern used
// elsewhere (lead.actions ASSIGNABLE_ROLES) but scoped to support handlers.
// MUST be valid UserRole enum values — Prisma throws on an unknown enum in an
// `in` filter, which would break getTicketFormOptions entirely. These are the
// roles that actually carry support:write.
const ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "EVENT_COORDINATOR",
  "OPERATIONS",
];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

const canRead = (r?: string) => !!r && hasPermission(r, "support:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "support:write");

function statusHueless(s: string): TicketStatus | null {
  return (TICKET_STATUSES as readonly string[]).includes(s) ? (s as TicketStatus) : null;
}

// Resolve a User's display name by id (cached per-call via the passed map).
async function resolveNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  for (const u of users) map.set(u.id, u.name || u.email || "User");
  return map;
}

async function resolveContactNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const contacts = await prisma.contact.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true, company: true },
  });
  for (const c of contacts) {
    const full = `${c.firstName} ${c.lastName}`.trim();
    map.set(c.id, full || c.company || "Contact");
  }
  return map;
}

// ------------------------------------------------------------
// DTOs
// ------------------------------------------------------------
export interface TicketRow {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  contactId: string | null;
  contactName: string | null;
  assignedToId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessageDTO {
  id: string;
  body: string;
  internal: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface TicketDTO extends TicketRow {
  description: string | null;
  bookingId: string | null;
  createdById: string;
  createdByName: string;
  resolvedAt: string | null;
  messages: TicketMessageDTO[];
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
// Default page size for the ticket list. Bounds an otherwise unbounded
// findMany so a system with thousands of tickets does not serialize them all.
const DEFAULT_TICKET_LIMIT = 100;
const MAX_TICKET_LIMIT = 200;

export async function getTickets(opts?: {
  status?: string;
  limit?: number;
}): Promise<Result<TicketRow[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const where: Prisma.SupportTicketWhereInput = {};
  if (opts?.status && statusHueless(opts.status)) where.status = opts.status;

  const rawLimit = Number(opts?.limit);
  const take =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_TICKET_LIMIT)
      : DEFAULT_TICKET_LIMIT;

  const rows = await prisma.supportTicket.findMany({
    where,
    take,
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      contactId: true,
      assignedToId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const names = await resolveNames(rows.map((r) => r.assignedToId ?? "").filter(Boolean));
  const contactNames = await resolveContactNames(
    rows.map((r) => r.contactId ?? "").filter(Boolean)
  );

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      ticketNumber: r.ticketNumber,
      subject: r.subject,
      status: r.status as TicketStatus,
      priority: r.priority as TicketPriority,
      category: r.category ?? null,
      contactId: r.contactId ?? null,
      contactName: r.contactId ? contactNames.get(r.contactId) ?? null : null,
      assignedToId: r.assignedToId ?? null,
      assigneeName: r.assignedToId ? names.get(r.assignedToId) ?? null : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function getTicket(id: string): Promise<Result<TicketDTO>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!t) return { success: false, error: "Ticket not found" };

  const userIds = [
    t.createdById,
    ...(t.assignedToId ? [t.assignedToId] : []),
    ...t.messages.map((m) => m.authorId),
  ];
  const names = await resolveNames(userIds);
  const contactNames = await resolveContactNames(t.contactId ? [t.contactId] : []);

  return {
    success: true,
    data: {
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      description: t.description ?? null,
      status: t.status as TicketStatus,
      priority: t.priority as TicketPriority,
      category: t.category ?? null,
      contactId: t.contactId ?? null,
      contactName: t.contactId ? contactNames.get(t.contactId) ?? null : null,
      bookingId: t.bookingId ?? null,
      assignedToId: t.assignedToId ?? null,
      assigneeName: t.assignedToId ? names.get(t.assignedToId) ?? null : null,
      createdById: t.createdById,
      createdByName: names.get(t.createdById) ?? "User",
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messages: t.messages.map((m) => ({
        id: m.id,
        body: m.body,
        internal: m.internal,
        authorId: m.authorId,
        authorName: names.get(m.authorId) ?? "User",
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };
}

export async function getTicketFormOptions(): Promise<
  Result<{
    contacts: { id: string; name: string }[];
    staff: { id: string; name: string }[];
  }>
> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const [contacts, staff] = await Promise.all([
    prisma.contact.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true, company: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ASSIGNABLE_ROLES as unknown as never } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    success: true,
    data: {
      contacts: contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim() || c.company || "Contact",
      })),
      staff: staff.map((s) => ({ id: s.id, name: s.name || s.email || "User" })),
    },
  };
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------

// Allocate a TKT-YYYY-NNNN number. We seed NNNN from this year's count and
// retry on a unique-constraint collision (concurrent creates) by bumping the
// sequence — the same count()+P2002 retry pattern used for invoice/quote numbers.
async function allocateTicketNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `TKT-${year}-`;
  const countThisYear = await prisma.supportTicket.count({
    where: { ticketNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}

export async function createTicket(input: {
  subject: string;
  description?: string;
  priority: string;
  category?: string;
  contactId?: string;
  bookingId?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const subject = input.subject?.trim();
  if (!subject) return { success: false, error: "Subject is required" };
  const priority: TicketPriority = (TICKET_PRIORITIES as readonly string[]).includes(
    input.priority
  )
    ? (input.priority as TicketPriority)
    : "MEDIUM";
  const description = input.description?.trim() || null;

  // Validate optional foreign references exist before persisting. The schema
  // does not enforce these as FK constraints, so a bad id would otherwise
  // create an orphaned reference that breaks name resolution downstream.
  const contactId = input.contactId?.trim() || null;
  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!contact) return { success: false, error: "Selected contact is not available" };
  }
  const bookingId = input.bookingId?.trim() || null;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true },
    });
    if (!booking) return { success: false, error: "Selected booking was not found" };
  }

  // Link to the per-booking EventOperation aggregate root if one exists.
  const op = bookingId
    ? await prisma.eventOperation.findUnique({ where: { bookingId }, select: { id: true } })
    : null;

  // Retry loop guards against a concurrent allocation racing to the same number.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ticketNumber = await allocateTicketNumber();
    const bumped =
      attempt === 0
        ? ticketNumber
        : `${ticketNumber.slice(0, ticketNumber.lastIndexOf("-") + 1)}${String(
            Number(ticketNumber.slice(ticketNumber.lastIndexOf("-") + 1)) + attempt
          ).padStart(4, "0")}`;
    try {
      const created = await prisma.supportTicket.create({
        data: {
          ticketNumber: bumped,
          subject,
          description,
          status: "OPEN",
          priority,
          category: input.category?.trim() || null,
          contactId,
          bookingId,
          operationId: op?.id ?? null,
          createdById: u.id,
          // Seed the opening message from the description, if provided.
          ...(description
            ? {
                messages: {
                  create: { body: description, internal: false, authorId: u.id },
                },
              }
            : {}),
        },
        select: { id: true },
      });
      revalidatePath("/support");
      return { success: true, data: { id: created.id } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        lastErr = err;
        continue; // collision on ticketNumber — retry with a fresh count
      }
      throw err;
    }
  }
  return {
    success: false,
    error: lastErr ? "Could not allocate a ticket number, please retry." : "Failed to create ticket",
  };
}

export async function addTicketMessage(
  ticketId: string,
  input: { body: string; internal: boolean }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const body = input.body?.trim();
  if (!body) return { success: false, error: "Message body is required" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) return { success: false, error: "Ticket not found" };

  const internal = !!input.internal;

  const msg = await prisma.supportTicketMessage.create({
    data: { ticketId, body, internal, authorId: u.id },
    select: { id: true },
  });

  // A public (non-internal) reply on a RESOLVED/CLOSED ticket reopens it to
  // IN_PROGRESS — the customer responded, so it needs handling again.
  // Internal notes never change status.
  if (!internal && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "IN_PROGRESS", resolvedAt: null },
    });
  } else {
    // Touch updatedAt so the list re-sorts.
    await prisma.supportTicket.update({ where: { id: ticketId }, data: {} });
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { success: true, data: { id: msg.id } };
}

// Allowed status transitions. CLOSED is terminal except via a customer reply
// (handled in addTicketMessage); manual reopening from RESOLVED/CLOSED is
// permitted back to OPEN/IN_PROGRESS by an agent.
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED", "OPEN"],
  CLOSED: ["OPEN", "IN_PROGRESS"],
};

export async function setTicketStatus(
  id: string,
  status: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const next = statusHueless(status);
  if (!next) return { success: false, error: "Invalid status" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ticket) return { success: false, error: "Ticket not found" };

  const current = ticket.status as TicketStatus;
  if (current === next) return { success: true, data: { id } }; // no-op
  const gate = assertTransition("support", current, next);
  if (!gate.ok) return { success: false, error: gate.error! };
  if (!TRANSITIONS[current]?.includes(next)) {
    return { success: false, error: `Cannot move a ${current} ticket to ${next}` };
  }

  await prisma.supportTicket.update({
    where: { id },
    data: {
      status: next,
      // Stamp resolvedAt when entering RESOLVED; clear it on any reopen.
      resolvedAt: next === "RESOLVED" ? new Date() : next === "CLOSED" ? undefined : null,
    },
  });

  revalidatePath(`/support/${id}`);
  revalidatePath("/support");
  return { success: true, data: { id } };
}

export async function assignTicket(
  id: string,
  userId: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!ticket) return { success: false, error: "Ticket not found" };

  if (userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, role: true },
    });
    if (!target || !target.isActive) {
      return { success: false, error: "Selected user is not available" };
    }
    if (!canWrite(target.role)) {
      return {
        success: false,
        error: "Selected user cannot be assigned support tickets",
      };
    }
  }

  await prisma.supportTicket.update({
    where: { id },
    data: { assignedToId: userId || null },
  });

  revalidatePath(`/support/${id}`);
  revalidatePath("/support");
  return { success: true, data: { id } };
}
