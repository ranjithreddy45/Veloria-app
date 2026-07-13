import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runHrReminders } from "@/lib/hr/reminders-cron";

// Fires active HrReminderRule rows (birthday / work-anniversary / doc-expiry).
// Registered in the daily orchestrator's JOBS array as "hr-reminders".
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
  const result = await runHrReminders();
  return NextResponse.json({ success: true, ...result });
}
