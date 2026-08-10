import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reconcileLeadEngagement } from "@/lib/crm/engagement";

// ============================================================
// Cron · Lead engagement roll-up
// ------------------------------------------------------------
// Recomputes Lead.touchCount / lastTouchedAt / lastTouchKind from the tables
// that actually hold the touches (CrmNote, Communication, CallLog).
//
// This is the authority, not the per-action bump in touchLead(). Deriving it
// here means two things the incremental approach could not give us:
//
//   - ALL EXISTING HISTORY counts from the first run. There is no way to run a
//     one-off backfill script against the production database from a dev
//     machine, so the backfill has to arrive as an idempotent job — the same
//     pattern used for enquiry-source. Nothing to remember to trigger.
//   - A write site nobody wired up self-heals. There are ~10 places that create
//     a Communication or a CallLog; expecting all of them (and every future one)
//     to remember to increment a counter is how denormalised data rots. Here it
//     is recomputed from scratch, so a miss costs at most one day of lag.
//
// Idempotent and safe to re-run: it only writes rows whose numbers changed.
// ============================================================

export const maxDuration = 60;

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

  try {
    // Open leads only. A WON or LOST lead's engagement history is already
    // written and nothing new will be added to it, so re-deriving it nightly
    // forever is work with no reader.
    const { scanned, updated } = await reconcileLeadEngagement();
    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      scanned,
      updated,
    });
  } catch (e) {
    console.error("[LEAD_ENGAGEMENT_RECONCILE_ERROR]", e);
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 });
  }
}
