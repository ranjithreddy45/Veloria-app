import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processDueCadenceSteps } from "@/lib/cadence-executor";
import {
  processCadenceExits,
  escalateLeadSlaBreaches,
  escalateOverdueTasks,
} from "@/lib/lead-pipeline";
import { escalateAcqLeadSlaBreaches } from "@/lib/acq/sla-escalation";

export const maxDuration = 120;

// ============================================================
// Fast cron — the time-sensitive sweep (speed-to-lead)
// ============================================================
// Bundles everything that must run far more often than once a day:
//   • advance due cadence steps          (relentless follow-up)
//   • exit cadences whose prospect replied (don't over-message)
//   • escalate breached first-response SLAs (speed-to-lead)
//   • escalate overdue follow-up tasks
//
// Drive it every 1–5 minutes. On Vercel Pro add a per-minute cron in
// vercel.json (`*/2 * * * *`). On Hobby (capped at daily crons), point a
// free external pinger (cron-job.org / GitHub Actions) at:
//   GET /api/cron/fast   Authorization: Bearer <CRON_SECRET>
// It is also invoked once daily by /api/cron/daily as a floor.

export async function GET(request: Request) {
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

  const results: Record<string, unknown> = {};

  try {
    results.cadenceSteps = await processDueCadenceSteps();
  } catch (e) {
    results.cadenceSteps = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  try {
    results.cadenceExits = await processCadenceExits();
  } catch (e) {
    results.cadenceExits = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  try {
    results.slaEscalations = await escalateLeadSlaBreaches();
  } catch (e) {
    results.slaEscalations = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  try {
    results.overdueTaskEscalations = await escalateOverdueTasks();
  } catch (e) {
    results.overdueTaskEscalations = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  try {
    results.bdSlaEscalations = await escalateAcqLeadSlaBreaches();
  } catch (e) {
    results.bdSlaEscalations = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    results,
  });
}
