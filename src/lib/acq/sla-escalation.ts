import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// FEAT-003 — escalate overdue BD first-contact SLAs.
// A NEW lead whose firstContactDue has passed without a firstContactAt is breached.
// On first detection we notify the assigned BD exec and escalate to BD leadership,
// then stamp slaEscalatedAt so the cron never re-notifies the same breach.
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
    const where = `${lead.propertyName}, ${lead.locality}`;
    // Nudge the owner.
    if (lead.bdExecutiveId) {
      notify({
        userId: lead.bdExecutiveId,
        type: "TASK_ASSIGNED",
        title: "Lead past first-contact SLA",
        message: `${where} hasn't been contacted within the SLA window. Call now and log the contact.`,
        actionUrl: `/bd/leads/${lead.id}`,
      });
    }
    // Escalate to BD leadership (skip the owner if they're also a head).
    for (const h of heads) {
      if (h.id === lead.bdExecutiveId) continue;
      notify({
        userId: h.id,
        type: "SYSTEM",
        title: "BD SLA breach",
        message: `${where} is past its first-contact SLA and not yet contacted.`,
        actionUrl: `/bd/leads/${lead.id}`,
      });
    }
    escalated++;
  }

  await prisma.acqLead.updateMany({
    where: { id: { in: breached.map((l) => l.id) } },
    data: { slaEscalatedAt: now },
  });

  return { checked: breached.length, escalated };
}
