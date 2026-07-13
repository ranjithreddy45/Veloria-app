"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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

const POLICY_PATH = "/people/attendance/policy";

// Serialisable shape (Decimal → number) for client components.
export interface AttendancePolicyDto {
  id: string;
  name: string;
  graceMinutes: number;
  halfDayAfterMinutes: number;
  fullDayMinutes: number;
  lateMarksToLop: number;
  weeklyOffs: number[];
  otEnabled: boolean;
  otMultiplier: number;
  maxRegularizationsPerMonth: number;
  isDefault: boolean;
  active: boolean;
}

export interface AttendancePolicyInput {
  id?: string;
  name: string;
  graceMinutes?: number;
  halfDayAfterMinutes?: number;
  fullDayMinutes?: number;
  lateMarksToLop?: number;
  weeklyOffs?: number[];
  otEnabled?: boolean;
  otMultiplier?: number;
  maxRegularizationsPerMonth?: number;
  isDefault?: boolean;
}

// ============================================================
// Attendance policy master — admin CRUD only (no calc wiring).
// ============================================================

export async function listPolicies(): Promise<AttendancePolicyDto[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];
  const rows = await prisma.hrAttendancePolicy.findMany({
    orderBy: [{ isDefault: "desc" }, { active: "desc" }, { name: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    graceMinutes: p.graceMinutes,
    halfDayAfterMinutes: p.halfDayAfterMinutes,
    fullDayMinutes: p.fullDayMinutes,
    lateMarksToLop: p.lateMarksToLop,
    weeklyOffs: p.weeklyOffs,
    otEnabled: p.otEnabled,
    otMultiplier: Number(p.otMultiplier),
    maxRegularizationsPerMonth: p.maxRegularizationsPerMonth,
    isDefault: p.isDefault,
    active: p.active,
  }));
}

function sanitizeInt(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || Number.isNaN(v)) return fallback;
  return Math.max(0, Math.round(v));
}

export async function upsertPolicy(input: AttendancePolicyInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };

  // Numeric fields must be ≥ 0.
  const numerics = [
    input.graceMinutes,
    input.halfDayAfterMinutes,
    input.fullDayMinutes,
    input.lateMarksToLop,
    input.maxRegularizationsPerMonth,
    input.otMultiplier,
  ];
  if (numerics.some((n) => n !== undefined && (Number.isNaN(n as number) || (n as number) < 0)))
    return { success: false, error: "Numeric values can’t be negative." };

  // Weekly-off values must be within 0–6 (Sun–Sat).
  const weeklyOffs = Array.from(new Set(input.weeklyOffs ?? [])).filter((d) => Number.isInteger(d));
  if (weeklyOffs.some((d) => d < 0 || d > 6))
    return { success: false, error: "Weekly-off days must be between Sunday and Saturday." };

  const otMultiplier = input.otMultiplier === undefined ? 1 : Math.max(0, input.otMultiplier);

  const data = {
    name,
    graceMinutes: sanitizeInt(input.graceMinutes, 10),
    halfDayAfterMinutes: sanitizeInt(input.halfDayAfterMinutes, 240),
    fullDayMinutes: sanitizeInt(input.fullDayMinutes, 480),
    lateMarksToLop: sanitizeInt(input.lateMarksToLop, 3),
    weeklyOffs,
    otEnabled: !!input.otEnabled,
    otMultiplier,
    maxRegularizationsPerMonth: sanitizeInt(input.maxRegularizationsPerMonth, 3),
  };

  try {
    let savedId: string;
    if (input.id) {
      const updated = await prisma.hrAttendancePolicy.update({
        where: { id: input.id },
        data,
        select: { id: true },
      });
      savedId = updated.id;
    } else {
      const created = await prisma.hrAttendancePolicy.create({
        data: { ...data, createdById: u!.id },
        select: { id: true },
      });
      savedId = created.id;
    }

    // If this policy was asked to become the default, flip it in a transaction
    // so exactly one row stays default.
    if (input.isDefault) {
      await prisma.$transaction([
        prisma.hrAttendancePolicy.updateMany({
          where: { isDefault: true, id: { not: savedId } },
          data: { isDefault: false },
        }),
        prisma.hrAttendancePolicy.update({ where: { id: savedId }, data: { isDefault: true } }),
      ]);
    }

    revalidatePath(POLICY_PATH);
    return { success: true, data: { id: savedId } };
  } catch {
    return { success: false, error: "Could not save the policy." };
  }
}

export async function setDefaultPolicy(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  try {
    await prisma.$transaction([
      prisma.hrAttendancePolicy.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      prisma.hrAttendancePolicy.update({ where: { id }, data: { isDefault: true, active: true } }),
    ]);
    revalidatePath(POLICY_PATH);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not set the default policy." };
  }
}

export async function togglePolicy(id: string): Promise<Result<{ id: string; active: boolean }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.hrAttendancePolicy.findUnique({
    where: { id },
    select: { active: true, isDefault: true },
  });
  if (!existing) return { success: false, error: "Policy not found." };
  if (existing.active && existing.isDefault)
    return { success: false, error: "Can’t deactivate the default policy. Make another policy the default first." };
  try {
    const updated = await prisma.hrAttendancePolicy.update({
      where: { id },
      data: { active: !existing.active },
      select: { id: true, active: true },
    });
    revalidatePath(POLICY_PATH);
    return { success: true, data: { id: updated.id, active: updated.active } };
  } catch {
    return { success: false, error: "Could not update the policy." };
  }
}

export async function deletePolicy(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.hrAttendancePolicy.findUnique({
    where: { id },
    select: { isDefault: true },
  });
  if (!existing) return { success: false, error: "Policy not found." };
  if (existing.isDefault)
    return { success: false, error: "Can’t delete the default policy. Make another policy the default first." };
  try {
    await prisma.hrAttendancePolicy.delete({ where: { id } });
    revalidatePath(POLICY_PATH);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the policy." };
  }
}
