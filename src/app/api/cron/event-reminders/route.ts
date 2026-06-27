import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendEventDayTaskReminders } from "@/lib/ops/event-reminders";

export const maxDuration = 120;

// ============================================================
// Cron · Event-day task reminders
// ------------------------------------------------------------
// Time-sensitive day-of nudge: notifies assignees whose ExecutionTask is about
// to start (slaStartBy within ~45 min), one-shot via reminderSentAt. Belongs on
// the FREQUENT/FAST lane so it actually fires near the start time. Returns 500
// on a top-level throw so runCronLane records the failure + alerts admins.
// Register in frequent JOBS as "event-reminders".
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

    const data = await sendEventDayTaskReminders();

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("[EVENT_REMINDERS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
