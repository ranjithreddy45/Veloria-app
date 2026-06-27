import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runCronLane } from "@/lib/cron/run-lane";

export const maxDuration = 300; // allow up to 5 min for the full batch

// ============================================================
// Consolidated DAILY cron — the once-a-day batch lane.
// ============================================================
// Time-sensitive jobs (SLA escalation, cadence steps, overdue escalations,
// support/BD SLA) now live in the FREQUENT lane (/api/cron/frequent), which
// runs far more often. This daily lane carries the rest. Both lanes record a
// CronRunLog heartbeat and alert admins on any job failure (see run-lane.ts).
//
// On Vercel Hobby a more frequent schedule is throttled to daily; on Pro the
// frequent lane runs at its real cadence — either way this list is correct.

const JOBS = [
  "guest-reminders",
  "performance-scores",
  "score-decay",
  "ai-scoring",
  "sentiment-analysis",
  "anomaly-detection",
  "trash-purge",
  "event-triggers",
  "event-lifecycle", // CONFIRMED→IN_PROGRESS on the day; auto-COMPLETE clean past events; nudge unclean ones
  "reconcile-ops", // backstop: re-provision ops for CONFIRMED/IN_PROGRESS bookings whose ops weren't fully created
  "event-briefings", // morning briefing: each team member's tasks for today's events (works on native daily cron, no pinger)
  "readiness-watchdog", // escalate near-term events with gaps (orphaned tasks / unconfirmed vendors / open procurement / no sign-off) to Ops Head
  "customer-360",
  "attribution-rollup", // recompute LeadAttribution.bookedRevenue + relink campaigns (after customer-360 so LTV is fresh)
  "account-farming", // corporate-account lifetime rollups (after customer-360 + attribution-rollup so contact rollups are fresh)
  "channel-reallocation", // compute channel spend reallocation plan (after attribution-rollup + customer-360 so CAC/ROAS/LTV are fresh)
  "invoice-due",
  "gl-reconcile", // self-heal: re-post any invoice/payment missing its GL entry
  "payment-reminders", // in-app nudges for invoices due soon / overdue (poka-yoke)
  "contract-reminders",
  "project-escalation", // Projects SLA escalation
  "velos-slump", // Velos slump-catch sweep
  "hold-expiry", // cancel expired booking HOLDs so they stop blocking slots
  "public-hold-expiry", // release stale public (no-login) date holds
  "site-visit-reminders", // ~24h-ahead site-visit reminders + past no-show sweep
  "vendor-reminders", // nudge still-NOTIFIED vendor assignments for upcoming events (confirm/decline link)
  "review-requests", // enqueue + send Google-review requests for COMPLETED bookings
  "referral-flywheel", // issue 5-star reviewer referral codes (after review-requests)
  "configurator-abandonment", // mark stale public quote drafts ABANDONED
  "winback-abandoned-quote", // re-engage leads who abandoned a quote
  "winback-lost-lead", // re-engage lost leads
  "winback-event-proximity", // re-engage by event-date proximity
  "cooling-lead-catch", // catch cooling leads (AFTER score-decay so it reads freshly-decayed Lead.score)
  "yield-demand-refresh", // recompute per-venue/date occupancy + demand signals
  "sell-down-refresh", // refresh SellDownTarget (after yield-demand-refresh so VenueDemandSignal occupancy is fresh)
  "franchise-revshare", // accrue monthly franchise revenue-share payouts
  "referral-payouts", // accrue converted-referral payouts + refresh partner rollups (after franchise-revshare)
] as const;

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

  const summary = await runCronLane("daily", JOBS, expected);
  return NextResponse.json({ success: true, ranAt: new Date().toISOString(), ...summary });
}
