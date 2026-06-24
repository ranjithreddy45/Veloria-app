import { NextResponse } from "next/server";
import { isValidCronSecret } from "@/lib/cron-auth";
import { sweepEventLifecycle } from "@/lib/sales/event-lifecycle";

export const maxDuration = 120;

// Daily: flip CONFIRMED→IN_PROGRESS on the event day, auto-COMPLETE clean past
// events (so reviews go out), and nudge the rest. Invoked by /api/cron/daily.
export async function GET(request: Request) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sweepEventLifecycle();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[EVENT_LIFECYCLE_ERROR]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
