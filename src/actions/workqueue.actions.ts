"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

// ============================================================
// Workqueue — the logged-in user's personal "what's on my plate" feed:
// their open tasks (today & overdue first) + quick counts across leads/bookings.
// ============================================================

export interface WorkqueueTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  related: string | null; // booking event / contact, if any
  relatedHref: string | null;
}

export interface WorkqueueData {
  tasks: WorkqueueTask[];
  counts: { open: number; overdue: number; dueToday: number; leads: number; bookings: number };
}

export async function getMyWorkqueue(): Promise<WorkqueueData | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [tasks, leads, bookings] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: "DONE" } },
      include: {
        booking: { select: { id: true, eventName: true, contact: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 100,
    }),
    prisma.lead.count({ where: { assignedToId: userId } }),
    prisma.booking.count({ where: { createdById: userId } }),
  ]);

  let overdue = 0, dueToday = 0;
  const mapped: WorkqueueTask[] = tasks.map((t) => {
    if (t.dueDate) {
      if (t.dueDate < now) overdue++;
      else if (t.dueDate <= todayEnd) dueToday++;
    }
    const related = t.booking
      ? t.booking.contact
        ? `${t.booking.eventName} · ${t.booking.contact.firstName} ${t.booking.contact.lastName}`.trim()
        : t.booking.eventName
      : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      related,
      relatedHref: t.booking ? `/bookings/${t.booking.id}` : null,
    };
  });

  return {
    tasks: mapped,
    counts: { open: tasks.length, overdue, dueToday, leads, bookings },
  };
}
