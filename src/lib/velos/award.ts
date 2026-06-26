// ============================================================
// Velos award engine. NOT a server action — a helper imported by
// server actions and triggers. Every points change flows through
// here so it lands in the ledger (B4: never mutate a total directly).
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { velosPeriod } from "./config";

type Client = Prisma.TransactionClient | typeof prisma;

export interface AwardInput {
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  /** Override the configured points (assist credit = 25% of close, quest rewards). */
  pointsOverride?: number;
  /** Distinguish repeat awards of the same (entity,event) — e.g. daily streaks. */
  keySuffix?: string;
  note?: string;
  at?: Date;
}

export interface AwardResult {
  awarded: boolean;
  points: number;
}

/**
 * Idempotent points award. Inserts one signed ledger row; a duplicate
 * (entityId+eventType[+suffix]) is silently ignored via the unique
 * idempotencyKey — so re-firing the same event never double-awards.
 */
export async function awardVelos(client: Client, input: AwardInput): Promise<AwardResult> {
  const cfg = await client.velosConfig.findUnique({ where: { eventType: input.eventType } });
  // Unknown event types are ignored (config-driven; nothing hardcoded).
  if (!cfg && input.pointsOverride === undefined) return { awarded: false, points: 0 };

  const points = input.pointsOverride ?? cfg!.points;
  if (points === 0) return { awarded: false, points: 0 }; // zero-value events are no-ops

  const at = input.at ?? new Date();
  const idempotencyKey = `${input.entityId}:${input.eventType}${input.keySuffix ? `:${input.keySuffix}` : ""}`;

  try {
    await client.velosLedger.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        points,
        awardedAt: at,
        period: velosPeriod(at),
        idempotencyKey,
        note: input.note ?? null,
      },
    });
    // A real award also advances any matching individual quest (one event,
    // two consumers — B8). Best-effort; never fails the award.
    if (input.eventType !== "quest_reward") {
      try { await bumpIndividualQuests(client, input.userId, input.eventType); } catch { /* noop */ }
    }
    return { awarded: true, points };
  } catch (e) {
    // Unique-constraint hit → already awarded; idempotent no-op.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { awarded: false, points: 0 };
    throw e;
  }
}

// Advance the caller's progress on any ACTIVE individual quest whose metric
// matches this event; on reaching target, mark complete and pay the reward.
async function bumpIndividualQuests(client: Client, userId: string, eventType: string): Promise<void> {
  const quests = await client.quest.findMany({
    where: {
      status: "ACTIVE", scope: "INDIVIDUAL", metric: eventType,
      OR: [{ ownerUserId: null }, { ownerUserId: userId }],
    },
  });
  for (const q of quests) {
    if (q.endsAt && q.endsAt < new Date()) continue;
    const prog = await client.questProgress.upsert({
      where: { questId_userId: { questId: q.id, userId } },
      create: { questId: q.id, userId, currentCount: 1 },
      update: { currentCount: { increment: 1 } },
    });
    if (!prog.completedAt && prog.currentCount >= q.targetCount) {
      await client.questProgress.update({ where: { id: prog.id }, data: { completedAt: new Date() } });
      if (q.rewardPoints > 0) {
        await awardVelos(client, {
          userId, eventType: "quest_reward", entityType: "quest", entityId: q.id,
          pointsOverride: q.rewardPoints, keySuffix: userId, note: q.title,
        });
      }
    }
  }
}

/**
 * Clawback for a cancelled / refunded deal (B5). Reverses ONLY sale-side
 * (clawbackEligible) positive rows for the entity, as offsetting negative
 * rows booked in the CURRENT period (keeps past leaderboards honest).
 * Effort (e.g. site_visit_done) is left intact.
 */
export async function clawbackEntity(client: Client, entityId: string, note?: string): Promise<{ reversed: number; points: number }> {
  // Which event types are sale-side / clawback-eligible.
  const eligible = await client.velosConfig.findMany({ where: { clawbackEligible: true }, select: { eventType: true } });
  // assist_credit is a percentage-of-close bonus (a derivative of the close,
  // not genuine effort like site_visit_done), so it must be reversed with the
  // close it was awarded from — otherwise assisters' leaderboards don't
  // reconcile after a cancellation.
  const eligibleTypes = Array.from(new Set([...eligible.map((e) => e.eventType), "assist_credit"]));
  if (eligibleTypes.length === 0) return { reversed: 0, points: 0 };

  const rows = await client.velosLedger.findMany({
    where: { entityId, eventType: { in: eligibleTypes }, points: { gt: 0 } },
  });

  const now = new Date();
  const period = velosPeriod(now);
  let reversed = 0;
  let points = 0;
  for (const r of rows) {
    try {
      await client.velosLedger.create({
        data: {
          userId: r.userId,
          eventType: "clawback",
          entityType: "clawback",
          entityId: r.entityId,
          points: -r.points,
          awardedAt: now,
          period, // current period, NOT r.period (B5)
          idempotencyKey: `${r.idempotencyKey}:clawback`,
          note: note ?? `Reversal of ${r.eventType}`,
        },
      });
      reversed++;
      points += -r.points;
    } catch (e) {
      // Already clawed back — idempotent.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return { reversed, points };
}
