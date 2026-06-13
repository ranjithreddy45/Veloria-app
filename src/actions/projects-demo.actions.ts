"use server";

import { randomBytes } from "crypto";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { READINESS_CHECKLIST, readinessSeverity } from "@/lib/projects/readiness-config";
import { OPS_AUDIT_CHECKLIST } from "@/lib/projects/ops-audit-config";
import { computeCapex, defaultCapexInput } from "@/lib/projects/capex-calc";
import { ONBOARDING_SEED_TASKS } from "@/lib/acq/constants";
import { PROJECT_PHASES } from "@/lib/projects/phases";
import { DEMO_SAMPLES, SAMPLE_TAG, type DemoSample } from "@/lib/projects/demo-data";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  const u = session?.user as { id: string; role?: string; name?: string | null } | undefined;
  if (!u?.id) return null;
  if (u.role !== "SUPER_ADMIN" && u.role !== "ADMIN") return null;
  return u;
}

export async function getDemoCount(): Promise<number> {
  const u = await requireAdmin();
  if (!u) return 0;
  return prisma.acqOnboardingProject.count({ where: { notes: { contains: SAMPLE_TAG } } });
}

// Cumulative stage stamps for a sample's target phase.
function stampsFor(s: DemoSample, userId: string, now: Date): Prisma.AcqOnboardingProjectUncheckedCreateInput {
  const at = (n: number) => PROJECT_PHASES.indexOf(s.phase) >= n; // n = index of the phase whose completion sets the stamp
  const idx = (p: string) => PROJECT_PHASES.indexOf(p as never);
  const past = (p: string) => PROJECT_PHASES.indexOf(s.phase) > idx(p);
  const weeksOut = new Date(now.getTime() + 10 * 7 * 86400000);
  return {
    propertyId: "", // filled by caller
    phase: s.phase,
    status: s.phase === "LIVE" ? "COMPLETED" : "OPEN",
    ownerContact: s.ownerContact,
    fundingModel: s.fundingModel,
    hallCount: s.hallCount,
    totalCapacity: s.totalCapacity,
    totalSqft: s.totalSqft,
    bdOwnerId: userId,
    dealClosedDate: now,
    projectManagerId: userId,
    targetReadyDate: weeksOut,
    notes: `${SAMPLE_TAG} ${s.blurb}`,
    handoffAcceptedAt: past("HANDOFF") ? now : null,
    assessmentDoneAt: past("ASSESSMENT") ? now : null,
    ownerApproved: past("CAPEX"),
    ownerApprovedAt: past("CAPEX") ? now : null,
    startedAt: past("CAPEX") ? now : null,
    qcReadyAt: past("EXECUTION") && at(idx("OPS_AUDIT")) ? now : null,
    opsAuditRequestedAt: at(idx("OPS_AUDIT")) ? now : null,
    opsAuditPassedAt: past("OPS_AUDIT") ? now : null,
    opsAuditById: past("OPS_AUDIT") ? userId : null,
    finalGoAheadAt: past("FINAL_GO_AHEAD") ? now : null,
    finalGoAheadById: past("FINAL_GO_AHEAD") ? userId : null,
    handoverReportAt: at(idx("HANDOVER")) ? now : null,
    handoverById: at(idx("HANDOVER")) ? userId : null,
    opsAcknowledgedAt: at(idx("HANDOVER")) ? now : null,
    mgmtAcknowledgedAt: s.phase === "LIVE" ? now : null,
    launchedAt: s.phase === "LIVE" ? now : null,
    completedAt: s.phase === "LIVE" ? now : null,
  };
}

export async function seedDemoProjects(): Promise<Result<{ created: number }>> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: "Only an admin can load sample projects." };
  const existing = await prisma.acqOnboardingProject.count({ where: { notes: { contains: SAMPLE_TAG } } });
  if (existing > 0) return { success: false, error: `Sample projects are already loaded (${existing}). Clear them first to reload.` };

  const now = new Date();
  let created = 0;
  for (const s of DEMO_SAMPLES) {
    const lead = await prisma.acqLead.create({
      data: {
        ownerName: s.ownerName, mobilePrimary: s.ownerContact, propertyName: s.propertyName, propertyType: s.propertyType,
        city: s.city, locality: s.locality, leadSource: "REFERRAL", ownerType: "SOLE_OWNER",
        bdExecutiveId: user.id, firstContactDue: now,
      },
      select: { id: true },
    });
    const deal = await prisma.acqDeal.create({
      data: {
        name: s.propertyName, leadId: lead.id, ownerName: s.ownerName, ownerType: "SOLE_OWNER",
        propertyName: s.propertyName, propertyType: s.propertyType, city: s.city, locality: s.locality,
        bdExecutiveId: user.id, stage: "WON",
      },
      select: { id: true },
    });
    // These samples represent venues already WON & converted, so the lead must be
    // QUALIFIED and linked to its deal — otherwise it pollutes active-lead lists,
    // the SLA-breach count, and the funnel (it would show as a fresh NEW/overdue lead).
    await prisma.acqLead.update({ where: { id: lead.id }, data: { status: "QUALIFIED", convertedDealId: deal.id } });
    const property = await prisma.acqProperty.create({
      data: {
        dealId: deal.id, propertyName: s.propertyName, propertyType: s.propertyType, ownerName: s.ownerName,
        city: s.city, locality: s.locality, acquisitionDate: now, propertyManagerId: user.id,
        status: s.phase === "LIVE" ? "AVAILABLE" : "ONBOARDING", availableAt: s.phase === "LIVE" ? now : null,
      },
      select: { id: true },
    });
    const stamps = stampsFor(s, user.id, now);
    stamps.propertyId = property.id;
    const project = await prisma.acqOnboardingProject.create({ data: stamps, select: { id: true } });

    // BD-side property onboarding checklist (6 seed tasks, as the real WON flow does),
    // with completion proportional to how far the venue has progressed.
    const onboardingDone =
      s.phase === "LIVE" ? ONBOARDING_SEED_TASKS.length
      : s.phase === "HANDOVER" ? 5
      : s.phase === "OPS_AUDIT" ? 4
      : s.phase === "EXECUTION" ? 2
      : 0;
    await prisma.acqOnboardingTask.createMany({
      data: ONBOARDING_SEED_TASKS.map((title, i) => ({ projectId: project.id, title, done: i < onboardingDone })),
    });

    // Readiness checklist (full set), resolved to the target percentage.
    if (s.phase !== "HANDOFF") {
      const doneCount = Math.round((READINESS_CHECKLIST.length * s.readinessDonePct) / 100);
      await prisma.venueReadinessItem.createMany({
        data: READINESS_CHECKLIST.map((it, i) => ({
          projectId: project.id, category: it.category, title: it.title, standard: it.standard,
          severity: readinessSeverity(it.category), order: i, status: i < doneCount ? "DONE" : "PENDING",
        })),
      });
    }

    // Ops-audit checklist.
    if (s.seedOpsAudit) {
      await prisma.opsAuditItem.createMany({
        data: OPS_AUDIT_CHECKLIST.map((it, i) => ({
          projectId: project.id, category: it.category, title: it.title, critical: it.critical, order: i,
          status: s.opsAuditAllPass ? "PASS" : i % 3 === 0 ? "PENDING" : "PASS",
        })),
      });
    }

    // CapEx projection.
    if (s.hasDraftCapex || s.hasApprovedCapex) {
      const input = defaultCapexInput(s.totalSqft, s.totalCapacity);
      const out = computeCapex(input);
      const approved = !!s.hasApprovedCapex;
      const token = approved ? randomBytes(24).toString("base64url") : null;
      await prisma.acqCapexProjection.create({
        data: {
          projectId: project.id, version: 1, status: approved ? "APPROVED" : "DRAFT",
          inputsJson: input as unknown as Prisma.InputJsonValue,
          outputsJson: approved ? (out as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          totalCapex: new Prisma.Decimal(out.total), estimatedWeeks: out.estimatedWeeks,
          createdById: user.id,
          submittedById: approved ? user.id : null, submittedAt: approved ? now : null,
          approvedById: approved ? user.id : null, approvedAt: approved ? now : null,
          shareToken: token, pdfUrl: approved ? `/api/projects/capex/${project.id}/pdf` : null,
        },
      });
    }

    // Snags.
    if (s.snags.length) {
      await prisma.projectSnag.createMany({
        data: s.snags.map((sn) => ({
          projectId: project.id, title: sn.title, description: sn.description ?? null, category: sn.category,
          location: sn.location, severity: sn.severity, status: sn.status,
          raisedInStage: s.phase === "OPS_AUDIT" ? "OPS_AUDIT" : "INTERNAL_QC",
          raisedById: user.id, raisedByName: user.name ?? "Sample data",
          fixedPendingAt: sn.status === "FIXED_PENDING_VERIFICATION" ? now : null,
          verifiedById: sn.status === "VERIFIED_CLOSED" ? user.id : null,
          verifiedByName: sn.status === "VERIFIED_CLOSED" ? (user.name ?? "Operations") : null,
          verifiedAt: sn.status === "VERIFIED_CLOSED" ? now : null,
        })),
      });
    }
    created++;
  }

  revalidatePathsAfterDemoChange();
  return { success: true, data: { created } };
}

function revalidatePathsAfterDemoChange() {
  for (const p of ["/projects", "/bd/dashboard", "/bd/leads", "/bd/deals", "/bd/properties"]) revalidatePath(p);
}

export async function clearDemoProjects(): Promise<Result<{ removed: number }>> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: "Only an admin can clear sample projects." };
  const projects = await prisma.acqOnboardingProject.findMany({ where: { notes: { contains: SAMPLE_TAG } }, select: { id: true, propertyId: true } });
  if (!projects.length) return { success: true, data: { removed: 0 } };
  const propertyIds = projects.map((p) => p.propertyId);
  const props = await prisma.acqProperty.findMany({ where: { id: { in: propertyIds } }, select: { id: true, dealId: true } });
  const dealIds = props.map((p) => p.dealId);
  const deals = await prisma.acqDeal.findMany({ where: { id: { in: dealIds } }, select: { id: true, leadId: true } });
  const leadIds = deals.map((d) => d.leadId);
  // Delete children-first. Onboarding tasks have NO cascade on their project FK, so
  // they must be removed explicitly or the project delete hits an FK violation (audit fix).
  const projectIds = projects.map((p) => p.id);
  await prisma.acqOnboardingTask.deleteMany({ where: { projectId: { in: projectIds } } });
  // Project delete then cascades readiness/audit/capex/snags/photos/sign-offs → property → deal → lead.
  await prisma.acqOnboardingProject.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.acqProperty.deleteMany({ where: { id: { in: propertyIds } } });
  await prisma.acqDeal.deleteMany({ where: { id: { in: dealIds } } });
  await prisma.acqLead.deleteMany({ where: { id: { in: leadIds } } });
  revalidatePathsAfterDemoChange();
  return { success: true, data: { removed: projects.length } };
}
