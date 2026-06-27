import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendEventDayBriefings } from "@/lib/ops/event-reminders";

export const maxDuration = 120;

// ============================================================
// Cron · Event-day morning briefings
// ------------------------------------------------------------
// Runs in the DAILY lane (Vercel-native cron, ~7:30am IST). For every event
// happening today it sends each assigned team member one summary of their tasks
// for the day. This is the reminder path that works with NO external pinger —
// the 5-min "task starting soon" nudges (fast lane) need a frequent trigger, but
// this guarantees every team gets their day's run of show on any plan. Returns
// 500 on a top-level throw so runCronLane records the failure + alerts admins.
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

    const data = await sendEventDayBriefings();
    return NextResponse.json({ success: true, ranAt: new Date().toISOString(), data });
  } catch (error) {
    console.error("[EVENT_BRIEFINGS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
