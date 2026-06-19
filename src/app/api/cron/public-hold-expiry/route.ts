import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ============================================================
// Cron · Public-hold expiry sweeper.
// ------------------------------------------------------------
// The existing "hold-expiry" cron already cancels expired HOLD *Bookings* by
// holdExpiresAt so they stop blocking the slot. This job additionally flips the
// PublicHold.status to EXPIRED so the public /hold/<token> page reflects it, and
// cancels the linked Booking for any public hold whose window has lapsed.
//
// IDEMPOTENT + race-safe:
//  - Only sweeps PublicHold rows in (INITIATED, SLOT_CLAIMED) with expiresAt < now.
//  - SKIPS any hold whose Invoice is PAID / fully settled (avoid cancelling a
//    paid/confirming booking — the "paid-but-cancelled" race).
//  - Booking cancel is guarded to status HOLD only (updateMany).
//  - PublicHold flip is guarded to the still-claimable statuses (updateMany).
// Run AFTER "hold-expiry" in the daily orchestrator.
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

  let expired = 0;
  let skippedPaid = 0;
  let bookingsCancelled = 0;

  for (const hold of stale) {
    // Skip if the token invoice is already paid/settled (don't cancel a paid hold).
    if (hold.invoiceId) {
      const inv = await prisma.invoice.findUnique({
        where: { id: hold.invoiceId },
        select: { status: true, balanceDue: true },
      });
      if (inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0)) {
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
    if (flipped.count === 0) continue;
    expired++;

    // Cancel the linked Booking if it's still HOLD so it stops blocking the slot.
    if (hold.bookingId) {
      const cancelled = await prisma.booking.updateMany({
        where: { id: hold.bookingId, status: "HOLD" },
        data: { status: "CANCELLED" },
      });
      bookingsCancelled += cancelled.count;
    }
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    scanned: stale.length,
    expired,
    skippedPaid,
    bookingsCancelled,
  });
}
