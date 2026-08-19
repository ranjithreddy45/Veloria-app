import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { CLICK_MAX_AGE_MS } from "@/lib/marketing/gads-value";

/**
 * Daily cron: retire offline-conversion rows whose click is older than 90 days.
 * Google will not accept them, so we flip READY → SKIPPED_EXPIRED to keep the
 * upload queue clean (mirrors the inline expiry in the read API). CRON_SECRET
 * auth, same as every other cron job.
 */
export async function GET(request: Request) {
  try {
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

    const cutoff = new Date(Date.now() - CLICK_MAX_AGE_MS);
    const [ql, booking] = await Promise.all([
      prisma.lead.updateMany({
        where: { qlUploadStatus: "READY", createdAt: { lt: cutoff } },
        data: { qlUploadStatus: "SKIPPED_EXPIRED" },
      }),
      prisma.lead.updateMany({
        where: { bookingUploadStatus: "READY", createdAt: { lt: cutoff } },
        data: { bookingUploadStatus: "SKIPPED_EXPIRED" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      qlExpired: ql.count,
      bookingExpired: booking.count,
    });
  } catch (error) {
    console.error("[GADS_EXPIRE_CLICKS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
