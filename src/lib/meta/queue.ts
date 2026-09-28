// ============================================================
// The queue between "Meta told us" and "we fetched it".
// ------------------------------------------------------------
// Meta gives the webhook a couple of seconds and treats anything slower as a
// failure. It retries for a while and then drops the lead for good. So the
// endpoint does nothing but record the id, and the Graph fetch happens here,
// where a dead token or a slow Graph call costs a retry instead of a lead.
//
// The lease columns are the same shape CallVibePushJob uses: a worker that dies
// mid-attempt leaves a lease that expires, and the next run picks the job up
// rather than it sitting RUNNING forever.
// ============================================================

import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import { MetaGraphError } from "./graph";
import { processMetaLeadById, type ProcessOutcome } from "./process-lead";

const LEASE_MS = 2 * 60 * 1000;

/** Widening gaps: a token nobody has fixed should not be retried every minute. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360, 720, 1440];

export interface EnqueueInput {
  leadgenId: string;
  formId?: string | null;
  pageId?: string | null;
  adId?: string | null;
  adgroupId?: string | null;
  createdTime?: Date | null;
  source?: "webhook" | "backfill" | "admin";
}

/** Record a lead to fetch. Safe to call repeatedly for the same id. */
export async function enqueueMetaLead(input: EnqueueInput): Promise<void> {
  const leadgenId = String(input.leadgenId ?? "").trim();
  if (!leadgenId) return;

  await prisma.metaLeadJob.upsert({
    where: { leadgenId },
    // An id we already know about is left alone: re-queuing a SUCCESS would
    // re-fetch a lead we have, and re-queuing a RETRY would reset its backoff.
    update: {},
    create: {
      leadgenId,
      formId: input.formId ?? null,
      pageId: input.pageId ?? null,
      adId: input.adId ?? null,
      adgroupId: input.adgroupId ?? null,
      createdTime: input.createdTime ?? null,
      source: input.source ?? "webhook",
    },
  });
}

export interface DrainSummary {
  claimed: number;
  captured: number;
  duplicates: number;
  skipped: number;
  failed: number;
  retrying: number;
  tokenProblem: boolean;
}

/**
 * Fetch and process whatever is due.
 *
 * Runs from the webhook itself (so a lead lands in seconds) and from the cron
 * lane (so nothing is stranded when a fetch fails). Never throws: a queue
 * drain that takes the caller down with it would turn one bad lead into an
 * outage.
 */
export async function drainMetaLeadJobs(limit = 25): Promise<DrainSummary> {
  const summary: DrainSummary = {
    claimed: 0,
    captured: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    retrying: 0,
    tokenProblem: false,
  };
  const now = new Date();
  const leaseId = randomUUID();

  const due: { id: string; leadgenId: string; attempts: number }[] = [];
  try {
    const candidates = await prisma.metaLeadJob.findMany({
      where: {
        status: { in: ["PENDING", "RETRY", "RUNNING"] },
        nextRunAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: { nextRunAt: "asc" },
      take: limit,
      select: { id: true, leadgenId: true, attempts: true },
    });

    for (const job of candidates) {
      // Claim it only if nobody else has since the read — the WHERE makes the
      // check and the write one statement.
      const { count } = await prisma.metaLeadJob.updateMany({
        where: {
          id: job.id,
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        data: {
          status: "RUNNING",
          leaseId,
          lockedUntil: new Date(now.getTime() + LEASE_MS),
          attempts: { increment: 1 },
        },
      });
      if (count === 1) due.push(job);
    }
  } catch (e) {
    console.error("[MetaLeads] could not claim jobs", e);
    return summary;
  }

  summary.claimed = due.length;

  for (const job of due) {
    try {
      const outcome: ProcessOutcome = await processMetaLeadById(job.leadgenId);
      if (outcome.status === "captured") summary.captured++;
      else if (outcome.status === "duplicate") summary.duplicates++;
      else summary.skipped++;

      await prisma.metaLeadJob.update({
        where: { id: job.id },
        data: {
          status: outcome.status === "skipped" ? "SKIPPED" : "SUCCESS",
          completedAt: new Date(),
          lockedUntil: null,
          leaseId: null,
          lastError: outcome.status === "skipped" ? outcome.reason : null,
        },
      });
    } catch (e) {
      const isToken = e instanceof MetaGraphError && e.isTokenProblem;
      if (isToken) summary.tokenProblem = true;

      const attempts = job.attempts + 1;
      const exhausted = attempts >= BACKOFF_MINUTES.length;
      const waitMinutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];

      if (exhausted) summary.failed++;
      else summary.retrying++;

      await prisma.metaLeadJob
        .update({
          where: { id: job.id },
          data: {
            status: exhausted ? "FAILED" : "RETRY",
            nextRunAt: new Date(Date.now() + waitMinutes * 60 * 1000),
            lockedUntil: null,
            leaseId: null,
            lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500),
          },
        })
        .catch(() => undefined);
    }
  }

  return summary;
}

/** What the admin screen shows about the queue. */
export async function metaQueueStats() {
  const [pending, retrying, failed, oldest] = await Promise.all([
    prisma.metaLeadJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.metaLeadJob.count({ where: { status: "RETRY" } }),
    prisma.metaLeadJob.count({ where: { status: "FAILED" } }),
    prisma.metaLeadJob.findFirst({
      where: { status: { in: ["PENDING", "RETRY", "RUNNING"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, lastError: true },
    }),
  ]);
  return { pending, retrying, failed, oldestWaiting: oldest?.createdAt ?? null, lastError: oldest?.lastError ?? null };
}
