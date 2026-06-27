import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runEventReadinessWatchdog } from "@/lib/ops/readiness-watchdog";

export const maxDuration = 120;

// ============================================================
// Cron · Event readiness watchdog
// ------------------------------------------------------------
// Daily-lane sweep (Vercel-native cron — no frequent pinger needed). Escalates,
// to the Ops Head + booking owner, any near-term event still carrying gaps:
// unassigned mandatory tasks, unconfirmed vendors, un-received procurement, a
// degraded data plan, or no human sign-off. Throttled per event via
// EventOperation.lastWatchdogAlertAt. 500 on a top-level throw so runCronLane
// records the failure + alerts admins.
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

    const data = await runEventReadinessWatchdog();
    return NextResponse.json({ success: true, ranAt: new Date().toISOString(), data });
  } catch (error) {
    console.error("[READINESS_WATCHDOG_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
