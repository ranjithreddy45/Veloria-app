import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { nudgeViewedUnpaidQuotes } from "@/lib/sales/quote-nudge-cron";

export const maxDuration = 120;

// ============================================================
// Cron · Quote AI "viewed-but-unpaid 24h" auto-nudge.
// ------------------------------------------------------------
// Finds ACTIVE QuoteShareLinks opened ~24h ago and still unpaid, generates an AI
// (or template-fallback) WhatsApp nudge, sends it, records a WinbackTarget, and
// stamps silentNudgeFiredAt. CRON_SECRET Bearer + timingSafeEqual gate (mirrors
// the frequent/fast lane). Returns 500 when the sweep reports errors so
// runCronLane alerts admins. May also be registered as a string job in the
// frequent JOBS array; the standalone route lets an external pinger hit it too.
//
// NOTE: this shares the silentNudgeFiredAt one-shot with quote-silent-nudge —
// only ONE of the two should be wired into a cron lane (central decision).
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
    const summary = await nudgeViewedUnpaidQuotes();
    const status = summary.errors > 0 ? 500 : 200;
    return NextResponse.json({ success: summary.errors === 0, ranAt, ...summary }, { status });
  } catch (e) {
    console.error("[CRON_QUOTE_NUDGE_ERROR]", e);
    return NextResponse.json({ success: false, ranAt }, { status: 500 });
  }
}
