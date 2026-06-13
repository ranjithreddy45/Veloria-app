"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { awardVelos } from "@/lib/velos/award";
import { VELOS_TUNING } from "@/lib/velos/config";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Lifetime points → is this user Silver+ (can self-select quests)? Mirrors tiers.
async function isSilverPlus(userId: string): Promise<boolean> {
  const agg = await prisma.velosLedger.aggregate({ where: { userId }, _sum: { points: true } });
  return (agg._sum.points ?? 0) >= 500;
}

// Count of matching events in a quest's window — drives team progress.
async function teamProgress(metric: string, startsAt: Date, endsAt: Date | null): Promise<number> {
  return prisma.velosLedger.count({
    where: { eventType: metric, awardedAt: { gte: startsAt, ...(endsAt ? { lte: endsAt } : {}) } },
  });
}

export async function getQuests() {
  const u = await requireUser();
  if (!u?.id) return { quests: [], canManage: false, silverPlus: false };
  const silverPlus = await isSilverPlus(u.id);

  const quests = await prisma.quest.findMany({
    where: { status: "ACTIVE" },
    include: { progress: { where: { userId: u.id }, select: { currentCount: true, completedAt: true } } },
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
  });

  const rows = await Promise.all(quests.map(async (q) => {
    const mine = q.progress[0];
    const current = q.scope === "TEAM"
      ? await teamProgress(q.metric, q.startsAt, q.endsAt)
      : mine?.currentCount ?? 0;
    return {
      id: q.id, title: q.title, scope: q.scope, metric: q.metric, target: q.targetCount,
      current: Math.min(current, q.targetCount), rawCurrent: current,
      pct: q.targetCount ? Math.min(100, Math.round((current / q.targetCount) * 100)) : 0,
      rewardPoints: q.rewardPoints, rewardNote: q.rewardNote,
      selfSelectable: q.selfSelectable, isRecovery: q.isRecovery,
      joined: !!mine, completed: !!mine?.completedAt || (q.scope === "TEAM" && current >= q.targetCount),
      endsAt: q.endsAt,
    };
  }));
  return { quests: rows, canManage: isAdmin(u.role), silverPlus };
}

export async function createQuest(input: { title: string; scope: string; metric: string; targetCount: number; rewardPoints?: number; rewardNote?: string; selfSelectable?: boolean; endsAt?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.title?.trim() || !input.metric || !input.targetCount) return { success: false, error: "Title, metric and target are required." };
  const q = await prisma.quest.create({
    data: {
      title: input.title.trim(),
      scope: input.scope === "TEAM" ? "TEAM" : "INDIVIDUAL",
      metric: input.metric,
      targetCount: Math.max(1, input.targetCount),
      rewardPoints: input.rewardPoints ?? 0,
      rewardNote: input.rewardNote?.trim() || null,
      selfSelectable: !!input.selfSelectable,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    },
  });
  revalidatePath("/performance/velos");
  return { success: true, data: { id: q.id } };
}

// Self-select into a quest (autonomy driver) — Silver+ only, per spec.
export async function joinQuest(questId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const q = await prisma.quest.findUnique({ where: { id: questId } });
  if (!q || q.status !== "ACTIVE") return { success: false, error: "Quest not available." };
  if (!q.selfSelectable) return { success: false, error: "This quest isn't opt-in." };
  if (!(await isSilverPlus(u.id)) && !isAdmin(u.role)) return { success: false, error: "Reach Silver to choose your own quests." };
  await prisma.questProgress.upsert({
    where: { questId_userId: { questId, userId: u.id } },
    create: { questId, userId: u.id, currentCount: 0 },
    update: {},
  });
  revalidatePath("/performance/velos");
  return { success: true, data: { id: questId } };
}

export async function seedStarterQuests(): Promise<Result<{ created: number }>> {
  const u = await requireUser();
  if (!isAdmin(u?.role)) return { success: false, error: "Not authorized." };
  const starters = [
    { title: "Clear all overdue leads this week", scope: "TEAM" as const, metric: "end_of_day_zero_overdue", targetCount: 5, rewardPoints: 50, rewardNote: "Team lunch", selfSelectable: false },
    { title: "5 site visits → tentative holds", scope: "INDIVIDUAL" as const, metric: "tentative_hold", targetCount: 5, rewardPoints: 40, rewardNote: "Half-day off", selfSelectable: true },
    { title: "Zero overdue payments by month-end", scope: "TEAM" as const, metric: "payment_collected_on_or_before_due", targetCount: 10, rewardPoints: 60, rewardNote: "Team reward", selfSelectable: false },
  ];
  let created = 0;
  for (const s of starters) {
    const exists = await prisma.quest.findFirst({ where: { title: s.title, status: "ACTIVE" } });
    if (!exists) { await prisma.quest.create({ data: s }); created++; }
  }
  revalidatePath("/performance/velos");
  return { success: true, data: { created } };
}

// ============================================================
// Slump-catch (B7) — nightly rule. Per user: if recent points are far below
// their own 8-week baseline, OR they've had no win in N days, surface a small
// effort-based recovery quest so a dry stretch still produces wins.
// ============================================================
export async function runSlumpCatch(): Promise<{ created: number; checked: number }> {
  const now = Date.now();
  const eightWeeksAgo = new Date(now - 56 * 86400000);
  const sevenDaysAgo = new Date(now - 7 * 86400000);

  // Active staff who have any ledger history.
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { notIn: ["CLIENT", "VENDOR"] }, velosLedger: { some: {} } },
    select: { id: true },
  });

  let created = 0;
  for (const usr of users) {
    // Skip if a recovery quest is already active for them.
    const hasRecovery = await prisma.quest.findFirst({ where: { status: "ACTIVE", isRecovery: true, ownerUserId: usr.id } });
    if (hasRecovery) continue;

    const rows = await prisma.velosLedger.findMany({
      where: { userId: usr.id, awardedAt: { gte: eightWeeksAgo } },
      select: { points: true, awardedAt: true, eventType: true },
    });
    if (rows.length === 0) continue;

    // Weekly sums → median baseline.
    const weekly = new Map<number, number>();
    for (const r of rows) {
      const wk = Math.floor((now - r.awardedAt.getTime()) / (7 * 86400000));
      weekly.set(wk, (weekly.get(wk) ?? 0) + r.points);
    }
    const sums = [...weekly.values()].sort((a, b) => a - b);
    const baseline = sums.length ? sums[Math.floor(sums.length / 2)] : 0;
    const last7 = rows.filter((r) => r.awardedAt >= sevenDaysAgo).reduce((s, r) => s + r.points, 0);

    const lastClose = rows.filter((r) => r.eventType === "contract_signed").sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime())[0];
    const daysSinceClose = lastClose ? (now - lastClose.awardedAt.getTime()) / 86400000 : 999;

    const slumping = (baseline > 0 && last7 < baseline * VELOS_TUNING.SLUMP_THRESHOLD) || daysSinceClose >= VELOS_TUNING.SLUMP_DAYS;
    if (!slumping) continue;

    await prisma.quest.create({
      data: {
        title: "Recovery: log 5 site visits this week",
        scope: "INDIVIDUAL", metric: "site_visit_done", targetCount: 5,
        rewardPoints: 30, rewardNote: "Back on track", selfSelectable: false,
        isRecovery: true, ownerUserId: usr.id,
        endsAt: new Date(now + 7 * 86400000),
      },
    });
    created++;
  }
  return { created, checked: users.length };
}

// Grant team-quest rewards once when the target is met (idempotent via ledger key).
export async function settleTeamQuests(): Promise<{ settled: number }> {
  const teamQuests = await prisma.quest.findMany({ where: { status: "ACTIVE", scope: "TEAM" } });
  let settled = 0;
  for (const q of teamQuests) {
    const progress = await teamProgress(q.metric, q.startsAt, q.endsAt);
    if (progress < q.targetCount) continue;
    if (q.rewardPoints > 0) {
      const members = await prisma.user.findMany({ where: { isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } }, select: { id: true } });
      for (const m of members) {
        await awardVelos(prisma, { userId: m.id, eventType: "quest_reward", entityType: "quest", entityId: q.id, pointsOverride: q.rewardPoints, keySuffix: m.id, note: q.title });
      }
    }
    await prisma.quest.update({ where: { id: q.id }, data: { status: "COMPLETED" } });
    settled++;
  }
  return { settled };
}
