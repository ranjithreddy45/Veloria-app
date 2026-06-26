import { NextResponse } from "next/server";
import { isValidCronSecret } from "@/lib/cron-auth";
import { persistReallocationRun } from "@/lib/marketing/reallocation-buckets";

export const maxDuration = 60;

// ============================================================
// Channel reallocation snapshot (daily).
// ------------------------------------------------------------
// Computes a fresh prescriptive ad-spend reallocation plan over the default
// trailing window and persists it as a new ChannelReallocationRun +
// ChannelReallocationRec snapshot, so the /marketing cockpit always shows
// current advice (getLatestReallocationRun reads the newest run).
//
// Idempotent by design: each run is an independent dated insert (no upsert
// contention), and re-running simply produces a newer snapshot.
//
// Ordering note: MUST run AFTER 'attribution-rollup' (bookedRevenue / CAC /
// ROAS) and 'customer-360' (LTV) in the daily JOBS array so the plan is built
// on fresh revenue, not stale figures.
// ============================================================

export async function GET(request: Request) {
  try {
    if (!isValidCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cron runs are system-generated (no user) and use the default trailing
    // window. segmentByEventType stays off for the always-fresh baseline run.
    const { runId } = await persistReallocationRun(undefined, null);

    return NextResponse.json({ success: true, runId });
  } catch (error) {
    console.error("[CHANNEL_REALLOCATION_CRON_ERROR]", error);
    // Mirror attribution-rollup: never throw a 500 that aborts the lane.
    return NextResponse.json({ success: false, runId: null });
  }
}
