import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { checkMetaHealth } from "@/lib/meta/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// GET /api/cron/meta-health — daily: is the Meta connection alive?
//
// Alerts the admins when the token is dead or the page is no longer subscribed,
// because both mean leads are being lost right now and neither shows up
// anywhere else until someone counts the leads that never arrived.
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

  const ranAt = new Date().toISOString();
  try {
    const health = await checkMetaHealth({ alert: true });
    // A non-200 is how runCronLane notices and tells the admins as well.
    return NextResponse.json({ success: health.ok, ranAt, health }, { status: health.ok ? 200 : 500 });
  } catch (e) {
    console.error("[CRON_META_HEALTH_ERROR]", e);
    return NextResponse.json({ success: false, ranAt }, { status: 500 });
  }
}
