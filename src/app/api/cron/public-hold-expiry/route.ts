import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { HOLD_FACTS_SELECT, holdHasMoney, isHoldLapsed, moneyInvoiceWhere } from "@/lib/holds/lapsed-hold";
import { releaseLapsedHold } from "@/lib/holds/release-lapsed-holds";

// ============================================================
// Cron · Public-hold expiry sweeper (daily; runs after hold-expiry).
// ------------------------------------------------------------
// Settles every PublicHold still INITIATED/SLOT_CLAIMED past its expiresAt
// against the team's Booking, which is the source of truth, using the ONE
// lapsed-hold rule in src/lib/holds/lapsed-hold.ts:
//
//  - The booking is a lapsed hold (HOLD, holdExpiresAt passed, no money on ANY
//    of its invoices, no proof awaiting verification, no checkout started in
//    the last 15 minutes) → releaseLapsedHold(). Its UPDATE re-checks that
//    rule, and the PublicHold is expired only after the booking cancel succeeds.
//  - The booking has money, or money may be arriving → left alone (skippedPaid).
//    This job used to check the token invoice only, so it could cancel a
//    booking that had been paid on another invoice.
//  - The booking is already CANCELLED with no money → the hold row catches up
//    to EXPIRED.
//  - The booking is still inside its window (e.g. the team extended the hold)
//    or has moved on (TENTATIVE / CONFIRMED / ...) → left alone
//    (skippedActive). The hold page derives its phase from the booking.
//  - No booking → the hold row is expired unless its token invoice has money.
//
// Idempotent: every write is guarded, so re-runs and overlap with the
// lapsed-hold-release job are safe.
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

  const stale = await prisma.publicHold.findMany({
    where: {
      status: { in: ["INITIATED", "SLOT_CLAIMED"] },
      expiresAt: { not: null, lt: now },
      paidAt: null,
    },
    select: { id: true, bookingId: true, invoiceId: true },
  });

  // The linked bookings, with the facts the lapsed rule needs, in one query.
  const bookingIds = [...new Set(stale.map((h) => h.bookingId).filter((id): id is string => !!id))];
  const facts =
    bookingIds.length > 0
      ? await prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: HOLD_FACTS_SELECT })
      : [];
  const bookingsById = new Map(facts.map((b) => [b.id, b] as const));

  let expired = 0;
  let skippedPaid = 0;
  let skippedActive = 0;
  let bookingsCancelled = 0;

  for (const hold of stale) {
    let booking = hold.bookingId ? (bookingsById.get(hold.bookingId) ?? null) : null;

    if (booking && isHoldLapsed(booking, now)) {
      if (await releaseLapsedHold(booking.id, now)) {
        // Booking HOLD → CANCELLED, then its unpaid PublicHold → EXPIRED.
        bookingsCancelled++;
        expired++;
        continue;
      }
      // The guarded UPDATE refused: money arrived, or the booking changed after
      // it was read (confirmed, or released by another run). Judge it again.
      booking = await prisma.booking.findUnique({ where: { id: booking.id }, select: HOLD_FACTS_SELECT });
    }

    if (booking) {
      if (holdHasMoney(booking.invoices, now)) {
        skippedPaid++;
        continue;
      }
      if (booking.status !== "CANCELLED") {
        skippedActive++;
        continue;
      }
      // Cancelled elsewhere with no money on it: the hold row follows.
    } else if (hold.invoiceId) {
      const tokenMoney = await prisma.invoice.findFirst({
        where: { id: hold.invoiceId, ...moneyInvoiceWhere(now) },
        select: { id: true },
      });
      if (tokenMoney) {
        skippedPaid++;
        continue;
      }
    }

    // Flip the public row only if still claimable + unpaid (idempotent guard).
    const flipped = await prisma.publicHold.updateMany({
      where: {
        id: hold.id,
        status: { in: ["INITIATED", "SLOT_CLAIMED"] },
        paidAt: null,
      },
      data: { status: "EXPIRED" },
    });
    expired += flipped.count;
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    scanned: stale.length,
    expired,
    skippedPaid,
    skippedActive,
    bookingsCancelled,
  });
}
