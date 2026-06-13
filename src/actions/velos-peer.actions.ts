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

function startOfIsoWeekUtc(): Date {
  const n = new Date();
  const day = n.getUTCDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// Give kudos — anti-collusion: capped per giver per ISO week. Writes a
// +kudos_received ledger row to the receiver (B6).
export async function giveKudos(toUserId: string, note: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (toUserId === u.id) return { success: false, error: "You can’t give kudos to yourself." };
  if (!note?.trim()) return { success: false, error: "Add a short note — what did they do?" };

  const target = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!target) return { success: false, error: "Teammate not found." };

  const givenThisWeek = await prisma.kudos.count({ where: { fromUserId: u.id, createdAt: { gte: startOfIsoWeekUtc() } } });
  if (givenThisWeek >= VELOS_TUNING.KUDOS_MAX_PER_GIVER_PER_WEEK)
    return { success: false, error: `You’ve used all ${VELOS_TUNING.KUDOS_MAX_PER_GIVER_PER_WEEK} kudos for this week.` };

  const kudos = await prisma.kudos.create({ data: { fromUserId: u.id, toUserId, note: note.trim().slice(0, 200) } });
  await awardVelos(prisma, { userId: toUserId, eventType: "kudos_received", entityType: "kudos", entityId: kudos.id, note: note.trim().slice(0, 80) });

  revalidatePath("/performance/velos");
  return { success: true, data: { id: kudos.id } };
}

export async function getKudosFeed() {
  const u = await requireUser();
  if (!u?.id) return { feed: [], remaining: 0 };
  const [feed, givenThisWeek] = await Promise.all([
    prisma.kudos.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        fromUser: { select: { name: true, image: true } },
        toUser: { select: { name: true, image: true } },
      },
    }),
    prisma.kudos.count({ where: { fromUserId: u.id, createdAt: { gte: startOfIsoWeekUtc() } } }),
  ]);
  return {
    feed: feed.map((k) => ({ id: k.id, note: k.note, createdAt: k.createdAt, from: k.fromUser.name ?? "—", fromImg: k.fromUser.image, to: k.toUser.name ?? "—", toImg: k.toUser.image })),
    remaining: Math.max(0, VELOS_TUNING.KUDOS_MAX_PER_GIVER_PER_WEEK - givenThisWeek),
  };
}

// Teammates for the kudos picker (internal staff, excluding self).
export async function getTeammates() {
  const u = await requireUser();
  if (!u?.id) return [];
  return prisma.user.findMany({
    where: {
      id: { not: u.id },
      isActive: true,
      role: { notIn: ["CLIENT", "VENDOR"] },
    },
    select: { id: true, name: true, image: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}
