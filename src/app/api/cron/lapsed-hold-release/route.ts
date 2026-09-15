import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { releaseLapsedHolds } from "@/lib/holds/release-lapsed-holds";

export const maxDuration = 60;

// ============================================================
// Cron · Lapsed-hold release (FREQUENT lane, hourly).
// ------------------------------------------------------------
// The availability reads (customer and team) already treat a lapsed hold as
// free the moment its window passes. This job makes the database agree, so
// every other reader — the bookings calendar, reports, the team's booking form
// — sees the slot free too, within the hour instead of at the 02:00 daily run.
//
// Guard: lapsedHoldWhere() in src/lib/holds/lapsed-hold.ts — HOLD, window
// passed, and NO money on ANY invoice of the booking (paid, part-paid, a
// completed/processing payment, a proof awaiting verification, or a checkout
// started in the last 15 minutes). The linked PublicHold is expired with it.
// The daily hold-expiry + public-hold-expiry pair still runs as a floor.
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
  const summary = await releaseLapsedHolds(now);
  return NextResponse.json({ success: true, ranAt: now.toISOString(), ...summary });
}
