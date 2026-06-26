import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { refreshCorporateAccountRollups } from "@/lib/corporate/account-rollup";
import { enqueueCorporateReengage } from "@/lib/corporate/reengage";

export const maxDuration = 300;

// ============================================================
// Corporate account-farming cron (daily lane)
// ============================================================
// (1) Recompute per-account rollups (past/upcoming counts, lifetime revenue,
//     last event date), re-derive the farming tier, and set the quarterly
//     re-engage anchor (nextReengageAt) from Booking history.
// (2) Enqueue due accounts into the re-engage Cadence (idempotent, one-shot
//     per quarter via WinbackTarget(CORPORATE_FARMING) + nextReengageAt advance).
//
// Runs after customer-360 in the daily JOBS array so contact lifetime rollups
// are fresh before the account-level rollup reads bookings. Both library fns
// are best-effort (never throw) so runCronLane records partial success rather
// than a lane failure. Mirrors the customer-360 / score-decay route shape.

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

  try {
    const rollup = await refreshCorporateAccountRollups();
    const reengage = await enqueueCorporateReengage();

    return NextResponse.json({
      success: true,
      refreshed: rollup.updated,
      reengaged: reengage.enrolled,
      reengageScanned: reengage.scanned,
      reengageSkipped: reengage.skipped,
      noCadence: reengage.noCadence,
    });
  } catch (error) {
    console.error("[ACCOUNT_FARMING_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
