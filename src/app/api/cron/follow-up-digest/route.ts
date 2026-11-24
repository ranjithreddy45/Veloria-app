import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendFollowUpDigests } from "@/lib/crm/follow-up-digest";
import { withCronLease } from "@/lib/cron/lease";

// Morning follow-up reminder: one notice per rep with follow-ups due today or
// overdue, from 9 am India time, at most once a day (src/lib/crm/follow-up-digest.ts).
// Registered in the FREQUENT (hourly) lane.
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
  try {
    // The day's dedupe is check-then-send, so two overlapping runs (the lane
    // plus a stray external ping) must not both get past the check: hold a lease.
    const run = await withCronLease("job:follow-up-digest", 5 * 60 * 1000, () => sendFollowUpDigests());
    if (!run.ran) return NextResponse.json({ success: true, skipped: "Another run is in progress" });
    return NextResponse.json({ success: true, ...run.value });
  } catch (e) {
    console.error("[CRON_FOLLOW_UP_DIGEST_ERROR]", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
