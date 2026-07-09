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

// Notification types that count as an SLA / system breach the user must act on.
// (Mirrors the SLA/system set in the Notification enum — see prisma/schema.prisma.)
const SLA_TYPES: NotificationType[] = [
  "SLA_WARNING",
  "TASK_OVERDUE",
  "TASK_ESCALATED",
  "PAYMENT_OVERDUE",
  "VENDOR_SLA_BREACH",
  "EXECUTION_TASK_BLOCKED",
  "REMINDER_FAILED",
  "SYSTEM",
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
