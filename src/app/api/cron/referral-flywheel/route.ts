import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { issueReferralCodeForFiveStarReviews } from "@/lib/reputation/referral-flywheel";

// ============================================================
// Cron · Review → Referral flywheel — code issuance sweep
// ------------------------------------------------------------
// Idempotently issues a personal GUEST ReferralPartner code to delighted
// customers (ROUTED_PUBLIC review requests rated >=4, and approved 5-star
// reviews) and WhatsApps them their /refer/<code> link. One-shot dedupe via
// Review.referralCodeIssued + per-contact GUEST-partner guard. Registered in
// the daily lane right after review-requests.
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

  const counts = await issueReferralCodeForFiveStarReviews();
  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    ...counts,
  });
}
