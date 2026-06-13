"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { VELOS_DEFAULTS, currentPeriod } from "@/lib/velos/config";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Seed / refresh the config table from defaults (idempotent — only inserts missing).
export async function seedVelosConfig(): Promise<Result<{ created: number }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  let created = 0;
  for (const d of VELOS_DEFAULTS) {
    const exists = await prisma.velosConfig.findUnique({ where: { eventType: d.eventType } });
    if (!exists) {
      await prisma.velosConfig.create({
        data: { eventType: d.eventType, points: d.points, label: d.label, category: d.category, clawbackEligible: !!d.clawbackEligible, isEffort: !!d.isEffort },
      });
      created++;
    }
  }
  revalidatePath("/performance");
  return { success: true, data: { created } };
}

export async function getVelosConfig() {
  const u = await requireUser();
  if (!u?.id) return [];
  return prisma.velosConfig.findMany({ orderBy: [{ category: "asc" }, { points: "desc" }] });
}

// Retune a point value without a redeploy (config-driven — B4).
export async function updateVelosPoints(eventType: string, points: number): Promise<Result<{ eventType: string }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  if (!Number.isInteger(points)) return { success: false, error: "Points must be a whole number." };
  await prisma.velosConfig.update({ where: { eventType }, data: { points } });
  revalidatePath("/performance");
  return { success: true, data: { eventType } };
}

// My Velos totals — lifetime (drives tier) + current period (drives leaderboard).
export async function getMyVelosTotal() {
  const u = await requireUser();
  if (!u?.id) return { lifetime: 0, period: 0, periodKey: currentPeriod() };
  const period = currentPeriod();
  const [lifeAgg, periodAgg] = await Promise.all([
    prisma.velosLedger.aggregate({ where: { userId: u.id }, _sum: { points: true } }),
    prisma.velosLedger.aggregate({ where: { userId: u.id, period }, _sum: { points: true } }),
  ]);
  return { lifetime: lifeAgg._sum.points ?? 0, period: periodAgg._sum.points ?? 0, periodKey: period };
}
