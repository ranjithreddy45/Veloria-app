import { prisma } from "@/lib/prisma";
import { reportSystemFailure } from "@/lib/ops-alert";

// ============================================================
// Cron lane orchestrator.
//
// WHY THIS WAS REWRITTEN: the daily lane had never run. Not "failed" — never
// completed once, in the entire life of the deployment. /api/health reported
// NEVER_RUN while the frequent lane ran fine every morning.
//
// The mechanism was arithmetic. The lane fired 41 sub-jobs STRICTLY IN
// SEQUENCE, each one a fresh serverless invocation with its own cold start and
// database work — call it ~7s apiece — against a 300s maxDuration. Roughly 290s
// of work inside a 300s budget. Any one slow job pushed it over, the function
// was killed, and because the CronRunLog heartbeat was written only AFTER the
// final job, nothing was recorded. reportSystemFailure never fired either: the
// code that alerts on failure sat past the point where the process died.
//
// So a third of this application's automation — payment reminders, GL
// reconciliation, invoice-due, hold expiry, winbacks — silently never happened,
// and every screen reported the situation as "no runs yet" rather than "this is
// broken".
//
// TWO CHANGES:
//
// 1. BOUNDED CONCURRENCY. Jobs run in waves instead of a queue, which turns
//    ~290s of wall-clock into ~60s. Concurrency is deliberately small: these
//    all hit the same Postgres, and trading a timeout for connection exhaustion
//    would be no progress at all.
//
// 2. THE HEARTBEAT IS WRITTEN FIRST. A RUNNING row is created before any job
//    starts and updated when the lane finishes. A killed invocation now leaves
//    a RUNNING row that never resolved — visibly wrong — instead of leaving no
//    trace and reporting NEVER_RUN. The failure that hid for months could not
//    hide again.
//
// ORDERING: a job may be declared as a nested array to force sequence, e.g.
// ["hold-expiry", "public-hold-expiry"] — public-hold-expiry documents that it
// must run after hold-expiry. Everything else is order-independent and the
// previous strict sequencing was incidental, not designed.
// ============================================================

/** One job, or an ordered chain that must run in the given sequence. */
export type CronJobSpec = string | readonly string[];

/**
 * How many jobs run at once.
 *
 * Every sub-job opens its own connection to the same database, so this is a
 * database-pressure budget, not a speed dial. Six keeps the lane comfortably
 * inside maxDuration while staying far below any sane connection ceiling.
 */
const CONCURRENCY = 6;

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface LaneResult {
  lane: string;
  status: "SUCCESS" | "PARTIAL" | "FAILURE";
  total: number;
  failed: number;
  durationMs: number;
  results: Record<string, string>;
}

/** Run one sub-job and describe the outcome. Never throws. */
async function runJob(
  base: string,
  authHeader: string,
  job: string
): Promise<[string, string]> {
  try {
    const res = await fetch(`${base}/api/cron/${job}`, {
      headers: { authorization: authHeader },
      cache: "no-store",
    });
    return [job, res.ok ? "ok" : `http_${res.status}`];
  } catch (e) {
    return [job, `error: ${e instanceof Error ? e.message : "unknown"}`];
  }
}

export async function runCronLane(
  lane: string,
  jobs: readonly CronJobSpec[],
  authHeader: string
): Promise<LaneResult> {
  const base = getBaseUrl();
  const startedAt = Date.now();
  const results: Record<string, string> = {};

  const jobNames = jobs.flatMap((j) => (Array.isArray(j) ? [...j] : [j as string]));

  // ---- Heartbeat FIRST ----------------------------------------------------
  // Written before any work so that a lane killed mid-run leaves evidence. The
  // old code wrote this last, which is precisely why a lane that never finished
  // looked like a lane that had never been scheduled.
  let runId: string | null = null;
  try {
    const row = await prisma.cronRunLog.create({
      data: { lane, status: "RUNNING", total: jobNames.length, failed: 0, durationMs: 0 },
      select: { id: true },
    });
    runId = row.id;
  } catch (e) {
    // Losing the heartbeat must not cancel the run — the jobs matter more than
    // the bookkeeping.
    console.error("[CRON_RUNLOG_START_ERROR]", e);
  }

  // ---- Run in bounded waves ----------------------------------------------
  const queue = [...jobs];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const spec = queue.shift();
      if (spec === undefined) return;
      if (Array.isArray(spec)) {
        // An ordered chain: sequential within itself, concurrent with others.
        for (const job of spec) {
          const [name, outcome] = await runJob(base, authHeader, job);
          results[name] = outcome;
        }
      } else {
        const [name, outcome] = await runJob(base, authHeader, spec as string);
        results[name] = outcome;
      }
    }
  });
  await Promise.all(workers);

  const durationMs = Date.now() - startedAt;
  const failedJobs = Object.entries(results)
    .filter(([, v]) => v !== "ok")
    .map(([k]) => k);
  const failed = failedJobs.length;
  const status: LaneResult["status"] =
    failed === 0 ? "SUCCESS" : failed === jobNames.length ? "FAILURE" : "PARTIAL";

  // ---- Resolve the heartbeat ----------------------------------------------
  try {
    if (runId) {
      await prisma.cronRunLog.update({
        where: { id: runId },
        data: { status, failed, durationMs, results },
      });
    } else {
      await prisma.cronRunLog.create({
        data: { lane, status, total: jobNames.length, failed, durationMs, results },
      });
    }
  } catch (e) {
    console.error("[CRON_RUNLOG_ERROR]", e);
  }

  if (failed > 0) {
    await reportSystemFailure({
      area: "Cron",
      title: `${failed}/${jobNames.length} ${lane} job(s) failed`,
      detail: failedJobs.map((j) => `${j}: ${results[j]}`).join("; "),
      actionUrl: "/api/health",
    });
  }

  return { lane, status, total: jobNames.length, failed, durationMs, results };
}
