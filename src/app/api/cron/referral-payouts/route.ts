import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enqueueReferralPayoutsForConvertedReferrals } from "@/lib/referral-portal/payout-accrual";

// ============================================================
// Cron · Referral portal — payout accrual sweep
// ------------------------------------------------------------
// Idempotently accrues PENDING ReferralPayouts for converted portal referrals
// and refreshes partner dashboard rollups. Safe to run repeatedly: dedupes a
// payout per submission/referral before create. Registered in the daily lane.
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

  const counts = await enqueueReferralPayoutsForConvertedReferrals();
  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    ...counts,
  });
}
