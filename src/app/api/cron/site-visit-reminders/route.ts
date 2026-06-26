import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processDueSiteVisitReminders } from "@/lib/site-visit/reminders";

// ============================================================
// Cron — site-visit reminders + no-show sweep.
// Registered in a cron JOBS lane (see sharedEdits). Returns 500 on error so
// runCronLane records the failure and alerts admins. Mirrors guest-reminders.
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

    const result = await processDueSiteVisitReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[SITE_VISIT_REMINDERS_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
