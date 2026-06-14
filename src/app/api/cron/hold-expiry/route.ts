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
  const res = await prisma.booking.updateMany({
    where: { status: "HOLD", holdExpiresAt: { not: null, lt: now } },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true, ranAt: now.toISOString(), expiredHolds: res.count });
}
