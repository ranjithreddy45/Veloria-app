import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { releaseLapsedHolds } from "@/lib/holds/release-lapsed-holds";

// ============================================================
// Cron · HOLD expiry sweeper (daily floor)
// ------------------------------------------------------------
// A booking placed on HOLD carries `holdExpiresAt`. Once that passes with no
// money against the booking the hold has LAPSED and must stop blocking its
// venue+date+slot. This daily job is the floor under the frequent lanes
// (/api/cron/fast and /api/cron/lapsed-hold-release) and releases through the
// very same function they use: releaseLapsedHolds() in
// src/lib/holds/release-lapsed-holds.ts (at most 500 holds per run; the
// frequent lanes release any remainder within minutes). Idempotent; safe to
// run repeatedly.
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

  // NEVER cancel a hold that money has arrived against, or may be arriving.
  //
  // This once swept every expired HOLD unconditionally, and that quietly
  // destroyed paid bookings. The path:
  //
  //   1. Customer pays. maybeConfirmBookingOnPayment only flips HOLD→CONFIRMED
  //      once paidAmount clears 20% of the invoice, so a smaller advance or
  //      token payment legitimately leaves the booking on HOLD.
  //   2. holdExpiresAt passes.
  //   3. This sweep cancels it.
  //   4. The bookings calendar excludes CANCELLED — so a booking the customer
  //      has PAID FOR simply disappears from the calendar.
  //
  // The first fix only looked at invoice.paidAmount, which still let the sweep
  // cancel a hold whose customer was mid-checkout at the gateway or had
  // uploaded a payment proof awaiting verification. Selection and every cancel
  // now use lapsedHoldWhere(now) (src/lib/holds/lapsed-hold.ts): a hold is
  // spared when ANY invoice on the booking has money (paid, part-paid, a
  // completed or processing payment), a proof awaits verification, or a
  // Razorpay checkout started in the last 15 minutes. The money check runs
  // inside each guarded UPDATE, so a payment landing mid-sweep wins. A released
  // booking's unpaid PublicHold is expired with it, so the customer's hold link
  // and the team's booking say the same thing.
  //
  // The trade-off is deliberate: an uncancelled hold keeps blocking its slot,
  // which a human can see and undo in seconds. A silently cancelled paid
  // booking is money taken for an event that no longer exists, and nobody
  // finds out until the customer calls.
  const sweep = await releaseLapsedHolds(now);

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    expiredHolds: sweep.released,
    // Counted and returned rather than silently skipped: an expired hold with
    // money on it that never got confirmed is a real thing someone must chase.
    skippedPaid: sweep.skippedWithMoney,
    scanned: sweep.scanned,
    disagreements: sweep.disagreements,
    publicHoldsExpired: sweep.publicHoldsExpired,
  });
}
