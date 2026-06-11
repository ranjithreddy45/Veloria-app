import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const maxDuration = 300; // allow up to 5 min for the full batch

// ============================================================
// Consolidated daily cron (free-tier friendly)
// ============================================================
// Vercel's Hobby plan limits cron jobs to a small number running at most
// once per day. Rather than 9 separate jobs, this single daily job invokes
// each existing cron route in sequence (reusing their exact handlers).
//
// When upgrading to Pro, restore the per-job schedules in vercel.json and
// this orchestrator becomes optional.

const JOBS = [
  "fast", // SLA escalation + cadence steps/exits + overdue tasks
  "cadence-executor",
  "escalation-check",
  "guest-reminders",
  "performance-scores",
  "score-decay",
  "ai-scoring",
  "sentiment-analysis",
  "anomaly-detection",
  "trash-purge",
  "event-triggers",
  "customer-360",
  "acq-sla",
  "invoice-due",
] as const;

function getBaseUrl(): string {
  // Prefer the production domain, then the Vercel-provided URL.
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(request: Request) {
  // Auth: same CRON_SECRET check as the individual jobs
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = getBaseUrl();
  const results: Record<string, string> = {};

  for (const job of JOBS) {
    try {
      const res = await fetch(`${base}/api/cron/${job}`, {
        headers: { authorization: expected },
        // each sub-job is independent; don't cache
        cache: "no-store",
      });
      results[job] = res.ok ? "ok" : `http_${res.status}`;
    } catch (e) {
      results[job] = `error: ${e instanceof Error ? e.message : "unknown"}`;
      // continue — one failing job must not stop the rest
    }
  }

  return NextResponse.json({ success: true, ranAt: new Date().toISOString(), results });
}
