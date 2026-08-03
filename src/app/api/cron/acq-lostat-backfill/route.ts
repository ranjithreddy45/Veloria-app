import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { backfillLostAt } from "@/lib/acq/lost-at-backfill";

// Fills AcqDeal.lostAt for deals lost before the column existed.
// Registered in the daily orchestrator's JOBS array as "acq-lostat-backfill".
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
  const result = await backfillLostAt();
  return NextResponse.json({ success: true, ...result });
}
