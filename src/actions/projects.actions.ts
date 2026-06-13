"use server";

import { randomBytes } from "crypto";
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

type Result<T> = { success: true; data: T } | { success: false; error: string };

const READINESS_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "NA"];
const AUDIT_STATUSES = ["PENDING", "PASS", "FAIL", "NA"];

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
// Seed once, idempotently. The count-then-insert is wrapped in a serializable
// transaction so two near-simultaneous first opens of the same project can't both
// pass the count===0 check and double-insert the checklist; the loser conflicts
// and is safely ignored (the checklist already exists).
type Tx = Prisma.TransactionClient;
async function seedOnce(fn: (tx: Tx) => Promise<void>) {
  try {
    await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034")) throw e;
  }
}

async function ensureReadinessSeeded(projectId: string) {
  await seedOnce(async (tx) => {
    const count = await tx.venueReadinessItem.count({ where: { projectId } });
    if (count > 0) return;
    await tx.venueReadinessItem.createMany({
      data: READINESS_CHECKLIST.map((it, i) => ({
        projectId,
        category: it.category,
        title: it.title,
        standard: it.standard,
        order: i,
      })),
    });
  });
}

async function ensureOpsAuditSeeded(projectId: string) {
  await seedOnce(async (tx) => {
    const count = await tx.opsAuditItem.count({ where: { projectId } });
    if (count > 0) return;
    await tx.opsAuditItem.createMany({
      data: OPS_AUDIT_CHECKLIST.map((it, i) => ({
        projectId,
        category: it.category,
        title: it.title,
        critical: it.critical,
        order: i,
      })),
    });
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
// Only the early, manual phases can be set freely. The later gated phases —
// OPS_AUDIT, HANDOVER, LAUNCHED — are reached ONLY through requestOpsAudit,
// completeOpsAudit, generateHandover and launchProject (which enforce their
// preconditions), so the phase dropdown can't be used to skip the gates.
const MANUAL_PHASES = ["PLANNING", "CAPEX", "EXECUTION"];

export async function setProjectPhase(id: string, phase: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  if (!MANUAL_PHASES.includes(phase)) {
    return { success: false, error: "That phase is reached via its workflow step (audit / handover / launch), not set directly." };
  }
  // Don't allow regressing a project that has already entered the gated workflow
  // (OPS_AUDIT/HANDOVER/LAUNCHED) — that would strand stale audit/handover stamps
  // and let the launch button re-fire without a fresh audit.
  const current = await prisma.acqOnboardingProject.findUnique({ where: { id }, select: { phase: true } });
  if (!current) return { success: false, error: "Project not found" };
  if (!MANUAL_PHASES.includes(current.phase)) {
    return { success: false, error: "This project is past the manual phases; it advances only through the audit / handover / launch workflow." };
  }
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
  if (patch.status !== undefined && !READINESS_STATUSES.includes(patch.status)) return { success: false, error: "Invalid status" };
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
  // Gate: the audit can only be requested once execution is complete. This keeps
  // the phase machine honest — a project can't jump PLANNING/CAPEX → OPS_AUDIT.
  const existing = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!existing) return { success: false, error: "Project not found" };
  if (existing.phase !== "EXECUTION") {
    return { success: false, error: "Finish execution before requesting the operations audit." };
  }
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
  if (patch.status !== undefined && !AUDIT_STATUSES.includes(patch.status)) return { success: false, error: "Invalid status" };
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
  // The audit must actually be in progress: project in OPS_AUDIT with a seeded
  // checklist. Otherwise an empty item list would vacuously "pass" the gate.
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, opsAuditRequestedAt: true } });
  if (!project) return { success: false, error: "Project not found" };
  if (project.phase !== "OPS_AUDIT" || !project.opsAuditRequestedAt) {
    return { success: false, error: "Request the operations audit before signing it off." };
  }
  const items = await prisma.opsAuditItem.findMany({ where: { projectId }, select: { critical: true, status: true } });
  if (!items.length) return { success: false, error: "The audit checklist has not been started." };
  const blocking = items.filter((i) => i.critical && i.status !== "PASS" && i.status !== "NA");
  if (blocking.length) {
    return { success: false, error: `${blocking.length} critical audit item(s) are not yet passed.` };
  }
  // Scope the transition to the expected phase so a concurrent change can't double-apply.
  const res = await prisma.acqOnboardingProject.updateMany({
    where: { id: projectId, phase: "OPS_AUDIT" },
    data: { opsAuditPassedAt: new Date(), opsAuditById: user.id, phase: "HANDOVER" },
  });
  if (res.count === 0) return { success: false, error: "Project is no longer awaiting audit sign-off." };
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// ------------------------------------------------------------
// Handover report + launch
// ------------------------------------------------------------
export async function generateHandover(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can submit the handover." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, opsAuditPassedAt: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (project.phase !== "HANDOVER" || !project.opsAuditPassedAt) return { success: false, error: "The operations audit must pass before handover." };
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
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, handoverReportAt: true, propertyId: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (project.phase !== "HANDOVER" || !project.handoverReportAt) return { success: false, error: "Submit the handover report before launch." };
  // Scope the project transition to the expected phase so a double-click or
  // concurrent launch can't fire the side-effects (property AVAILABLE, notifications) twice.
  const launched = await prisma.acqOnboardingProject.updateMany({ where: { id: projectId, phase: "HANDOVER" }, data: { phase: "LAUNCHED", launchedAt: new Date(), status: "COMPLETED", completedAt: new Date() } });
  if (launched.count === 0) return { success: false, error: "Project is no longer awaiting launch." };
  await prisma.acqProperty.update({ where: { id: project.propertyId }, data: { status: "AVAILABLE", availableAt: new Date() } });
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
  // Allocate the next version atomically. Under serializable isolation two
  // concurrent creates can't read the same max version; the loser is retried
  // rather than silently duplicating a version number.
  let row: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    try {
      row = await prisma.$transaction(
        async (tx) => {
          const last = await tx.acqCapexProjection.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
          return tx.acqCapexProjection.create({
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (e) {
      // P2034 = write conflict / serialization failure — retry. Anything else, surface.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") || attempt === 2) throw e;
    }
  }
  if (!row) return { success: false, error: "Could not create the projection, please retry." };
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
  // Opaque token so the owner-facing PDF link isn't a plain id-based IDOR. Stable
  // once set so a re-approval doesn't invalidate a link already shared.
  const shareToken = row.shareToken ?? randomBytes(24).toString("base64url");
  await prisma.acqCapexProjection.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), outputsJson: out as unknown as Prisma.InputJsonValue, shareToken, pdfUrl: `/api/projects/capex/${id}/pdf?token=${shareToken}` },
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
  if (!opts?.channel || !["EMAIL", "WHATSAPP", "MANUAL"].includes(opts.channel)) return { success: false, error: "Invalid channel." };
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
