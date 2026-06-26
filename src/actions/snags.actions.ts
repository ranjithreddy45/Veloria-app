"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { normalizePhase } from "@/lib/projects/phases";
import type { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR"];
const EDITABLE_STATUSES = ["OPEN", "IN_PROGRESS", "FIXED_PENDING_VERIFICATION", "REOPENED"];
const PHOTO_KINDS = ["BEFORE", "DURING", "AFTER"];
// Cap applies to inline base64 data-URLs, whose string length is (roughly) the
// payload size. https links are external references, so we only bound their
// length to reject absurd/abusive strings — the byte cap can't apply to them.
const MAX_PHOTO_BYTES = 7_000_000;
const MAX_PHOTO_URL_CHARS = 2_048;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
async function audit(actor: { id: string; name?: string | null }, e: { projectId: string; action: string; entityId: string; before?: unknown; after?: unknown }) {
  await prisma.projectAuditLog.create({
    data: {
      projectId: e.projectId,
      actorId: actor.id,
      actorName: actor.name ?? null,
      action: e.action,
      entityType: "snag",
      entityId: e.entityId,
      beforeJson: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getSnags(projectId: string): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:read")) return { success: false, error: "Unauthorized" };
  const snags = await prisma.projectSnag.findMany({
    where: { projectId },
    include: { photos: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return { success: true, data: serialize(snags) as unknown[] };
}

export async function createSnag(
  projectId: string,
  data: { title: string; description?: string; category: string; location?: string; severity: string; dueDate?: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  // PM (projects:update) raises in QC; Operations (projects:audit) raises during the deep audit.
  if (!user || (!can(user.role, "projects:update") && !can(user.role, "projects:audit"))) return { success: false, error: "Unauthorized" };
  if (!data.title?.trim()) return { success: false, error: "A title is required." };
  if (!data.category?.trim()) return { success: false, error: "A category is required." };
  if (!SEVERITIES.includes(data.severity)) return { success: false, error: "Invalid severity." };
  const project = await prisma.acqOnboardingProject.findUnique({ where: { id: projectId }, select: { phase: true } });
  if (!project) return { success: false, error: "Project not found" };
  const raisedInStage = normalizePhase(project.phase) === "OPS_AUDIT" ? "OPS_AUDIT" : "INTERNAL_QC";
  const snag = await prisma.projectSnag.create({
    data: {
      projectId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      category: data.category.trim(),
      location: data.location?.trim() || null,
      severity: data.severity,
      raisedInStage,
      raisedById: user.id,
      raisedByName: user.name ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    select: { id: true },
  });
  await audit(user, { projectId, action: "snag.create", entityId: snag.id, after: { title: data.title, severity: data.severity } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { id: snag.id } };
}

export async function updateSnag(
  snagId: string,
  patch: { title?: string; description?: string; category?: string; location?: string; severity?: string; dueDate?: string | null; status?: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || (!can(user.role, "projects:update") && !can(user.role, "projects:audit"))) return { success: false, error: "Unauthorized" };
  if (patch.severity !== undefined && !SEVERITIES.includes(patch.severity)) return { success: false, error: "Invalid severity." };
  // Verified-closed is reached only via verifySnag (Ops-only, after-photo required).
  if (patch.status !== undefined && !EDITABLE_STATUSES.includes(patch.status)) {
    return { success: false, error: patch.status === "VERIFIED_CLOSED" ? "Use the verify action to close a snag." : "Invalid status." };
  }
  const snag = await prisma.projectSnag.findUnique({ where: { id: snagId }, select: { projectId: true, status: true, severity: true } });
  if (!snag) return { success: false, error: "Snag not found" };
  // A projects:update executor must not be able to self-clear a launch blocker by
  // relabelling an open critical/major defect as minor — only Operations may downgrade.
  const RANK: Record<string, number> = { CRITICAL: 3, MAJOR: 2, MINOR: 1 };
  if (patch.severity !== undefined && (RANK[patch.severity] ?? 0) < (RANK[snag.severity] ?? 0) && !can(user.role, "projects:audit")) {
    return { success: false, error: "Only Operations can lower the severity of an existing critical/major snag." };
  }
  const data: Prisma.ProjectSnagUncheckedUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.category !== undefined) data.category = patch.category.trim();
  if (patch.location !== undefined) data.location = patch.location?.trim() || null;
  if (patch.severity !== undefined) data.severity = patch.severity;
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  if (patch.status !== undefined) {
    data.status = patch.status;
    // Stamp / clear the fix-cycle marker so the after-photo gate only accepts fresh evidence.
    if (patch.status === "FIXED_PENDING_VERIFICATION") data.fixedPendingAt = new Date();
    else if (patch.status === "OPEN" || patch.status === "IN_PROGRESS" || patch.status === "REOPENED") data.fixedPendingAt = null;
  }
  await prisma.projectSnag.update({ where: { id: snagId }, data });
  await audit(user, { projectId: snag.projectId, action: "snag.update", entityId: snagId, before: { status: snag.status }, after: patch });
  revalidatePath(`/projects/${snag.projectId}`);
  return { success: true, data: { id: snagId } };
}

// Ops-only close. Requires the snag to be fixed-pending-verification with an after-photo.
export async function verifySnag(snagId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "projects:audit")) return { success: false, error: "Only Operations can verify-close a snag." };
  const snag = await prisma.projectSnag.findUnique({ where: { id: snagId }, select: { projectId: true, status: true, fixedPendingAt: true } });
  if (!snag) return { success: false, error: "Snag not found" };
  if (snag.status !== "FIXED_PENDING_VERIFICATION") return { success: false, error: "The snag must be marked fixed (pending verification) first." };
  // The after-photo must be from THIS fix cycle (uploaded after it was marked fixed),
  // so a stale photo from a prior cycle or one attached while open can't satisfy the gate.
  const afterPhotos = snag.fixedPendingAt
    ? await prisma.projectPhoto.count({ where: { snagId, kind: "AFTER", createdAt: { gte: snag.fixedPendingAt } } })
    : 0;
  if (!afterPhotos) return { success: false, error: "Attach a fresh after-photo of this fix before verifying." };
  await prisma.projectSnag.update({ where: { id: snagId }, data: { status: "VERIFIED_CLOSED", verifiedById: user.id, verifiedByName: user.name ?? null, verifiedAt: new Date() } });
  await audit(user, { projectId: snag.projectId, action: "snag.verify_closed", entityId: snagId, before: { status: snag.status }, after: { status: "VERIFIED_CLOSED" } });
  revalidatePath(`/projects/${snag.projectId}`);
  return { success: true, data: { id: snagId } };
}

export async function reopenSnag(snagId: string, reason: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || (!can(user.role, "projects:update") && !can(user.role, "projects:audit"))) return { success: false, error: "Unauthorized" };
  if (!reason?.trim()) return { success: false, error: "A reason is required to re-open a snag." };
  const snag = await prisma.projectSnag.findUnique({ where: { id: snagId }, select: { projectId: true, status: true } });
  if (!snag) return { success: false, error: "Snag not found" };
  await prisma.projectSnag.update({ where: { id: snagId }, data: { status: "REOPENED", fixedPendingAt: null, verifiedById: null, verifiedByName: null, verifiedAt: null } });
  await audit(user, { projectId: snag.projectId, action: "snag.reopen", entityId: snagId, before: { status: snag.status }, after: { status: "REOPENED", reason: reason.trim() } });
  // Nudge the PM that a fix bounced.
  const pms = await prisma.user.findMany({ where: { isActive: true, role: { in: ["PROJECTS_EXEC", "PROJECTS_HEAD"] } }, select: { id: true } });
  for (const pm of pms) notify({ userId: pm.id, type: "TASK_ASSIGNED", title: "Snag re-opened", message: reason.trim(), actionUrl: `/projects/${snag.projectId}` });
  revalidatePath(`/projects/${snag.projectId}`);
  return { success: true, data: { id: snagId } };
}

export async function addSnagPhoto(snagId: string, photo: { url: string; kind: string; caption?: string }): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || (!can(user.role, "projects:update") && !can(user.role, "projects:audit"))) return { success: false, error: "Unauthorized" };
  if (!PHOTO_KINDS.includes(photo.kind)) return { success: false, error: "Invalid photo type." };
  if (!photo.url?.trim()) return { success: false, error: "Photo is missing." };
  const photoUrl = photo.url.trim();
  // Byte cap is only meaningful for inline base64 data-URLs (the string is the payload).
  if (photoUrl.startsWith("data:")) {
    if (photoUrl.length > MAX_PHOTO_BYTES) return { success: false, error: "Photo is too large (max ~7MB)." };
  } else if (photoUrl.length > MAX_PHOTO_URL_CHARS) {
    return { success: false, error: "Photo link is too long." };
  }
  if (!isSafeReceiptUrl(photoUrl)) return { success: false, error: "Only image/PDF uploads or https links are allowed." };
  const snag = await prisma.projectSnag.findUnique({ where: { id: snagId }, select: { projectId: true } });
  if (!snag) return { success: false, error: "Snag not found" };
  const row = await prisma.projectPhoto.create({
    data: {
      projectId: snag.projectId,
      snagId,
      entityType: "snag",
      entityId: snagId,
      kind: photo.kind,
      url: photoUrl,
      caption: photo.caption?.trim() || null,
      uploadedById: user.id,
      uploadedByName: user.name ?? null,
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${snag.projectId}`);
  return { success: true, data: { id: row.id } };
}
