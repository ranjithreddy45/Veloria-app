"use server";

// ============================================================
// Active Alerts — the current user's UNRESOLVED, must-act items that should
// persistently nag on-screen (requirement 4): pending tasks + SLA breaches.
//
// Read-only + session-gated. Returns only the caller's own items. Kept light
// with take limits and indexed queries (Task.assigneeId / Task.dueDate,
// Notification.userId+isRead).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

// Alert types that belong in a PERSONAL nag panel: things this user must do
// something about, on work that is theirs.
//
// Every Notification row already has a userId, so "scoped to me" was technically
// true — but `SYSTEM` is fanned out to EVERY ADMIN by reportSystemFailure()
// (see lib/ops-alert.ts), across 73 call sites: payment-webhook faults, cron
// failures, draw-entry errors. An owner or admin therefore had a permanent panel
// of company plumbing parked over their screen, none of it their own work. That
// is a system-health feed, and it belongs in the notifications centre — where it
// still appears in full — not in a persistent personal nag.
//
// What stays is deliberately per-person, verified by who each notify() names:
//   SLA_WARNING / TASK_OVERDUE / TASK_ESCALATED  → the task's own assignee
//   PAYMENT_OVERDUE                              → the invoice's createdById
//   EXECUTION_TASK_BLOCKED                       → the acting user
//
// Dropped alongside SYSTEM: VENDOR_SLA_BREACH and REMINDER_FAILED — both are
// ops-health categories, and both currently have zero notify() call sites, so
// removing them changes nothing today and keeps the rule coherent tomorrow.
//
// The rule to apply when adding a type here: does it name ONE person who has to
// act, or is it broadcast to a role? Only the former belongs.
const SLA_TYPES: NotificationType[] = [
  "SLA_WARNING",
  "TASK_OVERDUE",
  "TASK_ESCALATED",
  "PAYMENT_OVERDUE",
  "EXECUTION_TASK_BLOCKED",
];

// How far ahead a task counts as "due soon" (surfaces before it goes overdue).
const DUE_SOON_MS = 24 * 60 * 60 * 1000; // 24h

export interface ActiveTaskAlert {
  id: string;
  title: string;
  dueDate: string; // ISO
  isOverdue: boolean;
  leadId: string | null;
  bookingId: string | null;
}

export interface ActiveSlaAlert {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
}

export interface ActiveAlertsResult {
  tasks: ActiveTaskAlert[];
  sla: ActiveSlaAlert[];
  total: number;
}

/**
 * The signed-in user's unresolved must-act items:
 *  - pending tasks assigned to them (status != DONE) that are overdue or due soon,
 *  - unread SLA/system notifications.
 * Returns empty (never throws) when unauthenticated.
 */
export async function getActiveAlerts(): Promise<ActiveAlertsResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { tasks: [], sla: [], total: 0 };

  const now = new Date();
  const dueCutoff = new Date(now.getTime() + DUE_SOON_MS);

  const [tasks, notifications] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "DONE" },
        dueDate: { not: null, lte: dueCutoff },
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        title: true,
        dueDate: true,
        leadId: true,
        bookingId: true,
      },
      take: 25,
    }),
    prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        type: { in: SLA_TYPES },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        actionUrl: true,
      },
      take: 25,
    }),
  ]);

  const taskAlerts: ActiveTaskAlert[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate!.toISOString(),
    isOverdue: t.dueDate!.getTime() < now.getTime(),
    leadId: t.leadId,
    bookingId: t.bookingId,
  }));

  const slaAlerts: ActiveSlaAlert[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    actionUrl: n.actionUrl,
  }));

  return {
    tasks: taskAlerts,
    sla: slaAlerts,
    total: taskAlerts.length + slaAlerts.length,
  };
}
