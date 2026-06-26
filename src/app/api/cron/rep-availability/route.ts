import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { refreshRepOpenLeadCounts } from "@/lib/routing/smart-router";
import { autoOfflineIdleReps } from "@/lib/routing/rep-availability";

export const maxDuration = 120;

// ============================================================
// rep-availability cron — keeps SMART routing signals fresh
// ============================================================
// Internal, no-session. Bearer CRON_SECRET (constant-time compare, same shape
// as fast/route.ts). Recomputes each rep's openLeadCount from live open leads
// (the authoritative reconciler against optimistic per-assignment bumps) and
// auto-marks idle reps OFFLINE so closed-tab reps stop drawing leads.
// Returns 500 on any failure so runCronLane counts the lane as failed and
// alerts admins. Added to the frequent JOBS array centrally (sharedEdits).

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
    results.openLeadCountsRefreshed = await refreshRepOpenLeadCounts();
  } catch (e) {
    results.openLeadCountsRefreshed = `error: ${
      e instanceof Error ? e.message : "unknown"
    }`;
  }
  try {
    results.repsAutoOfflined = await autoOfflineIdleReps();
  } catch (e) {
    results.repsAutoOfflined = `error: ${
      e instanceof Error ? e.message : "unknown"
    }`;
  }

  const failed = Object.values(results).filter(
    (v) => typeof v === "string" && v.startsWith("error:")
  );
  return NextResponse.json(
    { success: failed.length === 0, ranAt: new Date().toISOString(), results },
    { status: failed.length > 0 ? 500 : 200 }
  );
}
