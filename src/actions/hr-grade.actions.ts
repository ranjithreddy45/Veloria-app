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

// ============================================================
// Pay Grade / Band master — admin CRUD (gate: hr:admin).
// minCtc / maxCtc are Decimal in the DB; serialised as Number|null
// for the client so no Prisma.Decimal leaks across the boundary.
// ============================================================

export interface GradeListItem {
  id: string;
  code: string;
  name: string;
  level: number;
  minCtc: number | null;
  maxCtc: number | null;
  isActive: boolean;
  order: number;
}

export async function listGrades(): Promise<GradeListItem[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];
  const rows = await prisma.hrGrade.findMany({
    orderBy: [{ isActive: "desc" }, { level: "asc" }, { order: "asc" }, { code: "asc" }],
  });
  return rows.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    level: g.level,
    minCtc: g.minCtc == null ? null : Number(g.minCtc),
    maxCtc: g.maxCtc == null ? null : Number(g.maxCtc),
    isActive: g.isActive,
    order: g.order,
  }));
}

export interface GradeInput {
  id?: string;
  code: string;
  name: string;
  level?: number;
  minCtc?: number | null;
  maxCtc?: number | null;
  isActive?: boolean;
  order?: number;
}

export async function upsertGrade(input: GradeInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const code = input.code?.trim();
  const name = input.name?.trim();
  if (!code) return { success: false, error: "Code is required." };
  if (!name) return { success: false, error: "Name is required." };

  const level = input.level ?? 0;
  if (!Number.isFinite(level) || level < 0)
    return { success: false, error: "Level must be zero or a positive number." };

  const minCtc = input.minCtc == null ? null : Number(input.minCtc);
  const maxCtc = input.maxCtc == null ? null : Number(input.maxCtc);
  if (minCtc != null && (!Number.isFinite(minCtc) || minCtc < 0))
    return { success: false, error: "Minimum CTC must be a positive amount." };
  if (maxCtc != null && (!Number.isFinite(maxCtc) || maxCtc < 0))
    return { success: false, error: "Maximum CTC must be a positive amount." };
  if (minCtc != null && maxCtc != null && minCtc > maxCtc)
    return { success: false, error: "Minimum CTC can't be greater than the maximum CTC." };

  const data = {
    code,
    name,
    level: Math.trunc(level),
    minCtc,
    maxCtc,
    isActive: input.isActive ?? true,
    order: input.order ?? 0,
  };

  try {
    if (input.id) {
      await prisma.hrGrade.update({ where: { id: input.id }, data });
      revalidatePath("/people/settings/grades");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.hrGrade.create({ data });
    revalidatePath("/people/settings/grades");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { success: false, error: `A grade with the code "${code}" already exists.` };
    return { success: false, error: "Could not save the grade." };
  }
}

export async function toggleGrade(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.hrGrade.findUnique({ where: { id }, select: { isActive: true } });
  if (!existing) return { success: false, error: "Grade not found." };
  try {
    await prisma.hrGrade.update({ where: { id }, data: { isActive: !existing.isActive } });
    revalidatePath("/people/settings/grades");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not update the grade." };
  }
}

export async function deleteGrade(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  try {
    await prisma.hrGrade.delete({ where: { id } });
    revalidatePath("/people/settings/grades");
    return { success: true, data: { id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003")
      return {
        success: false,
        error: "Can't delete — this grade is assigned to one or more employees. Set it inactive instead.",
      };
    return { success: false, error: "Could not delete the grade." };
  }
}
