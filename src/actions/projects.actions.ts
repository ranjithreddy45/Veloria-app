"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { computeCapex, validateCapexInput, type CapexInput, type CapexResult } from "@/lib/projects/capex-calc";
import { READINESS_CHECKLIST } from "@/lib/projects/readiness-config";
import { OPS_AUDIT_CHECKLIST } from "@/lib/projects/ops-audit-config";
import { Prisma } from "@prisma/client";
import { PROJECT_PHASES } from "@/lib/projects/phases";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Lazily seed the readiness checklist the first time a project is opened (works
// for projects created before this feature existed).
async function ensureReadinessSeeded(projectId: string) {
  const count = await prisma.venueReadinessItem.count({ where: { projectId } });
  if (count > 0) return;
  await prisma.venueReadinessItem.createMany({
    data: READINESS_CHECKLIST.map((it, i) => ({
      projectId,
      category: it.category,
      title: it.title,
      standard: it.standard,
      order: i,
    })),
  });
}

async function ensureOpsAuditSeeded(projectId: string) {
  const count = await prisma.opsAuditItem.count({ where: { projectId } });
  if (count > 0) return;
  await prisma.opsAuditItem.createMany({
    data: OPS_AUDIT_CHECKLIST.map((it, i) => ({
      projectId,
      category: it.category,
      title: it.title,
      critical: it.critical,
      order: i,
    })),
  });
}

// ------------------------------------------------------------
// List / get
// ------------------------------------------------------------
export async function getProjects(): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:read")) return { success: false, error: "Unauthorized" };
  const rows = await prisma.acqOnboardingProject.findMany({
    include: {
      property: { select: { id: true, propertyName: true, city: true, locality: true, status: true } },
      projectManager: { select: { name: true } },
      _count: { select: { readinessItems: true } },
      readinessItems: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const data = rows.map((p) => {
    const total = p.readinessItems.length;
    const done = p.readinessItems.filter((r) => r.status === "DONE" || r.status === "NA").length;
    return {
      id: p.id,
      phase: p.phase,
      property: p.property,
      projectManager: p.projectManager,
      targetReadyDate: p.targetReadyDate,
      readinessPct: total ? Math.round((done / total) * 100) : 0,
      launchedAt: p.launchedAt,
    };
  });
  return { success: true, data: serialize(data) as unknown[] };
}

export async function getProject(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:read")) return { success: false, error: "Unauthorized" };
  await ensureReadinessSeeded(id);
  const row = await prisma.acqOnboardingProject.findUnique({
    where: { id },
    include: {
      property: true,
      projectManager: { select: { id: true, name: true } },
      opsAuditBy: { select: { name: true } },
      handoverBy: { select: { name: true } },
      readinessItems: { orderBy: { order: "asc" } },
      opsAuditItems: { orderBy: { order: "asc" } },
      capexProjections: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      },
    },
  });
  if (!row) return { success: false, error: "Project not found" };
  return { success: true, data: serialize(row) };
}

// ------------------------------------------------------------
// Phase + assignment + checklist
// ------------------------------------------------------------
export async function setProjectPhase(id: string, phase: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  if (!(PROJECT_PHASES as readonly string[]).includes(phase)) return { success: false, error: "Invalid phase" };
  const data: Prisma.AcqOnboardingProjectUpdateInput = { phase };
  if (phase === "EXECUTION") data.startedAt = new Date();
  await prisma.acqOnboardingProject.update({ where: { id }, data });
  revalidatePath(`/projects/${id}`);
  return { success: true, data: { phase } };
}

export async function assignProjectManager(id: string, userId: string | null): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  await prisma.acqOnboardingProject.update({ where: { id }, data: { projectManagerId: userId || null } });
  if (userId) {
    notify({ userId, type: "TASK_ASSIGNED", title: "Assigned to a venue project", message: "You are now the project manager for a venue readiness project.", actionUrl: `/projects/${id}` });
  }
  revalidatePath(`/projects/${id}`);
  return { success: true, data: { id } };
}

export async function setReadinessItem(itemId: string, patch: { status?: string; notes?: string }): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const item = await prisma.venueReadinessItem.findUnique({ where: { id: itemId }, select: { projectId: true } });
  if (!item) return { success: false, error: "Item not found" };
  await prisma.venueReadinessItem.update({
    where: { id: itemId },
    data: {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
    },
  });
  revalidatePath(`/projects/${item.projectId}`);
  return { success: true, data: { id: itemId } };
}

// ------------------------------------------------------------
// Ops audit (Operations runs the deep audit before sign-off)
// ------------------------------------------------------------
export async function requestOpsAudit(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  await ensureOpsAuditSeeded(projectId);
  await prisma.acqOnboardingProject.update({
    where: { id: projectId },
    data: { phase: "OPS_AUDIT", opsAuditRequestedAt: new Date() },
  });
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, include: { property: { select: { propertyName: true } } } });
  const ops = await prisma.user.findMany({ where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN", "ADMIN"] } }, select: { id: true } });
  for (const o of ops) {
    notify({ userId: o.id, type: "TASK_ASSIGNED", title: "Venue ready for ops audit", message: `${project?.property.propertyName ?? "A venue"} is ready — run the deep audit before launch.`, actionUrl: `/projects/${projectId}` });
  }
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

export async function setOpsAuditItem(itemId: string, patch: { status?: string; notes?: string }): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  // Operations (or admin) performs the audit.
  if (!user || !can(user.role, "projects:audit")) return { success: false, error: "Only the Operations team can audit." };
  const item = await prisma.opsAuditItem.findUnique({ where: { id: itemId }, select: { projectId: true } });
  if (!item) return { success: false, error: "Item not found" };
  await prisma.opsAuditItem.update({
    where: { id: itemId },
    data: {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
    },
  });
  revalidatePath(`/projects/${item.projectId}`);
  return { success: true, data: { id: itemId } };
}

export async function completeOpsAudit(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:audit")) return { success: false, error: "Only the Operations team can sign off the audit." };
  const items = await prisma.opsAuditItem.findMany({ where: { projectId }, select: { critical: true, status: true } });
  const blocking = items.filter((i) => i.critical && i.status !== "PASS" && i.status !== "NA");
  if (blocking.length) {
    return { success: false, error: `${blocking.length} critical audit item(s) are not yet passed.` };
  }
  await prisma.acqOnboardingProject.update({
    where: { id: projectId },
    data: { opsAuditPassedAt: new Date(), opsAuditById: user.id, phase: "HANDOVER" },
  });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// ------------------------------------------------------------
// Handover report + launch
// ------------------------------------------------------------
export async function generateHandover(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can submit the handover." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { opsAuditPassedAt: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (!project.opsAuditPassedAt) return { success: false, error: "The operations audit must pass before handover." };
  await prisma.acqOnboardingProject.update({
    where: { id: projectId },
    data: { handoverReportAt: new Date(), handoverById: user.id },
  });
  // Notify operations + management.
  const recipients = await prisma.user.findMany({ where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN", "ADMIN"] } }, select: { id: true } });
  for (const r of recipients) {
    notify({ userId: r.id, type: "SYSTEM", title: "Venue handover report ready", message: `Handover report submitted for ${project.property.propertyName}.`, actionUrl: `/projects/${projectId}` });
  }
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

export async function launchProject(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can give the launch go-ahead." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { handoverReportAt: true, propertyId: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (!project.handoverReportAt) return { success: false, error: "Submit the handover report before launch." };
  await prisma.$transaction([
    prisma.acqOnboardingProject.update({ where: { id: projectId }, data: { phase: "LAUNCHED", launchedAt: new Date(), status: "COMPLETED", completedAt: new Date() } }),
    prisma.acqProperty.update({ where: { id: project.propertyId }, data: { status: "AVAILABLE", availableAt: new Date() } }),
  ]);
  // Hand the baton to Sales & Marketing.
  const sales = await prisma.user.findMany({ where: { isActive: true, role: { in: ["SALES_EXEC", "EVENT_COORDINATOR", "SUPER_ADMIN", "ADMIN"] } }, select: { id: true } });
  for (const s of sales) {
    notify({ userId: s.id, type: "SYSTEM", title: "New venue is live!", message: `${project.property.propertyName} has launched — start generating bookings.`, actionUrl: `/projects/${projectId}` });
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, data: { id: projectId } };
}

// ------------------------------------------------------------
// CapEx projection (DRAFT → PENDING_APPROVAL → APPROVED → SENT)
// ------------------------------------------------------------
function capexHeadline(input: CapexInput) {
  const out = computeCapex(input);
  return { totalCapex: new Prisma.Decimal(out.total), estimatedWeeks: out.estimatedWeeks };
}

export async function createCapex(projectId: string, input: CapexInput, notes?: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:create")) return { success: false, error: "Unauthorized" };
  const errs = validateCapexInput(input);
  if (errs.length) return { success: false, error: errs.join(" ") };
  const last = await prisma.acqCapexProjection.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
  const row = await prisma.acqCapexProjection.create({
    data: {
      projectId,
      version: (last?.version ?? 0) + 1,
      status: "DRAFT",
      inputsJson: input as unknown as Prisma.InputJsonValue,
      notes: notes || null,
      createdById: user.id,
      ...capexHeadline(input),
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: row.id } };
}

export async function updateCapex(id: string, input: CapexInput, notes?: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqCapexProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Not found" };
  if (row.status !== "DRAFT") return { success: false, error: "Only a draft CapEx can be edited." };
  const errs = validateCapexInput(input);
  if (errs.length) return { success: false, error: errs.join(" ") };
  await prisma.acqCapexProjection.update({
    where: { id },
    data: { inputsJson: input as unknown as Prisma.InputJsonValue, notes: notes ?? row.notes, ...capexHeadline(input) },
  });
  revalidatePath(`/projects/${row.projectId}`);
  return { success: true, data: { id } };
}

export async function submitCapex(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:create")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqCapexProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Not found" };
  if (row.status !== "DRAFT") return { success: false, error: `Cannot submit from ${row.status}.` };
  await prisma.acqCapexProjection.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedById: user.id, submittedAt: new Date(), rejectedReason: null } });
  const heads = await prisma.user.findMany({ where: { isActive: true, role: { in: ["PROJECTS_HEAD", "SUPER_ADMIN", "ADMIN"] } }, select: { id: true } });
  for (const h of heads) notify({ userId: h.id, type: "SYSTEM", title: "CapEx awaiting approval", message: `A CapEx projection needs your approval.`, actionUrl: `/projects/${row.projectId}` });
  revalidatePath(`/projects/${row.projectId}`);
  return { success: true, data: { status: "PENDING_APPROVAL" } };
}

export async function approveCapex(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can approve CapEx." };
  const row = await prisma.acqCapexProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Not found" };
  if (row.status !== "PENDING_APPROVAL") return { success: false, error: `Cannot approve from ${row.status}.` };
  if (row.submittedById === user.id && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    return { success: false, error: "You submitted this CapEx — a different head must approve it." };
  }
  const out = computeCapex(row.inputsJson as unknown as CapexInput);
  await prisma.acqCapexProjection.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), outputsJson: out as unknown as Prisma.InputJsonValue, pdfUrl: `/api/projects/capex/${id}/pdf` },
  });
  revalidatePath(`/projects/${row.projectId}`);
  return { success: true, data: { status: "APPROVED" } };
}

export async function rejectCapex(id: string, reason: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can return CapEx." };
  if (!reason?.trim()) return { success: false, error: "A reason is required." };
  const row = await prisma.acqCapexProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Not found" };
  if (row.status !== "PENDING_APPROVAL") return { success: false, error: `Cannot return from ${row.status}.` };
  await prisma.acqCapexProjection.update({ where: { id }, data: { status: "DRAFT", rejectedReason: reason.trim() } });
  revalidatePath(`/projects/${row.projectId}`);
  return { success: true, data: { status: "DRAFT" } };
}

export async function sendCapex(id: string, opts: { channel: "EMAIL" | "WHATSAPP" | "MANUAL"; to?: string }): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqCapexProjection.findUnique({ where: { id }, include: { project: { include: { property: { select: { ownerName: true } } } } } });
  if (!row) return { success: false, error: "Not found" };
  if (row.status !== "APPROVED" && row.status !== "SENT") return { success: false, error: "Approve the CapEx before sending." };
  await prisma.acqCapexProjection.update({
    where: { id },
    data: { status: "SENT", sentChannel: opts.channel.toLowerCase(), sentTo: opts.to || null, sentById: user.id, sentAt: new Date() },
  });
  revalidatePath(`/projects/${row.projectId}`);
  return { success: true, data: { status: "SENT" } };
}
