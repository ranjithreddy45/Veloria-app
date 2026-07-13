import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runHandoverSlaChecks } from "@/lib/ops/handover-sla";

// Nags booking owners when a Sales→Ops handover is past its 24h SLA.
// Registered in the daily orchestrator's JOBS array as "handover-sla".
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
  const result = await runHandoverSlaChecks();
  return NextResponse.json({ success: true, ...result });
}
