import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runLostLeadRevivalWinback } from "@/lib/winback/winback-engine";

export const maxDuration = 300;

// ============================================================
// Cron · Win-back — lost-lead taxonomy revival
// ------------------------------------------------------------
// Scans Lead status=LOST past a per-lostReason cool-off and enrolls each into
// the "Win-back: Lost Lead" cadence (or fires a direct approved-template
// WhatsApp). Idempotent via WinbackTarget find-or-create; coolOffUntil is
// frozen on first scan. Registered in daily JOBS.
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

    const counts = await runLostLeadRevivalWinback();

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      ...counts,
    });
  } catch (error) {
    console.error("[WINBACK_LOST_LEAD_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
