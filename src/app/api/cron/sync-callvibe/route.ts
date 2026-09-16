import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncCallVibeCalls } from "@/lib/telephony/callvibe-sync";

export const maxDuration = 120;

// ============================================================
// Cron · CallVibe call import (replaces sync-runo).
// ------------------------------------------------------------
// CallVibe cannot push to us, so the calls are pulled. Registered in the
// FREQUENT lane: call records are only useful while the conversation is still
// fresh, and an hourly window keeps each run small.
//
// Auth is the same Bearer CRON_SECRET + timingSafeEqual gate the other lanes
// use, and it is FAIL-CLOSED — an unset CRON_SECRET rejects rather than opens.
// sync-runo had that backwards (`if (CRON_SECRET && …)`), which left it public
// whenever the variable was missing.
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
  const ranAt = new Date().toISOString();
  try {
    const hours = url.searchParams.get("hours");
    const summary = await syncCallVibeCalls({
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
      sinceHours: hours ? Number(hours) : undefined,
      dryRun: url.searchParams.get("dryRun") === "1",
    });
    // A non-200 is how runCronLane learns to alert the admins.
    return NextResponse.json(
      { success: summary.ok, ranAt, ...summary },
      { status: summary.ok ? 200 : 500 }
    );
  } catch (e) {
    console.error("[CRON_SYNC_CALLVIBE_ERROR]", e);
    return NextResponse.json({ success: false, ranAt }, { status: 500 });
  }
}
