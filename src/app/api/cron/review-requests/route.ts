import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enqueueReviewRequestsForCompletedBookings } from "@/lib/reputation/review-request";

// ============================================================
// Cron · Reputation flywheel — review-request sweep
// ------------------------------------------------------------
// Idempotently enqueues one ReviewRequest per COMPLETED booking and sends the
// WhatsApp review-request (token link to the PUBLIC /r/<token> landing page).
// Safe to run repeatedly: @@unique([bookingId]) + guarded status transitions.
// Registered in the daily orchestrator's JOBS array.
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

  const now = new Date();
  const counts = await enqueueReviewRequestsForCompletedBookings();

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    ...counts,
  });
}
