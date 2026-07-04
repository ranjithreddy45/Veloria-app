"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
function isManager(role: string | undefined) {
  // "manager" = can manage others' records. hr:write is the real grant HR
  // leads have (there is no hr:manage permission in the enum); hr:admin too.
  return can(role, "hr:write") || can(role, "hr:admin");
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function toNum(v: Prisma.Decimal | null | undefined): number | null {
  return v == null ? null : Number(v);
}

// ============================================================
// Read
// ============================================================
export type KeyResultDTO = {
  id: string;
  objectiveId: string;
  title: string;
  target: number | null;
  current: number | null;
  unit: string | null;
  progress: number;
};
export type ObjectiveDTO = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string | null;
  period: string;
  status: string;
  progress: number;
  createdAt: Date;
  keyResults: KeyResultDTO[];
};

/**
 * List objectives with their key results. Defaults to the current user's own.
 * Managers (hr:manage / hr:admin) may pass an ownerId to view a teammate's.
 * ownerId is a plain userId ref, so the owner's name is fetched separately.
 */
export async function getObjectives(params?: { ownerId?: string }): Promise<ObjectiveDTO[]> {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:read")) return [];

  let ownerId = u.id;
  if (params?.ownerId && params.ownerId !== u.id) {
    if (!isManager(u.role)) return []; // only managers can view others
    ownerId = params.ownerId;
  }

  const objectives = await prisma.objective.findMany({
    where: { ownerId },
    include: { keyResults: { orderBy: { id: "asc" } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
  const ownerName = owner?.name || owner?.email || "Unknown";

  return objectives.map((o) => ({
    id: o.id,
    ownerId: o.ownerId,
    ownerName,
    title: o.title,
    description: o.description,
    period: o.period,
    status: o.status,
    progress: o.progress,
    createdAt: o.createdAt,
    keyResults: o.keyResults.map((kr) => ({
      id: kr.id,
      objectiveId: kr.objectiveId,
      title: kr.title,
      target: toNum(kr.target),
      current: toNum(kr.current),
      unit: kr.unit,
      progress: kr.progress,
    })),
  }));
}

/**
 * Active internal users a manager can view/switch between. Returns [] for
 * non-managers (they only ever see their own board).
 */
export async function listOkrOwners(): Promise<{ id: string; name: string }[]> {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:read") || !isManager(u.role)) return [];
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users.map((x) => ({ id: x.id, name: x.name || x.email || "Unknown" }));
}

// ============================================================
// Objective mutations
// ============================================================
async function canManageObjective(u: { id: string; role?: string }, ownerId: string) {
  return ownerId === u.id || isManager(u.role);
}

export async function createObjective(input: {
  title: string;
  description?: string;
  period: string;
  ownerId?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:read")) return { success: false, error: "Not authorized." };
  if (!input.title?.trim()) return { success: false, error: "Title is required." };
  if (!input.period?.trim()) return { success: false, error: "Period is required." };

  const ownerId = input.ownerId && input.ownerId !== u.id ? input.ownerId : u.id;
  if (!(await canManageObjective(u, ownerId)))
    return { success: false, error: "You can only create objectives for yourself." };

  const o = await prisma.objective.create({
    data: {
      ownerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      period: input.period.trim(),
      createdById: u.id,
    },
  });
  revalidatePath("/people/okr");
  return { success: true, data: { id: o.id } };
}

export async function updateObjective(
  id: string,
  input: { title?: string; description?: string; status?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const obj = await prisma.objective.findUnique({ where: { id }, select: { ownerId: true } });
  if (!obj) return { success: false, error: "Objective not found." };
  if (!(await canManageObjective(u, obj.ownerId))) return { success: false, error: "Not authorized." };

  const data: Prisma.ObjectiveUpdateInput = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) return { success: false, error: "Title cannot be empty." };
    data.title = input.title.trim();
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.status !== undefined) {
    if (!["ACTIVE", "DONE", "ARCHIVED"].includes(input.status))
      return { success: false, error: "Invalid status." };
    data.status = input.status;
  }

  await prisma.objective.update({ where: { id }, data });
  revalidatePath("/people/okr");
  return { success: true, data: { id } };
}

export async function deleteObjective(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const obj = await prisma.objective.findUnique({ where: { id }, select: { ownerId: true } });
  if (!obj) return { success: false, error: "Objective not found." };
  if (!(await canManageObjective(u, obj.ownerId))) return { success: false, error: "Not authorized." };

  // Key results cascade-delete via the schema relation.
  await prisma.objective.delete({ where: { id } });
  revalidatePath("/people/okr");
  return { success: true, data: { id } };
}

// ============================================================
// Key-result mutations
// ============================================================
/** Recompute an objective's progress (avg of KR progress) and DONE status. */
async function recomputeObjective(objectiveId: string) {
  const krs = await prisma.keyResult.findMany({ where: { objectiveId }, select: { progress: true } });
  const avg = krs.length ? Math.round(krs.reduce((s, k) => s + k.progress, 0) / krs.length) : 0;
  const objective = await prisma.objective.findUnique({ where: { id: objectiveId }, select: { status: true } });
  const data: Prisma.ObjectiveUpdateInput = { progress: avg };
  if (avg >= 100) {
    data.status = "DONE";
  } else if (objective?.status === "DONE") {
    // fell back below 100 — reopen
    data.status = "ACTIVE";
  }
  await prisma.objective.update({ where: { id: objectiveId }, data });
}

function computeKrProgress(current: number | null, target: number | null): number | null {
  if (current == null || target == null || target === 0) return null;
  return clamp(Math.round((current / target) * 100), 0, 100);
}

export async function addKeyResult(
  objectiveId: string,
  input: { title: string; target?: number | null; current?: number | null; unit?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const obj = await prisma.objective.findUnique({ where: { id: objectiveId }, select: { ownerId: true } });
  if (!obj) return { success: false, error: "Objective not found." };
  if (!(await canManageObjective(u, obj.ownerId))) return { success: false, error: "Not authorized." };
  if (!input.title?.trim()) return { success: false, error: "Key result title is required." };

  const target = input.target ?? null;
  const current = input.current ?? null;
  const progress = computeKrProgress(current, target) ?? 0;

  const kr = await prisma.keyResult.create({
    data: {
      objectiveId,
      title: input.title.trim(),
      target: target != null ? new Prisma.Decimal(target) : null,
      current: current != null ? new Prisma.Decimal(current) : null,
      unit: input.unit?.trim() || null,
      progress,
    },
  });
  await recomputeObjective(objectiveId);
  revalidatePath("/people/okr");
  return { success: true, data: { id: kr.id } };
}

export async function updateKeyResult(
  id: string,
  input: { current?: number | null; target?: number | null; progress?: number }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const kr = await prisma.keyResult.findUnique({
    where: { id },
    include: { objective: { select: { id: true, ownerId: true } } },
  });
  if (!kr) return { success: false, error: "Key result not found." };
  if (!(await canManageObjective(u, kr.objective.ownerId))) return { success: false, error: "Not authorized." };

  const data: Prisma.KeyResultUpdateInput = {};
  const nextTarget = input.target !== undefined ? input.target : toNum(kr.target);
  const nextCurrent = input.current !== undefined ? input.current : toNum(kr.current);

  if (input.target !== undefined) data.target = input.target != null ? new Prisma.Decimal(input.target) : null;
  if (input.current !== undefined) data.current = input.current != null ? new Prisma.Decimal(input.current) : null;

  // When current/target are known, derive progress; else allow an explicit manual progress.
  const derived = computeKrProgress(nextCurrent, nextTarget);
  if (derived != null) {
    data.progress = derived;
  } else if (input.progress !== undefined) {
    data.progress = clamp(Math.round(input.progress), 0, 100);
  }

  await prisma.keyResult.update({ where: { id }, data });
  await recomputeObjective(kr.objective.id);
  revalidatePath("/people/okr");
  return { success: true, data: { id } };
}

export async function deleteKeyResult(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const kr = await prisma.keyResult.findUnique({
    where: { id },
    include: { objective: { select: { id: true, ownerId: true } } },
  });
  if (!kr) return { success: false, error: "Key result not found." };
  if (!(await canManageObjective(u, kr.objective.ownerId))) return { success: false, error: "Not authorized." };

  await prisma.keyResult.delete({ where: { id } });
  await recomputeObjective(kr.objective.id);
  revalidatePath("/people/okr");
  return { success: true, data: { id } };
}
