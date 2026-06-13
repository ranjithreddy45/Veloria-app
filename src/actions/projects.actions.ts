"use server";

import { randomBytes } from "crypto";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { computeCapex, validateCapexInput, type CapexInput, type CapexResult } from "@/lib/projects/capex-calc";
import { READINESS_CHECKLIST, readinessSeverity } from "@/lib/projects/readiness-config";
import { OPS_AUDIT_CHECKLIST } from "@/lib/projects/ops-audit-config";
import { normalizePhase, phaseMatchValues, PROJECT_PHASES, type ProjectPhase } from "@/lib/projects/phases";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const READINESS_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "NA"];
const AUDIT_STATUSES = ["PENDING", "PASS", "FAIL", "NA"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// --- audit trail + sign-off helpers -------------------------------------------
type Actor = { id: string; name?: string | null };
async function addAudit(
  client: Prisma.TransactionClient | typeof prisma,
  actor: Actor,
  e: { projectId: string; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown }
) {
  await client.projectAuditLog.create({
    data: {
      projectId: e.projectId,
      actorId: actor.id,
      actorName: actor.name ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      beforeJson: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
async function recordSignOff(
  client: Prisma.TransactionClient | typeof prisma,
  e: { projectId: string; stage: string; decision: "APPROVED" | "REJECTED" | "REOPENED"; approverId: string; comment?: string }
) {
  await client.projectSignOff.create({
    data: { projectId: e.projectId, stage: e.stage, decision: e.decision, approverId: e.approverId, comment: e.comment || null },
  });
}
async function notifyRoles(roles: string[], n: { type: "TASK_ASSIGNED" | "SYSTEM"; title: string; message: string; actionUrl: string }) {
  const users = await prisma.user.findMany({ where: { isActive: true, role: { in: roles as never } }, select: { id: true } });
  for (const u of users) notify({ userId: u.id, ...n });
}

// Snag gate helpers — a snag is "open" until Operations marks it verified-closed.
const OPEN_SNAG_STATUSES = ["OPEN", "IN_PROGRESS", "FIXED_PENDING_VERIFICATION", "REOPENED"];
async function countOpenCriticalMajorSnags(projectId: string): Promise<number> {
  return prisma.projectSnag.count({ where: { projectId, status: { in: OPEN_SNAG_STATUSES }, severity: { in: ["CRITICAL", "MAJOR"] } } });
}
async function countUnverifiedSnags(projectId: string): Promise<number> {
  return prisma.projectSnag.count({ where: { projectId, status: { not: "VERIFIED_CLOSED" } } });
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
        severity: readinessSeverity(it.category),
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
      phase: normalizePhase(p.phase),
      status: p.status,
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
      bdOwner: { select: { name: true } },
      opsAuditBy: { select: { name: true } },
      finalGoAheadBy: { select: { name: true } },
      handoverBy: { select: { name: true } },
      readinessItems: { orderBy: { order: "asc" } },
      opsAuditItems: { orderBy: { order: "asc" } },
      capexProjections: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      },
      signOffs: { orderBy: { createdAt: "desc" }, include: { approver: { select: { name: true } } } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      snags: { include: { photos: { orderBy: { createdAt: "asc" } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
    },
  });
  if (!row) return { success: false, error: "Project not found" };
  // Surface the canonical stage to the UI while leaving the stored value intact
  // (it's normalised to canonical on the next transition).
  return { success: true, data: serialize({ ...row, phase: normalizePhase(row.phase) }) };
}

// ------------------------------------------------------------
// Stage machine — every transition is gated, atomic, and writes a SignOff +
// AuditLog. Stages advance only through these actions (no free phase-set);
// backward moves go through reopenProject (Head/Admin only, logged).
// ------------------------------------------------------------

// Forward-stage completion stamps, used to clear state on reopen so re-advancing
// re-runs every gate cleanly.
const STAGE_STAMPS: Record<ProjectPhase, (keyof Prisma.AcqOnboardingProjectUncheckedUpdateInput)[]> = {
  HANDOFF: ["handoffAcceptedAt"],
  ASSESSMENT: ["assessmentDoneAt"],
  CAPEX: ["ownerApproved", "ownerApprovedAt", "ownerApprovalProofUrl"],
  EXECUTION: ["startedAt"],
  INTERNAL_QC: ["qcReadyAt", "opsAuditRequestedAt"],
  OPS_AUDIT: ["opsAuditPassedAt", "opsAuditById"],
  FINAL_GO_AHEAD: ["finalGoAheadAt", "finalGoAheadById"],
  HANDOVER: ["handoverReportAt", "handoverById", "opsAcknowledgedAt", "mgmtAcknowledgedAt"],
  LIVE: ["launchedAt", "completedAt"],
};

// Atomically move a project from `from` to `to` (matching legacy phase values too),
// recording the sign-off + audit entry in the same transaction.
async function advanceStage(
  user: Actor,
  projectId: string,
  from: ProjectPhase,
  to: ProjectPhase,
  stamp: Prisma.AcqOnboardingProjectUncheckedUpdateManyInput = {},
  decision: "APPROVED" = "APPROVED"
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.acqOnboardingProject.updateMany({
      where: { id: projectId, phase: { in: phaseMatchValues(from) } },
      data: { phase: to, ...stamp },
    });
    if (res.count === 0) return false;
    await recordSignOff(tx, { projectId, stage: from, decision, approverId: user.id });
    await addAudit(tx, user, { projectId, action: `phase:${from}->${to}`, entityType: "project", entityId: projectId, before: { phase: from }, after: { phase: to } });
    return true;
  });
}

const FUNDING_MODELS = ["OWNER", "VELORIA", "SPLIT"];

// Edit the venue master data that drives the calculator + spec sheet.
export async function updateProjectMaster(
  id: string,
  patch: { ownerContact?: string; fundingModel?: string | null; splitRatio?: number | null; hallCount?: number | null; totalCapacity?: number | null; totalSqft?: number | null; dealClosedDate?: string | null; targetReadyDate?: string | null; bdOwnerId?: string | null; notes?: string | null }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  if (patch.fundingModel != null && patch.fundingModel !== "" && !FUNDING_MODELS.includes(patch.fundingModel)) return { success: false, error: "Invalid funding model." };
  const data: Prisma.AcqOnboardingProjectUncheckedUpdateInput = {};
  if (patch.ownerContact !== undefined) data.ownerContact = patch.ownerContact || null;
  if (patch.fundingModel !== undefined) data.fundingModel = patch.fundingModel || null;
  if (patch.splitRatio !== undefined) data.splitRatio = patch.splitRatio == null ? null : new Prisma.Decimal(patch.splitRatio);
  if (patch.hallCount !== undefined) data.hallCount = patch.hallCount;
  if (patch.totalCapacity !== undefined) data.totalCapacity = patch.totalCapacity;
  if (patch.totalSqft !== undefined) data.totalSqft = patch.totalSqft;
  if (patch.dealClosedDate !== undefined) data.dealClosedDate = patch.dealClosedDate ? new Date(patch.dealClosedDate) : null;
  if (patch.targetReadyDate !== undefined) data.targetReadyDate = patch.targetReadyDate ? new Date(patch.targetReadyDate) : null;
  if (patch.bdOwnerId !== undefined) data.bdOwnerId = patch.bdOwnerId || null;
  if (patch.notes !== undefined) data.notes = patch.notes || null;
  await prisma.acqOnboardingProject.update({ where: { id }, data });
  await addAudit(prisma, user, { projectId: id, action: "project.master.update", entityType: "project", entityId: id, after: patch });
  revalidatePath(`/projects/${id}`);
  return { success: true, data: { id } };
}

// active (OPEN) / on-hold / cancelled. Cancelling needs Head/Admin.
export async function setProjectStatus(id: string, status: "OPEN" | "ON_HOLD" | "CANCELLED"): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["OPEN", "ON_HOLD", "CANCELLED"].includes(status)) return { success: false, error: "Invalid status" };
  const perm = status === "CANCELLED" ? "projects:approve" : "projects:update";
  if (!can(user.role, perm)) return { success: false, error: "Unauthorized" };
  const before = await prisma.acqOnboardingProject.findUnique({ where: { id }, select: { status: true } });
  await prisma.acqOnboardingProject.update({ where: { id }, data: { status } });
  await addAudit(prisma, user, { projectId: id, action: "project.status", entityType: "project", entityId: id, before, after: { status } });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { success: true, data: { status } };
}

// Stage 1→2: PM accepts the BD handoff; readiness checklist is instantiated.
export async function acceptHandoff(projectId: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const p = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!p) return { success: false, error: "Project not found" };
  if (normalizePhase(p.phase) !== "HANDOFF") return { success: false, error: "This project has already been accepted into Projects." };
  await ensureReadinessSeeded(projectId);
  const ok = await advanceStage(user, projectId, "HANDOFF", "ASSESSMENT", { handoffAcceptedAt: new Date() });
  if (!ok) return { success: false, error: "Project is no longer awaiting handoff." };
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { phase: "ASSESSMENT" } };
}

// Stage 2→3: scoping done (standards checklist instantiated, gaps identified).
export async function completeAssessment(projectId: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const p = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!p) return { success: false, error: "Project not found" };
  if (normalizePhase(p.phase) !== "ASSESSMENT") return { success: false, error: "Assessment can only be completed from the Assessment stage." };
  await ensureReadinessSeeded(projectId);
  const ok = await advanceStage(user, projectId, "ASSESSMENT", "CAPEX", { assessmentDoneAt: new Date() });
  if (!ok) return { success: false, error: "Project is no longer in Assessment." };
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { phase: "CAPEX" } };
}

// Record the venue owner's approval of the CapEx + timeline (external sign-off,
// captured by the PM with optional uploaded proof). Not a phase change.
export async function recordOwnerApproval(projectId: string, proofUrl?: string): Promise<Result<{ ownerApproved: boolean }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const p = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!p) return { success: false, error: "Project not found" };
  await prisma.acqOnboardingProject.update({ where: { id: projectId }, data: { ownerApproved: true, ownerApprovedAt: new Date(), ownerApprovalProofUrl: proofUrl || null } });
  await addAudit(prisma, user, { projectId, action: "owner.approved", entityType: "project", entityId: projectId, after: { ownerApproved: true, proofUrl: proofUrl || null } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { ownerApproved: true } };
}

// Stage 3→4: begin fit-out. Requires an approved CapEx model + recorded owner approval.
export async function startExecution(projectId: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const p = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, ownerApproved: true } });
  if (!p) return { success: false, error: "Project not found" };
  if (normalizePhase(p.phase) !== "CAPEX") return { success: false, error: "Execution starts from the CapEx & Timeline stage." };
  const approvedCapex = await prisma.acqCapexProjection.count({ where: { projectId, status: { in: ["APPROVED", "SENT"] } } });
  if (!approvedCapex) return { success: false, error: "Approve a CapEx model before starting execution." };
  if (!p.ownerApproved) return { success: false, error: "Record the owner's CapEx & timeline approval before starting execution." };
  const ok = await advanceStage(user, projectId, "CAPEX", "EXECUTION", { startedAt: new Date() });
  if (!ok) return { success: false, error: "Project is no longer in the CapEx stage." };
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { phase: "EXECUTION" } };
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

// Stage 4→5: enter Internal QC. Exit criterion: every standards/readiness item
// is resolved (DONE or N/A). (Wave D additionally requires all work packages complete.)
export async function enterInternalQc(projectId: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const p = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!p) return { success: false, error: "Project not found" };
  if (normalizePhase(p.phase) !== "EXECUTION") return { success: false, error: "Internal QC starts from the Execution stage." };
  await ensureReadinessSeeded(projectId);
  const items = await prisma.venueReadinessItem.findMany({ where: { projectId }, select: { status: true } });
  const pending = items.filter((i) => i.status !== "DONE" && i.status !== "NA").length;
  if (pending) return { success: false, error: `${pending} readiness item(s) still open — every standard must pass (or be marked N/A) before Internal QC.` };
  const ok = await advanceStage(user, projectId, "EXECUTION", "INTERNAL_QC");
  if (!ok) return { success: false, error: "Project is no longer in Execution." };
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { phase: "INTERNAL_QC" } };
}

// ------------------------------------------------------------
// Stage 5→6: PM requests the Operations deep audit.
// (Wave B additionally blocks on any open critical/major snag.)
// ------------------------------------------------------------
export async function requestOpsAudit(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const existing = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, property: { select: { propertyName: true } } } });
  if (!existing) return { success: false, error: "Project not found" };
  if (normalizePhase(existing.phase) !== "INTERNAL_QC") {
    return { success: false, error: "Clear Internal QC before requesting the operations audit." };
  }
  const openBlocking = await countOpenCriticalMajorSnags(projectId);
  if (openBlocking) return { success: false, error: `${openBlocking} open critical/major snag(s) must be cleared before the operations audit.` };
  await ensureOpsAuditSeeded(projectId);
  const ok = await advanceStage(user, projectId, "INTERNAL_QC", "OPS_AUDIT", { qcReadyAt: new Date(), opsAuditRequestedAt: new Date() });
  if (!ok) return { success: false, error: "Project is no longer in Internal QC." };
  await notifyRoles(["OPERATIONS", "SUPER_ADMIN", "ADMIN"], { type: "TASK_ASSIGNED", title: "Venue ready for ops audit", message: `${existing.property.propertyName ?? "A venue"} cleared Internal QC — run the deep audit before launch.`, actionUrl: `/projects/${projectId}` });
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

// Stage 6→7: Ops signs off the audit — all critical items pass.
// (Wave B additionally requires 100% of snags verified-closed.)
export async function completeOpsAudit(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:audit")) return { success: false, error: "Only the Operations team can sign off the audit." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, opsAuditRequestedAt: true } });
  if (!project) return { success: false, error: "Project not found" };
  if (normalizePhase(project.phase) !== "OPS_AUDIT" || !project.opsAuditRequestedAt) {
    return { success: false, error: "Request the operations audit before signing it off." };
  }
  const items = await prisma.opsAuditItem.findMany({ where: { projectId }, select: { critical: true, status: true } });
  if (!items.length) return { success: false, error: "The audit checklist has not been started." };
  const blocking = items.filter((i) => i.critical && i.status !== "PASS" && i.status !== "NA");
  if (blocking.length) {
    return { success: false, error: `${blocking.length} critical audit item(s) are not yet passed.` };
  }
  const unverified = await countUnverifiedSnags(projectId);
  if (unverified) return { success: false, error: `${unverified} snag(s) are not yet verified-closed — every snag must be closed before sign-off.` };
  const ok = await advanceStage(user, projectId, "OPS_AUDIT", "FINAL_GO_AHEAD", { opsAuditPassedAt: new Date(), opsAuditById: user.id });
  if (!ok) return { success: false, error: "Project is no longer awaiting audit sign-off." };
  await notifyRoles(["PROJECTS_HEAD", "SUPER_ADMIN", "ADMIN"], { type: "SYSTEM", title: "Audit passed — awaiting final go-ahead", message: "Operations signed off the audit. The Projects Head can now give the launch go-ahead.", actionUrl: `/projects/${projectId}` });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// Stage 7→8: Projects Head gives the final go-ahead.
// (Wave B additionally blocks while any critical/major snag is open.)
export async function finalGoAhead(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can give the final go-ahead." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, opsAuditPassedAt: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (normalizePhase(project.phase) !== "FINAL_GO_AHEAD" || !project.opsAuditPassedAt) {
    return { success: false, error: "The operations audit must pass before the final go-ahead." };
  }
  const blocking = await countOpenCriticalMajorSnags(projectId);
  if (blocking) return { success: false, error: `${blocking} open critical/major snag(s) still block the final go-ahead.` };
  const ok = await advanceStage(user, projectId, "FINAL_GO_AHEAD", "HANDOVER", { finalGoAheadAt: new Date(), finalGoAheadById: user.id });
  if (!ok) return { success: false, error: "Project is no longer awaiting the final go-ahead." };
  await notifyRoles(["OPERATIONS", "SUPER_ADMIN", "ADMIN"], { type: "SYSTEM", title: "Final go-ahead given", message: `${project.property.propertyName} is cleared for handover & launch.`, actionUrl: `/projects/${projectId}` });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// ------------------------------------------------------------
// Handover report → acknowledgements → launch
// ------------------------------------------------------------
// Stage 8: PM submits the handover report (data is auto-compiled at render time).
export async function generateHandover(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:update")) return { success: false, error: "Unauthorized" };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, finalGoAheadAt: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (normalizePhase(project.phase) !== "HANDOVER" || !project.finalGoAheadAt) return { success: false, error: "The final go-ahead must be given before the handover report." };
  await prisma.acqOnboardingProject.update({ where: { id: projectId }, data: { handoverReportAt: new Date(), handoverById: user.id } });
  await addAudit(prisma, user, { projectId, action: "handover.submit", entityType: "project", entityId: projectId });
  await notifyRoles(["OPERATIONS", "SUPER_ADMIN", "ADMIN"], { type: "SYSTEM", title: "Venue handover report ready", message: `Handover report submitted for ${project.property.propertyName}. Please review & acknowledge.`, actionUrl: `/projects/${projectId}` });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// Stage 8: Operations + Management acknowledge the handover report (dual gate).
export async function acknowledgeHandover(projectId: string, by: "OPS" | "MGMT"): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  const perm = by === "OPS" ? "projects:audit" : "projects:approve";
  if (!can(user.role, perm)) return { success: false, error: by === "OPS" ? "Only Operations can acknowledge on behalf of Ops." : "Only Management can acknowledge on behalf of Management." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, handoverReportAt: true } });
  if (!project) return { success: false, error: "Project not found" };
  if (normalizePhase(project.phase) !== "HANDOVER" || !project.handoverReportAt) return { success: false, error: "The handover report has not been submitted yet." };
  await prisma.acqOnboardingProject.update({ where: { id: projectId }, data: by === "OPS" ? { opsAcknowledgedAt: new Date() } : { mgmtAcknowledgedAt: new Date() } });
  await addAudit(prisma, user, { projectId, action: `handover.ack:${by}`, entityType: "project", entityId: projectId });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: projectId } };
}

// Stage 8→9: launch once the report is submitted and both acknowledgements are in.
export async function launchProject(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head can give the launch go-ahead." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true, handoverReportAt: true, opsAcknowledgedAt: true, mgmtAcknowledgedAt: true, propertyId: true, property: { select: { propertyName: true } } } });
  if (!project) return { success: false, error: "Project not found" };
  if (normalizePhase(project.phase) !== "HANDOVER" || !project.handoverReportAt) return { success: false, error: "Submit the handover report before launch." };
  if (!project.opsAcknowledgedAt || !project.mgmtAcknowledgedAt) return { success: false, error: "Both Operations and Management must acknowledge the handover report before launch." };
  const ok = await advanceStage(user, projectId, "HANDOVER", "LIVE", { launchedAt: new Date(), status: "COMPLETED", completedAt: new Date() });
  if (!ok) return { success: false, error: "Project is no longer awaiting launch." };
  await prisma.acqProperty.update({ where: { id: project.propertyId }, data: { status: "AVAILABLE", availableAt: new Date() } });
  await notifyRoles(["SALES_EXEC", "EVENT_COORDINATOR", "SUPER_ADMIN", "ADMIN"], { type: "SYSTEM", title: "New venue is live!", message: `${project.property.propertyName} has launched — start generating bookings.`, actionUrl: `/projects/${projectId}` });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, data: { id: projectId } };
}

// Backward move — Projects Head / Admin only, always logged. Clears the completion
// stamps for the target stage and everything after it, so re-advancing re-runs gates.
export async function reopenProject(projectId: string, toStage: string, reason: string): Promise<Result<{ phase: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:approve")) return { success: false, error: "Only a Projects Head or Admin can re-open a stage." };
  if (!reason?.trim()) return { success: false, error: "A reason is required to re-open a stage." };
  const target = normalizePhase(toStage);
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!project) return { success: false, error: "Project not found" };
  const current = normalizePhase(project.phase);
  if (current === "LIVE") return { success: false, error: "A live venue can't be re-opened — Operations now owns it." };
  const curIdx = PROJECT_PHASES.indexOf(current);
  const tgtIdx = PROJECT_PHASES.indexOf(target);
  if (tgtIdx >= curIdx) return { success: false, error: "Re-open can only move a project to an earlier stage." };
  // Null out every completion stamp from the target stage onward.
  const data: Prisma.AcqOnboardingProjectUncheckedUpdateInput = { phase: target, status: "OPEN" };
  for (let i = tgtIdx; i < PROJECT_PHASES.length; i++) {
    for (const f of STAGE_STAMPS[PROJECT_PHASES[i]]) {
      (data as Record<string, unknown>)[f as string] = f === "ownerApproved" ? false : null;
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.acqOnboardingProject.update({ where: { id: projectId }, data });
    await recordSignOff(tx, { projectId, stage: current, decision: "REOPENED", approverId: user.id, comment: reason.trim() });
    await addAudit(tx, user, { projectId, action: `phase.reopen:${current}->${target}`, entityType: "project", entityId: projectId, before: { phase: current }, after: { phase: target, reason: reason.trim() } });
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, data: { phase: target } };
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
