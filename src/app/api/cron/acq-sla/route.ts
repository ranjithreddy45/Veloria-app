import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAcqConfig } from "@/lib/acq/config";
import {
  escalateAcqLeadSlaBreaches,
  notifyAcqFollowupsDue,
  escalateAcqOnboardingBreaches,
  notifyAcqReengagements,
} from "@/lib/acq/sla-escalation";

export const maxDuration = 60;

// ============================================================
// BD / Acquisition CRM — SLA jobs (spec §6.4)
// - Lead first-contact breach
// - Follow-up due (leads)
// - Onboarding SLA breach
// - Re-engagement due
// Each alert fires ONCE per breach (claim-before-send stamps, see
// src/lib/acq/sla-escalation.ts). This route used to re-notify every breach on
// every run — ~247 "Team lead SLA breach" rows an hour to the same people.
// ============================================================

function authorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return (
    !!authHeader &&
    !!process.env.CRON_SECRET &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cfg = await getAcqConfig();
  const summary: Record<string, number> = {};

  // 1) Lead first-contact breach — the same once-only escalation the fast lane
  //    runs; whichever lane gets there first is the only one that alerts.
  const firstContact = await escalateAcqLeadSlaBreaches();
  summary.leadFirstContactBreaches = firstContact.escalated;

  // 2) Follow-up due (leads with a passed next_followup_at), once per follow-up.
  summary.followupsDue = await notifyAcqFollowupsDue(now);

  // 3) Onboarding SLA breach (open projects older than the SLA window).
  summary.onboardingBreaches = await escalateAcqOnboardingBreaches(cfg.ONBOARDING_SLA_DAYS, now);

  // 4) Re-engagement due (lost deals whose reengage_at has arrived).
  summary.reengagements = await notifyAcqReengagements(now);

  return NextResponse.json({ ok: true, summary });
}
