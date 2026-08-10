import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ============================================================
// Cron · HOLD expiry sweeper (audit fix)
// ------------------------------------------------------------
// A booking placed on HOLD carries `holdExpiresAt`, but nothing ever expired
// it — so a stale hold blocked its venue+date+slot forever (every conflict
// check counts any non-CANCELLED booking). This cancels HOLDs whose expiry has
// passed, freeing the slot. Idempotent; safe to run repeatedly.
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

  // NEVER cancel a hold that money has arrived against.
  //
  // This swept every expired HOLD unconditionally, and that quietly destroyed
  // paid bookings. The path:
  //
  //   1. Customer pays. maybeConfirmBookingOnPayment only flips HOLD→CONFIRMED
  //      once paidAmount clears 20% of the invoice, so a smaller advance or
  //      token payment legitimately leaves the booking on HOLD.
  //   2. holdExpiresAt passes.
  //   3. This sweep cancels it.
  //   4. The bookings calendar excludes CANCELLED — so a booking the customer
  //      has PAID FOR simply disappears from the calendar.
  //
  // There is a second route to the same place even at a full advance: payment
  // recorded, confirm not yet run, sweep lands in between. The sibling cron
  // (public-hold-expiry) already guards exactly this and calls it the
  // "paid-but-cancelled" race — but the daily orchestrator runs THIS job first,
  // so the unguarded sweep got there before the careful one.
  //
  // Any payment at all now protects the hold. The trade-off is deliberate: an
  // uncancelled hold keeps blocking its slot, which a human can see and undo in
  // seconds. A silently cancelled paid booking is money taken for an event that
  // no longer exists, and nobody finds out until the customer calls.
  const paidGuard = { invoices: { none: { paidAmount: { gt: 0 } } } };

  const [res, skippedPaid] = await Promise.all([
    prisma.booking.updateMany({
      where: { status: "HOLD", holdExpiresAt: { not: null, lt: now }, ...paidGuard },
      data: { status: "CANCELLED" },
    }),
    // Counted and returned rather than silently skipped: a paid hold that never
    // got confirmed is a real thing someone must chase, and a sweep that just
    // steps over it without saying so is how it stays invisible.
    prisma.booking.count({
      where: {
        status: "HOLD",
        holdExpiresAt: { not: null, lt: now },
        invoices: { some: { paidAmount: { gt: 0 } } },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    expiredHolds: res.count,
    skippedPaid,
  });
}
