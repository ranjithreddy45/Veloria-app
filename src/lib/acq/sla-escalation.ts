import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";

// ============================================================
// BD / Acquisition SLA alerts — every one fires ONCE per breach.
//
// WHY: /api/cron/acq-sla used to re-scan every breached lead on every run and
// notify again, with no stamp. 19 breached leads × ~13 BD heads/admins = ~247
// "Team lead SLA breach" rows an hour, around the clock, to the same people —
// 160k+ unread by Oct 2026 — and twice in the hours where a second scheduler
// (the GitHub hourly workflow) fired the lane again after the server crontab.
//
// The rule now, for each alert below: CLAIM FIRST, then send. A guarded
// updateMany stamps the row only while it is still unstamped; only the run that
// wins the claim (count === 1) sends. Overlapping runs, a second scheduler, or
// the fast lane and the hourly lane both calling this alert at most once
// (same discipline as escalateLeadSlaBreaches in src/lib/lead-pipeline.ts).
// ============================================================

/** True when this run won the claim on that row. */
function won(res: { count: number }): boolean {
  return res.count === 1;
}

// FEAT-003 — escalate overdue BD first-contact SLAs.
// A NEW lead whose firstContactDue has passed without a firstContactAt is breached.
// On first detection we notify the assigned BD exec and escalate to BD leadership.
// Called from both the fast lane and /api/cron/acq-sla; slaEscalatedAt makes
// whichever runs first the only one that alerts.
export async function escalateAcqLeadSlaBreaches(): Promise<{ checked: number; escalated: number }> {
  const now = new Date();
  const breached = await prisma.acqLead.findMany({
    where: {
      deletedAt: null,
      status: "NEW",
      firstContactAt: null,
      slaEscalatedAt: null,
      firstContactDue: { lt: now },
    },
    select: { id: true, propertyName: true, locality: true, bdExecutiveId: true },
    take: 200,
  });
  if (breached.length === 0) return { checked: 0, escalated: 0 };

  const heads = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["BD_HEAD", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });

  let escalated = 0;
  for (const lead of breached) {
    const claimed = await prisma.acqLead.updateMany({
      where: { id: lead.id, slaEscalatedAt: null },
      data: { slaEscalatedAt: now },
    });
    if (!won(claimed)) continue;

    const where = `${lead.propertyName}, ${lead.locality}`;
    const pending: Promise<void>[] = [];
    // Nudge the owner.
    if (lead.bdExecutiveId) {
      pending.push(
        notifyAwait({
          userId: lead.bdExecutiveId,
          type: "TASK_ASSIGNED",
          title: "Lead past first-contact SLA",
          message: `${where} hasn't been contacted within the SLA window. Call now and log the contact.`,
          actionUrl: `/bd/leads/${lead.id}`,
        })
      );
    }
    // Escalate to BD leadership (skip the owner if they're also a head).
    for (const h of heads) {
      if (h.id === lead.bdExecutiveId) continue;
      pending.push(
        notifyAwait({
          userId: h.id,
          type: "SYSTEM",
          title: "BD SLA breach",
          message: `${where} is past its first-contact SLA and not yet contacted.`,
          actionUrl: `/bd/leads/${lead.id}`,
        })
      );
    }
    // Await the writes so a serverless/cron process cannot exit before they land.
    await Promise.allSettled(pending);
    escalated++;
  }

  return { checked: breached.length, escalated };
}

/**
 * Follow-up due: a CONTACTED lead whose nextFollowupAt has passed. One alert
 * per scheduled follow-up — followupNotifiedFor records the nextFollowupAt
 * value already alerted, so rescheduling the follow-up arms it again.
 */
export async function notifyAcqFollowupsDue(now: Date = new Date()): Promise<number> {
  const due = await prisma.acqLead.findMany({
    where: { deletedAt: null, status: "CONTACTED", nextFollowupAt: { lt: now } },
    select: { id: true, propertyName: true, bdExecutiveId: true, nextFollowupAt: true, followupNotifiedFor: true },
    take: 500,
  });
  let sent = 0;
  for (const lead of due) {
    const at = lead.nextFollowupAt;
    if (!at) continue;
    if (lead.followupNotifiedFor && lead.followupNotifiedFor.getTime() === at.getTime()) continue;
    const claimed = await prisma.acqLead.updateMany({
      where: {
        id: lead.id,
        nextFollowupAt: at, // not rescheduled since we read it
        OR: [{ followupNotifiedFor: null }, { followupNotifiedFor: { not: at } }],
      },
      data: { followupNotifiedFor: at },
    });
    if (!won(claimed)) continue;
    await notifyAwait({
      userId: lead.bdExecutiveId,
      type: "SLA_WARNING",
      title: "Follow-up due",
      message: `Follow-up is due for ${lead.propertyName}.`,
      actionUrl: `/bd/leads`,
    });
    sent++;
  }
  return sent;
}

/** Onboarding SLA breach: an OPEN project older than the SLA window, alerted once. */
export async function escalateAcqOnboardingBreaches(slaDays: number, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - slaDays * 24 * 60 * 60 * 1000);
  const stale = await prisma.acqOnboardingProject.findMany({
    where: { status: "OPEN", createdAt: { lt: cutoff }, slaEscalatedAt: null },
    select: { id: true, property: { select: { id: true, propertyName: true, locality: true } } },
    take: 200,
  });
  if (stale.length === 0) return 0;

  const ops = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  let escalated = 0;
  for (const proj of stale) {
    const claimed = await prisma.acqOnboardingProject.updateMany({
      where: { id: proj.id, slaEscalatedAt: null },
      data: { slaEscalatedAt: now },
    });
    if (!won(claimed)) continue;
    await Promise.allSettled(
      ops.map((u) =>
        notifyAwait({
          userId: u.id,
          type: "SLA_WARNING",
          title: "Onboarding SLA breached",
          message: `Onboarding for ${proj.property.propertyName}, ${proj.property.locality} is overdue.`,
          actionUrl: `/bd/properties/${proj.property.id}`,
        })
      )
    );
    escalated++;
  }
  return escalated;
}

/** Re-engagement due: a LOST deal whose reengageAt has arrived. Clearing reengageAt is the claim. */
export async function notifyAcqReengagements(now: Date = new Date()): Promise<number> {
  const due = await prisma.acqDeal.findMany({
    where: { deletedAt: null, stage: "LOST", reengageAt: { lt: now, not: null } },
    select: { id: true, name: true, bdExecutiveId: true },
    take: 200,
  });
  let sent = 0;
  for (const deal of due) {
    const claimed = await prisma.acqDeal.updateMany({
      where: { id: deal.id, reengageAt: { not: null, lt: now } },
      data: { reengageAt: null },
    });
    if (!won(claimed)) continue;
    await notifyAwait({
      userId: deal.bdExecutiveId,
      type: "SYSTEM",
      title: "Re-engage a lost deal",
      message: `It's time to re-approach ${deal.name}.`,
      actionUrl: `/bd/deals/${deal.id}`,
    });
    sent++;
  }
  return sent;
}
