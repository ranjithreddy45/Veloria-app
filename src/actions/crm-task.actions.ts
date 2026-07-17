"use server";

// ============================================================
// CRM tasks — schedule a follow-up / call / meeting / show-around against a
// lead, inquiry or enquiry (Contact), surface them in a personal calendar, and
// update status. Reuses the Task model (leadId/inquiryId/contactId/taskType/
// metadata). Every scope goes through scheduleCrmTask, so every scope lands on
// /calendar (getMyCalendarTasks) and notifies the assignee identically.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };
type TaskType = "FOLLOW_UP" | "CALL" | "MEETING" | "SHOW_AROUND" | "TASK";

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) return null;
  return s.user as { id: string; name?: string | null; role?: string };
}

const TYPE_LABEL: Record<string, string> = {
  FOLLOW_UP: "Follow-up", CALL: "Call", MEETING: "Meeting", SHOW_AROUND: "Show-around / venue tour", TASK: "Task",
};

/** Which permission guards this scope. Enquiry (Contact) tasks are gated on
 *  contacts:* — some roles hold contacts access without any lead access. */
function scopeOf(params: { leadId?: string; inquiryId?: string; contactId?: string }) {
  if (params.leadId || params.inquiryId) {
    return { ok: true as const, read: "leads:read" as const, write: "leads:update" as const };
  }
  if (params.contactId) {
    return { ok: true as const, read: "contacts:read" as const, write: "contacts:update" as const };
  }
  return { ok: false as const };
}

export interface ShowAroundMeta {
  ownerId?: string | null; // hall owner to invite
  ownerInvited?: boolean;
  inviteeIds?: string[]; // internal team members tagged
  location?: string | null;
}

export async function scheduleCrmTask(input: {
  leadId?: string;
  inquiryId?: string;
  contactId?: string;
  taskType: TaskType;
  title: string;
  dueDate: string; // ISO
  assigneeId?: string | null; // default: self
  description?: string | null;
  metadata?: ShowAroundMeta | null;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const scope = scopeOf(input);
  if (!scope.ok) return { success: false, error: "A lead or enquiry is required." };
  if (!hasPermission(u.role ?? "", scope.write)) return { success: false, error: "You don't have permission to schedule tasks." };

  // Untrusted input — whitelist the type before it reaches Prisma.
  if (!TYPE_LABEL[input.taskType]) return { success: false, error: "Invalid task type." };
  const title = (input.title ?? "").trim() || TYPE_LABEL[input.taskType] || "Task";
  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return { success: false, error: "Pick a valid date/time." };
  const assigneeId = input.assigneeId || u.id;

  const task = await prisma.task.create({
    data: {
      title, description: input.description ?? null, status: "TODO", dueDate: due,
      taskType: input.taskType, leadId: input.leadId ?? null, inquiryId: input.inquiryId ?? null,
      contactId: input.contactId ?? null,
      assigneeId, creatorId: u.id,
      metadata: input.metadata ? (input.metadata as unknown as object) : undefined,
    },
    select: { id: true },
  });

  const whenStr = due.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  // Notify the assignee (if not self).
  if (assigneeId !== u.id) {
    notify({ userId: assigneeId, type: "TASK_ASSIGNED", title: `New ${TYPE_LABEL[input.taskType] ?? "task"}: ${title}`, message: `Scheduled for ${whenStr}.`, actionUrl: "/calendar" });
  }
  // Show-around: notify the tagged internal team members (owner invite handled by UI/email).
  if (input.taskType === "SHOW_AROUND" && input.metadata?.inviteeIds?.length) {
    // Dedupe + cap to bound the number of notification writes per request.
    const invitees = [...new Set(input.metadata.inviteeIds.filter((x) => typeof x === "string" && x))].slice(0, 50);
    for (const uid of invitees) {
      if (uid === u.id) continue;
      notify({ userId: uid, type: "TASK_ASSIGNED", title: `Show-around invite: ${title}`, message: `You're tagged for a venue tour on ${whenStr}${input.metadata.location ? ` at ${input.metadata.location}` : ""}.`, actionUrl: "/calendar" });
    }
  }

  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.contactId) revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/calendar");
  revalidatePath("/inquiries");
  return { success: true, data: { id: task.id } };
}

export interface CalendarTaskDTO {
  id: string;
  title: string;
  taskType: string | null;
  status: string;
  dueDate: string;
  leadId: string | null;
  inquiryId: string | null;
  contactId: string | null;
  isOverdue: boolean;
}

/** The current user's scheduled tasks (assigned to them) in a date window, for a calendar. */
export async function getMyCalendarTasks(fromISO: string, toISO: string): Promise<Result<CalendarTaskDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { success: false, error: "Invalid range" };

  const rows = await prisma.task.findMany({
    where: { assigneeId: u.id, dueDate: { gte: from, lte: to } },
    orderBy: { dueDate: "asc" },
    select: { id: true, title: true, taskType: true, status: true, dueDate: true, leadId: true, inquiryId: true, contactId: true },
    take: 500,
  });
  const now = Date.now();
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id, title: r.title, taskType: r.taskType, status: r.status,
      dueDate: r.dueDate!.toISOString(), leadId: r.leadId, inquiryId: r.inquiryId, contactId: r.contactId,
      isOverdue: r.status !== "DONE" && !!r.dueDate && r.dueDate.getTime() < now,
    })),
  };
}

export interface CrmEntityTaskDTO extends CalendarTaskDTO {
  assigneeName: string | null;
}

/** Scheduled reminders on one lead / inquiry / enquiry (Contact), soonest first.
 *  Unlike getMyCalendarTasks this is record-scoped, not assignee-scoped: the
 *  detail page shows what the whole team has booked against this record. */
export async function listCrmTasksFor(params: {
  leadId?: string; inquiryId?: string; contactId?: string; includeDone?: boolean;
}): Promise<Result<CrmEntityTaskDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const scope = scopeOf(params);
  if (!scope.ok) return { success: false, error: "A lead or enquiry is required." };
  if (!hasPermission(u.role ?? "", scope.read)) return { success: false, error: "Insufficient permissions" };

  const rows = await prisma.task.findMany({
    where: {
      leadId: params.leadId ?? undefined,
      inquiryId: params.inquiryId ?? undefined,
      contactId: params.contactId ?? undefined,
      dueDate: { not: null },
      ...(params.includeDone ? {} : { status: { not: "DONE" } }),
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true, title: true, taskType: true, status: true, dueDate: true,
      leadId: true, inquiryId: true, contactId: true,
      assignee: { select: { name: true } },
    },
    take: 50,
  });
  const now = Date.now();
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id, title: r.title, taskType: r.taskType, status: r.status,
      dueDate: r.dueDate!.toISOString(), leadId: r.leadId, inquiryId: r.inquiryId, contactId: r.contactId,
      assigneeName: r.assignee?.name ?? null,
      isOverdue: r.status !== "DONE" && !!r.dueDate && r.dueDate.getTime() < now,
    })),
  };
}

export interface CrmScheduleOptions {
  users: { id: string; name: string | null; role: string }[];
  owners: { id: string; name: string }[];
}

/** Active internal users (to tag) + hall owners (to invite) for the show-around scheduler. */
export async function getCrmScheduleOptions(): Promise<Result<CrmScheduleOptions>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  // Widened: the same scheduler now serves enquiries (Contacts), which some
  // roles can reach without lead access.
  if (!hasPermission(u.role ?? "", "leads:read") && !hasPermission(u.role ?? "", "contacts:read")) {
    return { success: false, error: "Insufficient permissions" };
  }
  const [users, owners] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" }, take: 300 }),
    prisma.hallOwner.findMany({ select: { id: true, ownerName: true }, orderBy: { ownerName: "asc" }, take: 300 }).catch(() => []),
  ]);
  return { success: true, data: { users, owners: owners.map((o) => ({ id: o.id, name: o.ownerName })) } };
}

export async function updateCrmTaskStatus(id: string, status: "TODO" | "IN_PROGRESS" | "DONE"): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  // Server actions receive untrusted input — whitelist the status before it hits Prisma.
  if (status !== "TODO" && status !== "IN_PROGRESS" && status !== "DONE") return { success: false, error: "Invalid status." };
  if (!id || typeof id !== "string") return { success: false, error: "Invalid task." };
  const t = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true, creatorId: true, leadId: true, contactId: true } });
  if (!t) return { success: false, error: "Task not found." };
  const isAdmin = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
  if (t.assigneeId !== u.id && t.creatorId !== u.id && !isAdmin) return { success: false, error: "Not your task." };
  await prisma.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  if (t.leadId) revalidatePath(`/leads/${t.leadId}`);
  if (t.contactId) revalidatePath(`/contacts/${t.contactId}`);
  revalidatePath("/calendar");
  return { success: true, data: { id } };
}
