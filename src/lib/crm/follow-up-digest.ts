import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { istDateKey, istDayWindow, istHour } from "@/lib/home/ist";

// ============================================================
// Morning follow-up reminder.
//
// A lead's "Next follow-up" date was only ever shown on the follow-ups page:
// nothing told the rep when the day came, so the date was set and forgotten.
// Each morning (from 9 am India time) every rep with follow-ups due today or
// already overdue gets ONE in-app notice (bell + phone push) with the count
// and the first few names, linking to /leads/followups.
//
// Runs from the hourly FREQUENT lane. The first run at or after 9 am IST sends;
// later runs that day find the notice already written and skip it, so a missed
// or doubled cron run never loses or repeats the reminder. The dedupe key lives
// in the notification's metadata, so no new column or table is needed.
// ============================================================

export const DIGEST_KIND = "FOLLOW_UP_DIGEST";
export const DIGEST_HOUR_IST = 9;
const OPEN = { notIn: ["WON", "LOST"] as ("WON" | "LOST")[] };
const NAMES_SHOWN = 3;

export function digestKey(dayKey: string): string {
  return `${DIGEST_KIND}:${dayKey}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 follow-ups due today · 12 overdue" / "12 follow-ups overdue" */
export function digestTitle(today: number, overdue: number): string {
  if (today > 0 && overdue > 0) return `${plural(today, "follow-up")} due today · ${overdue} overdue`;
  if (today > 0) return `${plural(today, "follow-up")} due today`;
  return `${plural(overdue, "follow-up")} overdue`;
}

export function digestMessage(names: string[], today: number): string {
  if (names.length === 0) return "Open your follow-ups to see who to call.";
  const more = today - names.length;
  return `Today: ${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}.`;
}

export interface DigestResult {
  skipped?: string;
  day?: string;
  reps: number;
  sent: number;
  alreadySent: number;
}

/** Send today's follow-up reminder to every rep who has one due. Idempotent per IST day. */
export async function sendFollowUpDigests(now: Date = new Date()): Promise<DigestResult> {
  if (istHour(now) < DIGEST_HOUR_IST) {
    return { skipped: `Waits until ${DIGEST_HOUR_IST} am India time`, reps: 0, sent: 0, alreadySent: 0 };
  }
  const day = istDateKey(now);
  const { start, end } = istDayWindow(now);

  // Only active staff: a deactivated owner can't act on a reminder (their leads
  // are surfaced separately for reassignment).
  const base = {
    deletedAt: null,
    status: OPEN,
    assignedToId: { not: null },
    assignedTo: { isActive: true, role: { not: "VENUE_OWNER" as const } },
  };

  const [todayGroups, overdueGroups] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { ...base, followUpDate: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { ...base, followUpDate: { lt: start } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, { today: number; overdue: number }>();
  for (const g of todayGroups) {
    if (!g.assignedToId) continue;
    counts.set(g.assignedToId, { today: g._count._all, overdue: 0 });
  }
  for (const g of overdueGroups) {
    if (!g.assignedToId) continue;
    const c = counts.get(g.assignedToId) ?? { today: 0, overdue: 0 };
    c.overdue = g._count._all;
    counts.set(g.assignedToId, c);
  }
  if (counts.size === 0) return { day, reps: 0, sent: 0, alreadySent: 0 };

  const key = digestKey(day);
  const already = new Set(
    (
      await prisma.notification.findMany({
        where: {
          userId: { in: [...counts.keys()] },
          createdAt: { gte: new Date(start.getTime() - 60 * 60 * 1000) },
          metadata: { path: ["digestKey"], equals: key },
        },
        select: { userId: true },
      })
    ).map((n) => n.userId)
  );

  let sent = 0;
  for (const [userId, c] of counts) {
    if (already.has(userId)) continue;
    const todayLeads =
      c.today > 0
        ? await prisma.lead.findMany({
            where: { ...base, assignedToId: userId, followUpDate: { gte: start, lt: end } },
            orderBy: [{ followUpDate: "asc" }, { createdAt: "asc" }],
            take: NAMES_SHOWN,
            select: { title: true, contact: { select: { firstName: true, lastName: true } } },
          })
        : [];
    const names = todayLeads.map(
      (l) => `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim() || l.title
    );
    await notifyAwait({
      userId,
      type: "TASK_OVERDUE",
      title: digestTitle(c.today, c.overdue),
      message:
        c.today > 0
          ? digestMessage(names, c.today)
          : "Nothing is due today, but these leads are waiting on a call back.",
      actionUrl: "/leads/followups",
      metadata: { digestKey: key, kind: DIGEST_KIND, day, today: c.today, overdue: c.overdue },
    });
    sent++;
  }

  return { day, reps: counts.size, sent, alreadySent: already.size };
}
