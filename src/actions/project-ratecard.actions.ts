"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { CAPEX_CATEGORIES, CAPEX_DURATION_WEEKS, CAPEX_LUXURY_MIN_PER_SQFT } from "@/lib/projects/capex-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function canRead(role?: string) {
  return !!role && hasPermission(role, "projects:read");
}
function canManage(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "projects:manage");
}

export async function getRateCard() {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];
  return prisma.projectRateCard.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
}

// Idempotent seed from the capex-calc constants — the single source of truth
// becomes the DB after this; the calculator's constants remain the fallback.
export async function seedRateCard(): Promise<Result<{ created: number }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  let created = 0;
  for (let i = 0; i < CAPEX_CATEGORIES.length; i++) {
    const c = CAPEX_CATEGORIES[i];
    const exists = await prisma.projectRateCard.findUnique({ where: { categoryKey: c.key } });
    if (!exists) {
      await prisma.projectRateCard.create({
        data: {
          categoryKey: c.key, label: c.label, basis: c.basis, rate: c.defaultRate, unitLabel: c.unitLabel,
          durationWeeks: CAPEX_DURATION_WEEKS[c.key] ?? 0,
          luxuryMinPerSqft: CAPEX_LUXURY_MIN_PER_SQFT[c.key] ?? null,
          order: i + 1,
        },
      });
      created++;
    }
  }
  revalidatePath("/projects/rate-card");
  return { success: true, data: { created } };
}

export async function updateRateCardItem(id: string, input: { rate?: number; durationWeeks?: number; luxuryMinPerSqft?: number | null; isActive?: boolean }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  await prisma.projectRateCard.update({
    where: { id },
    data: {
      rate: input.rate !== undefined ? input.rate : undefined,
      durationWeeks: input.durationWeeks !== undefined ? input.durationWeeks : undefined,
      luxuryMinPerSqft: input.luxuryMinPerSqft !== undefined ? input.luxuryMinPerSqft : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
    },
  });
  revalidatePath("/projects/rate-card");
  return { success: true, data: { id } };
}
