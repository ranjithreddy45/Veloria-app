import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getAcqConfig } from "@/lib/acq/config";

export const maxDuration = 60;

// ============================================================
// BD / Acquisition CRM — SLA jobs (spec §6.4)
// - Lead first-contact breach
// - Follow-up due (leads)
// - Onboarding SLA breach
// - Re-engagement due
// ============================================================

function authorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return (
    !!authHeader &&
    !!process.env.CRON_SECRET &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cfg = await getAcqConfig();
  const summary: Record<string, number> = {};

  // BD Heads + Admins receive escalation copies.
  const heads = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["BD_HEAD", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  const headIds = heads.map((h) => h.id);

  // 1) Lead first-contact breach.
  const breached = await prisma.acqLead.findMany({
    where: { deletedAt: null, status: "NEW", firstContactDue: { lt: now } },
    select: { id: true, propertyName: true, locality: true, bdExecutiveId: true },
  });
  for (const lead of breached) {
    notify({
      userId: lead.bdExecutiveId,
      type: "SLA_WARNING",
      title: "Lead first-contact SLA breached",
      message: `${lead.propertyName}, ${lead.locality} has not been contacted in time.`,
      actionUrl: `/bd/leads`,
    });
    for (const hid of headIds) {
      if (hid === lead.bdExecutiveId) continue;
      notify({
        userId: hid,
        type: "SLA_WARNING",
        title: "Team lead SLA breach",
        message: `Lead ${lead.propertyName}, ${lead.locality} is past first-contact SLA.`,
        actionUrl: `/bd/leads`,
      });
    }
  }
  summary.leadFirstContactBreaches = breached.length;

  // 2) Follow-up due (leads with a passed next_followup_at).
  const followups = await prisma.acqLead.findMany({
    where: { deletedAt: null, status: "CONTACTED", nextFollowupAt: { lt: now } },
    select: { id: true, propertyName: true, bdExecutiveId: true },
  });
  for (const lead of followups) {
    notify({
      userId: lead.bdExecutiveId,
      type: "SLA_WARNING",
      title: "Follow-up due",
      message: `Follow-up is due for ${lead.propertyName}.`,
      actionUrl: `/bd/leads`,
    });
  }
  summary.followupsDue = followups.length;

  // 3) Onboarding SLA breach (open projects older than the SLA window).
  const slaCutoff = new Date(now.getTime() - cfg.ONBOARDING_SLA_DAYS * 24 * 60 * 60 * 1000);
  const staleProjects = await prisma.acqOnboardingProject.findMany({
    where: { status: "OPEN", createdAt: { lt: slaCutoff } },
    select: { property: { select: { id: true, propertyName: true, locality: true } } },
  });
  const ops = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  for (const proj of staleProjects) {
    for (const u of ops) {
      notify({
        userId: u.id,
        type: "SLA_WARNING",
        title: "Onboarding SLA breached",
        message: `Onboarding for ${proj.property.propertyName}, ${proj.property.locality} is overdue.`,
        actionUrl: `/bd/properties/${proj.property.id}`,
      });
    }
  }
  summary.onboardingBreaches = staleProjects.length;

  // 4) Re-engagement due (lost deals whose reengage_at has arrived).
  const reengage = await prisma.acqDeal.findMany({
    where: { deletedAt: null, stage: "LOST", reengageAt: { lt: now, not: null } },
    select: { id: true, name: true, bdExecutiveId: true },
  });
  for (const deal of reengage) {
    notify({
      userId: deal.bdExecutiveId,
      type: "SYSTEM",
      title: "Re-engage a lost deal",
      message: `It's time to re-approach ${deal.name}.`,
      actionUrl: `/bd/deals/${deal.id}`,
    });
    // Clear so it doesn't fire again next run.
    await prisma.acqDeal.update({ where: { id: deal.id }, data: { reengageAt: null } });
  }
  summary.reengagements = reengage.length;

  return NextResponse.json({ ok: true, summary });
}
