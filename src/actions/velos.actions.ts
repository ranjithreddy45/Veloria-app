"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { VELOS_DEFAULTS, currentPeriod, velosPeriod, tierForLifetime } from "@/lib/velos/config";

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

// ---- Surfaces (B3) ----

function prevPeriodKey(): string {
  const n = new Date();
  return velosPeriod(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1)));
}

async function sumFor(userId: string, period: string) {
  const a = await prisma.velosLedger.aggregate({ where: { userId, period }, _sum: { points: true } });
  return a._sum.points ?? 0;
}

// Personal Pace (primary view) — you vs your own last month + projection vs that.
export async function getPersonalPace() {
  const u = await requireUser();
  if (!u?.id) return null;
  const period = currentPeriod();
  const prev = prevPeriodKey();
  const [thisP, lastP] = await Promise.all([sumFor(u.id, period), sumFor(u.id, prev)]);

  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const elapsed = Math.max(1, dayOfMonth) / daysInMonth;
  const projected = Math.round(thisP / elapsed);
  const goal = lastP > 0 ? lastP : 200; // your own last month is the goal you can beat
  const onTrack = projected >= goal;

  return { thisPeriod: thisP, lastPeriod: lastP, projected, goal, onTrack, period, pctOfGoal: goal ? Math.min(200, Math.round((thisP / goal) * 100)) : 0 };
}

// Team-vs-Target — cooperative shared bar. Target = team's own last month.
export async function getTeamTarget() {
  const u = await requireUser();
  if (!u?.id) return null;
  const period = currentPeriod();
  const prev = prevPeriodKey();
  const [cur, last] = await Promise.all([
    prisma.velosLedger.aggregate({ where: { period }, _sum: { points: true } }),
    prisma.velosLedger.aggregate({ where: { period: prev }, _sum: { points: true } }),
  ]);
  const team = cur._sum.points ?? 0;
  const target = Math.max(last._sum.points ?? 0, 100);
  return { team, target, pct: Math.min(100, Math.round((team / target) * 100)), period };
}

// Light-touch leaderboard — current period, with Most Improved delta vs last month.
export async function getLeaderboard() {
  const u = await requireUser();
  if (!u?.id) return { rows: [], period: currentPeriod() };
  const period = currentPeriod();
  const prev = prevPeriodKey();

  const [curGroups, prevGroups] = await Promise.all([
    prisma.velosLedger.groupBy({ by: ["userId"], where: { period }, _sum: { points: true } }),
    prisma.velosLedger.groupBy({ by: ["userId"], where: { period: prev }, _sum: { points: true } }),
  ]);
  const prevMap = new Map(prevGroups.map((g) => [g.userId, g._sum.points ?? 0]));
  const userIds = [...new Set([...curGroups.map((g) => g.userId)])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, image: true } });
  const nameMap = new Map(users.map((x) => [x.id, x]));

  const rows = curGroups
    .map((g) => {
      const points = g._sum.points ?? 0;
      const delta = points - (prevMap.get(g.userId) ?? 0);
      const usr = nameMap.get(g.userId);
      return { userId: g.userId, name: usr?.name ?? "—", image: usr?.image ?? null, points, delta };
    })
    .sort((a, b) => b.points - a.points);
  return { rows, period };
}

// Identity progress (A2) — lifetime → tier/stage + next unlock.
export async function getIdentityProgress() {
  const u = await requireUser();
  if (!u?.id) return null;
  const agg = await prisma.velosLedger.aggregate({ where: { userId: u.id }, _sum: { points: true } });
  const lifetime = Math.max(0, agg._sum.points ?? 0);
  const { tier, next, toNext, pctToNext } = tierForLifetime(lifetime);
  const opsRoles = ["OPERATIONS", "EVENT_COORDINATOR", "STAFF"];
  const isOps = opsRoles.includes(u.role ?? "");
  return {
    lifetime,
    tierKey: tier.key,
    identity: isOps ? tier.opsIdentity : tier.salesIdentity,
    unlock: tier.unlock,
    hue: tier.hue,
    next: next ? { key: next.key, identity: isOps ? next.opsIdentity : next.salesIdentity, unlock: next.unlock, toNext } : null,
    pctToNext,
  };
}
