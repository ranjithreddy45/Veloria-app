import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runCronLane } from "@/lib/cron/run-lane";

export const maxDuration = 120;

// ============================================================
// FREQUENT cron lane — the time-sensitive jobs that must NOT wait for the
// daily 2 AM batch. Scheduled hourly in vercel.json (runs at its real cadence
// on Vercel Pro; throttled to daily on Hobby — still correct, just slower).
// Records a CronRunLog heartbeat and alerts admins on any failure.
// ============================================================

const JOBS = [
  "fast", // first-response SLA escalation + cadence steps/exits + overdue tasks
  "escalation-check", // overdue escalation sweep
  "support-sla", // support tickets past their priority SLA
  "acq-sla", // BD/acquisition first-contact SLA + re-engagement
  "rep-availability", // refresh openLeadCount + auto-offline idle reps (smart-routing)
  "quote-nudge", // viewed-but-unpaid 24h quote nudge (one-shot via QuoteShareLink.silentNudgeFiredAt; NOT quote-silent-nudge)
] as const;

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

  const summary = await runCronLane("frequent", JOBS, expected);
  return NextResponse.json({ success: true, ranAt: new Date().toISOString(), ...summary });
}
