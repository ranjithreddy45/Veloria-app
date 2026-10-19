import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { runMetaBackfill } from "@/lib/meta/backfill";
import { drainMetaLeadJobs, metaQueueStats } from "@/lib/meta/queue";
import { maybeRunMetaBackfill } from "@/lib/meta/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ============================================================
// GET /api/cron/meta-leads — drain the Meta lead queue, and poll for misses.
//
// Also the on-demand import: ?since=YYYY-MM-DD (or a full ISO time) runs the poll immediately over
// that window, which is how the leads already sitting in Meta's Leads Centre
// get pulled in after a broken token is replaced.
//
// Bearer CRON_SECRET, fail-closed: an unset secret rejects rather than opens.
// ============================================================

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

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const hoursParam = Number(url.searchParams.get("hours") ?? "");
  const ranAt = new Date().toISOString();
  const since = sinceParam
    ? new Date(sinceParam.includes("T") ? sinceParam : `${sinceParam}T00:00:00.000Z`)
    : null;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "since must be YYYY-MM-DD or an ISO date-time" }, { status: 400 });
  }

  try {
    const drained = await drainMetaLeadJobs(50);

    // An explicit ?since= is always honoured — that is the whole point of the
    // on-demand import — and bypasses the 15-minute pacing.
    const backfill = since
      ? // A date (YYYY-MM-DD, UTC midnight) or a full ISO time — e.g.
        // 2026-09-30T18:30:00Z for "from 1 October, India time".
        await runMetaBackfill({ since })
      : await maybeRunMetaBackfill({
          force: url.searchParams.get("force") === "1",
          hours: Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : undefined,
        });

    const queue = await metaQueueStats();
    const failed = "ok" in backfill && !backfill.ok;
    return NextResponse.json(
      { success: !failed, ranAt, drained, backfill, queue },
      { status: failed ? 500 : 200 }
    );
  } catch (e) {
    console.error("[CRON_META_LEADS_ERROR]", e);
    return NextResponse.json({ success: false, ranAt }, { status: 500 });
  }
}
