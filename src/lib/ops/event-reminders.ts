// ============================================================
// Event-day task reminders — one-shot "your task starts soon" nudge.
// ------------------------------------------------------------
// Sweeps ExecutionTasks that are still NOT_STARTED, have a real assignee, have
// NOT already been reminded (reminderSentAt one-shot flag), and whose
// slaStartBy falls inside the "act now" window: starting within the next ~45
// min, and not already long-past (more than 2h overdue is stale — the overdue
// escalation path owns those, not this gentle nudge). For each match we notify
// the assignee with the start time + a live countdown, then stamp
// reminderSentAt=now so it fires exactly once.
//
// Plain library (NOT "use server"): callable from cron with no session, like
// catchCoolingLeads / escalateLeadSlaBreaches. Best-effort per row — one bad
// row never aborts the sweep, and the whole sweep never throws.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";

// Tuning thresholds (named so ops can adjust in review).
export const REMINDER_LEAD_MINUTES = 45; // fire when a task starts within this window
export const REMINDER_STALE_HOURS = 2; // ignore tasks already this far past start
const BATCH = 500;

export interface EventReminderResult {
  scanned: number;
  notified: number;
}

function formatStartTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

/**
 * Run one event-day reminder sweep. Returns {scanned, notified}; never throws.
 */
export async function sendEventDayTaskReminders(): Promise<EventReminderResult> {
  const result: EventReminderResult = { scanned: 0, notified: 0 };
  const now = new Date();

  try {
    const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000);
    const staleFloor = new Date(now.getTime() - REMINDER_STALE_HOURS * 3_600_000);

    // Upcoming-today tasks worth a nudge: not started, assigned, never reminded,
    // and slaStartBy in [now - 2h, now + 45m].
    const tasks = await prisma.executionTask.findMany({
      where: {
        status: "NOT_STARTED",
        assigneeId: { not: null },
        reminderSentAt: null,
        slaStartBy: { not: null, gte: staleFloor, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        slaStartBy: true,
        assigneeId: true,
        phase: {
          select: { plan: { select: { bookingId: true } } },
        },
      },
      orderBy: { slaStartBy: "asc" },
      take: BATCH,
    });
    result.scanned = tasks.length;
    if (tasks.length === 0) return result;

    for (const task of tasks) {
      try {
        if (!task.assigneeId || !task.slaStartBy) continue;

        const startAt = new Date(task.slaStartBy);
        const bookingId = task.phase?.plan?.bookingId;

        await notifyAwait({
          userId: task.assigneeId,
          type: "TASK_ASSIGNED",
          title: "⏰ Task starting soon",
          message: `Your task "${task.title}" starts at ${formatStartTime(startAt)} — ${formatCountdown(startAt, now)}.`,
          actionUrl: bookingId
            ? `/bookings/${bookingId}/control`
            : undefined,
        });

        // One-shot: stamp reminderSentAt so this never re-fires for the task.
        await prisma.executionTask.update({
          where: { id: task.id },
          data: { reminderSentAt: now },
        });

        result.notified++;
      } catch (e) {
        console.error("[sendEventDayTaskReminders] task error:", task.id, e);
      }
    }
  } catch (e) {
    console.error("[sendEventDayTaskReminders] error:", e);
  }

  return result;
}
