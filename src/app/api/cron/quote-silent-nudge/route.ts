import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runQuoteSilentNudgeSweep } from "@/lib/quote-radar/silent-nudge";

export const maxDuration = 120;

// ============================================================
// Cron · Quote "opened-but-silent 24h" recovery sweep.
// ------------------------------------------------------------
// Finds ACTIVE QuoteShareLinks that were opened but have gone quiet for 24h
// (and aren't paid/booked), enrolls the lead into the recovery cadence + pings
// the rep, deduped via QuoteShareLink.silentNudgeFiredAt. CRON_SECRET Bearer +
// timingSafeEqual gate (mirrors api/cron/configurator-abandonment). Returns 500
// on error so runCronLane counts a failure and alerts admins. Registered in the
// frequent lane JOBS array (central shared edit).
// ============================================================

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

  const ranAt = new Date().toISOString();
  try {
    const summary = await runQuoteSilentNudgeSweep();
    const status = summary.errors > 0 ? 500 : 200;
    return NextResponse.json({ success: summary.errors === 0, ranAt, ...summary }, { status });
  } catch (e) {
    console.error("[CRON_QUOTE_SILENT_NUDGE_ERROR]", e);
    return NextResponse.json({ success: false, ranAt }, { status: 500 });
  }
}
