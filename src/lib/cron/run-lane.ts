import { prisma } from "@/lib/prisma";
import { reportSystemFailure } from "@/lib/ops-alert";

// ============================================================
// Cron lane orchestrator. Runs a set of cron sub-jobs sequentially, records
// the run in CronRunLog (heartbeat + history), and SURFACES any failure to
// admins via reportSystemFailure — so a failed job is caught in minutes, not
// missed for days. One job failing never stops the rest.
// ============================================================

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

export async function runCronLane(
  lane: string,
  jobs: readonly string[],
  authHeader: string
): Promise<LaneResult> {
  const base = getBaseUrl();
  const startedAt = Date.now();
  const results: Record<string, string> = {};

  for (const job of jobs) {
    try {
      const res = await fetch(`${base}/api/cron/${job}`, {
        headers: { authorization: authHeader },
        cache: "no-store",
      });
      results[job] = res.ok ? "ok" : `http_${res.status}`;
    } catch (e) {
      results[job] = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  const durationMs = Date.now() - startedAt;
  const failedJobs = Object.entries(results)
    .filter(([, v]) => v !== "ok")
    .map(([k]) => k);
  const failed = failedJobs.length;
  const status: LaneResult["status"] =
    failed === 0 ? "SUCCESS" : failed === jobs.length ? "FAILURE" : "PARTIAL";

  // Heartbeat + history (best-effort).
  try {
    await prisma.cronRunLog.create({
      data: { lane, status, total: jobs.length, failed, durationMs, results },
    });
  } catch (e) {
    console.error("[CRON_RUNLOG_ERROR]", e);
  }

  // Surface failures to admins immediately.
  if (failed > 0) {
    await reportSystemFailure({
      area: "Cron",
      title: `${failed}/${jobs.length} ${lane} job(s) failed`,
      detail: failedJobs.map((j) => `${j}: ${results[j]}`).join("; "),
      actionUrl: "/api/health",
    });
  }

  return { lane, status, total: jobs.length, failed, durationMs, results };
}
