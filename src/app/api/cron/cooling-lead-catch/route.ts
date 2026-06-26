import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { catchCoolingLeads } from "@/lib/winback/cooling-lead-catch";

export const maxDuration = 120;

// ============================================================
// Cron · Cooling-lead catch
// ------------------------------------------------------------
// Runs immediately after score-decay in the daily lane so it evaluates freshly
// decayed Lead.score values. Finds quiet, cooling mid-funnel leads and enrolls
// each into the "Cooling Lead Re-warm" cadence (one-shot via
// Lead.coolingEnrolledAt). Returns 500 on a top-level throw so runCronLane
// records the failure + alerts admins. Registered in daily JOBS after
// "score-decay".
// ============================================================

export async function GET(request: Request) {
  try {
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

    const data = await catchCoolingLeads();

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("[COOLING_LEAD_CATCH_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
