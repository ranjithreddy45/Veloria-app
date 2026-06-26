"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function isAgent(role?: string) {
  return !!role && hasPermission(role, "hr:write");
}
function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "hr:admin");
}

async function userMap(ids: string[]) {
  const u = [...new Set(ids.filter(Boolean))];
  if (u.length === 0) return new Map<string, { name: string | null; image: string | null }>();
  const users = await prisma.user.findMany({ where: { id: { in: u } }, select: { id: true, name: true, image: true } });
  return new Map(users.map((x) => [x.id, { name: x.name, image: x.image }]));
}

// ---- Categories ----
export async function getHelpdeskCategories() {
  const u = await requireUser();
  if (!u?.id) return [];
  return prisma.helpdeskCategory.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
}

export async function seedHelpdeskCategories(): Promise<Result<{ created: number }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  const defaults = [
    { name: "Payroll & Salary", slaHours: 24, order: 1 },
    { name: "Leave & Attendance", slaHours: 8, order: 2 },
    { name: "IT & Access", slaHours: 4, order: 3 },
    { name: "Documents & Letters", slaHours: 24, order: 4 },
    { name: "General HR", slaHours: 24, order: 5 },
  ];
  let created = 0;
  for (const d of defaults) {
    const exists = await prisma.helpdeskCategory.findFirst({ where: { name: d.name } });
    if (!exists) { await prisma.helpdeskCategory.create({ data: d }); created++; }
  }
  revalidatePath("/people/helpdesk");
  return { success: true, data: { created } };
}

export async function upsertHelpdeskCategory(input: { id?: string; name: string; slaHours: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Name required." };
  const rec = input.id
    ? await prisma.helpdeskCategory.update({ where: { id: input.id }, data: { name: input.name.trim(), slaHours: input.slaHours } })
    : await prisma.helpdeskCategory.create({ data: { name: input.name.trim(), slaHours: input.slaHours || 24 } });
  revalidatePath("/people/helpdesk");
  return { success: true, data: { id: rec.id } };
}

// ---- Tickets ----
export async function createTicket(input: { subject: string; description: string; categoryId?: string; priority?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!input.subject?.trim() || !input.description?.trim()) return { success: false, error: "Subject and description are required." };

  let slaDueAt: Date | null = null;
  if (input.categoryId) {
    const cat = await prisma.helpdeskCategory.findUnique({ where: { id: input.categoryId } });
    if (cat) slaDueAt = new Date(Date.now() + cat.slaHours * 3600000);
  }
  const t = await prisma.helpdeskTicket.create({
    data: {
      subject: input.subject.trim(),
      description: input.description.trim(),
      categoryId: input.categoryId || null,
      requesterId: u.id,
      priority: (input.priority as Prisma.HelpdeskTicketCreateInput["priority"]) || "MEDIUM",
      slaDueAt,
    },
  });
  revalidatePath("/people/helpdesk");
  return { success: true, data: { id: t.id } };
}

export async function getMyTickets() {
  const u = await requireUser();
  if (!u?.id) return { mine: [], assigned: [], isAgent: false };
  const agent = isAgent(u.role);
  const [mine, assigned] = await Promise.all([
    prisma.helpdeskTicket.findMany({ where: { requesterId: u.id }, include: { category: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    agent ? prisma.helpdeskTicket.findMany({ where: { assigneeId: u.id, status: { notIn: ["RESOLVED", "CLOSED"] } }, include: { category: { select: { name: true } } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);
  return { mine, assigned, isAgent: agent };
}

// Agent queue — all open/unassigned (hr:write).
export async function getHelpdeskQueue() {
  const u = await requireUser();
  if (!isAgent(u?.role)) return { rows: [], requesters: {} };
  const rows = await prisma.helpdeskTicket.findMany({
    where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
    include: { category: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
  });
  const map = await userMap(rows.flatMap((r) => [r.requesterId, r.assigneeId ?? ""]));
  return { rows, requesters: Object.fromEntries(map) };
}

export async function getTicket(id: string) {
  const u = await requireUser();
  if (!u?.id) return null;
  const t = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: { category: { select: { name: true } }, comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!t) return null;
  const agent = isAgent(u.role);
  if (t.requesterId !== u.id && !agent) return null; // requester or agent only
  const map = await userMap([t.requesterId, t.assigneeId ?? "", ...t.comments.map((c) => c.authorId)]);
  // Hide internal notes from the requester.
  const comments = t.comments.filter((c) => agent || !c.isInternal);
  return {
    ticket: t,
    comments: comments.map((c) => ({ ...c, author: map.get(c.authorId) ?? { name: "—", image: null } })),
    requester: map.get(t.requesterId) ?? { name: "—", image: null },
    assignee: t.assigneeId ? map.get(t.assigneeId) ?? { name: "—", image: null } : null,
    isAgent: agent,
    myId: u.id,
  };
}

export async function addTicketComment(ticketId: string, body: string, isInternal: boolean): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!body?.trim()) return { success: false, error: "Write something first." };
  const t = await prisma.helpdeskTicket.findUnique({ where: { id: ticketId }, select: { requesterId: true, firstRespondedAt: true } });
  if (!t) return { success: false, error: "Ticket not found." };
  const agent = isAgent(u.role);
  if (t.requesterId !== u.id && !agent) return { success: false, error: "Not authorized." };
  const internal = isInternal && agent; // only agents post internal notes

  await prisma.$transaction(async (tx) => {
    await tx.helpdeskComment.create({ data: { ticketId, authorId: u.id, body: body.trim(), isInternal: internal } });
    if (agent && !t.firstRespondedAt && !internal) {
      await tx.helpdeskTicket.update({ where: { id: ticketId }, data: { firstRespondedAt: new Date() } });
    }
  });
  revalidatePath(`/people/helpdesk/${ticketId}`);
  return { success: true, data: { id: ticketId } };
}

export async function assignTicket(ticketId: string, assigneeId: string | null): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!isAgent(u?.role)) return { success: false, error: "Not authorized." };
  await prisma.helpdeskTicket.update({
    where: { id: ticketId },
    data: { assigneeId: assigneeId || u!.id, status: "IN_PROGRESS" },
  });
  revalidatePath(`/people/helpdesk/${ticketId}`);
  revalidatePath("/people/helpdesk");
  return { success: true, data: { id: ticketId } };
}

export async function setTicketStatus(ticketId: string, status: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const valid = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
  if (!valid.includes(status)) return { success: false, error: "Invalid status." };
  const t = await prisma.helpdeskTicket.findUnique({ where: { id: ticketId }, select: { requesterId: true } });
  if (!t) return { success: false, error: "Not found." };
  const agent = isAgent(u.role);
  // Requester may only close/reopen their own; agents do anything.
  if (!agent && t.requesterId !== u.id) return { success: false, error: "Not authorized." };
  if (!agent && !["CLOSED", "OPEN"].includes(status)) return { success: false, error: "Only an agent can set that status." };

  // Stamp resolvedAt when entering RESOLVED; clear it on any reopen so a
  // reopened (or re-resolved) ticket never keeps a stale resolution time.
  // CLOSED preserves the existing resolvedAt (undefined = leave unchanged).
  await prisma.helpdeskTicket.update({
    where: { id: ticketId },
    data: {
      status: status as Prisma.HelpdeskTicketUpdateInput["status"],
      resolvedAt:
        status === "RESOLVED"
          ? new Date()
          : status === "OPEN" || status === "IN_PROGRESS" || status === "WAITING"
            ? null
            : undefined,
    },
  });
  revalidatePath(`/people/helpdesk/${ticketId}`);
  revalidatePath("/people/helpdesk");
  return { success: true, data: { id: ticketId } };
}

export async function setTicketPriority(ticketId: string, priority: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!isAgent(u?.role)) return { success: false, error: "Not authorized." };
  const valid = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  if (!valid.includes(priority)) return { success: false, error: "Invalid priority." };
  await prisma.helpdeskTicket.update({ where: { id: ticketId }, data: { priority: priority as Prisma.HelpdeskTicketUpdateInput["priority"] } });
  revalidatePath(`/people/helpdesk/${ticketId}`);
  return { success: true, data: { id: ticketId } };
}

// ---- Knowledge base ----
export async function getArticles() {
  const u = await requireUser();
  if (!u?.id) return [];
  const agent = isAgent(u.role);
  return prisma.helpdeskArticle.findMany({
    where: agent ? undefined : { isPublished: true },
    include: { category: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertArticle(input: { id?: string; title: string; body: string; categoryId?: string; isPublished?: boolean }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.title?.trim() || !input.body?.trim()) return { success: false, error: "Title and body required." };
  const data = { title: input.title.trim(), body: input.body, categoryId: input.categoryId || null, isPublished: input.isPublished ?? true };
  const rec = input.id ? await prisma.helpdeskArticle.update({ where: { id: input.id }, data }) : await prisma.helpdeskArticle.create({ data });
  revalidatePath("/people/helpdesk");
  return { success: true, data: { id: rec.id } };
}
