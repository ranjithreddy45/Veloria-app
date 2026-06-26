import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runEventProximityWinback } from "@/lib/winback/winback-engine";

export const maxDuration = 300;

// ============================================================
// Cron · Win-back — event-date-proximity
// ------------------------------------------------------------
// Scans open enquiries (status NOT IN WON/LOST) whose eventDate now falls in
// the near-term window and enrolls each into the "Win-back: Event Proximity"
// cadence (or fires a direct approved-template WhatsApp). Excludes leads with a
// live booking. Idempotent via WinbackTarget find-or-create. Registered in
// daily JOBS.
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

    const counts = await runEventProximityWinback();

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      ...counts,
    });
  } catch (error) {
    console.error("[WINBACK_EVENT_PROXIMITY_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
