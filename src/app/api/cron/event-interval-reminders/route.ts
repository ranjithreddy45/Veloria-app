import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runEventIntervalReminders } from "@/lib/ops/event-interval-reminders";

// 48/24/12/4h pre-event reminders to vendor/guest/property + a T-1h readiness check.
// Registered in the FREQUENT cron lane as "event-interval-reminders".
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
  const result = await runEventIntervalReminders();
  return NextResponse.json({ success: true, ...result });
}
