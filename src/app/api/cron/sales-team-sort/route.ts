import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sortUnsortedLeads } from "@/lib/crm/sales-team-db";

// Backstop for the team CRMs: any Unsorted lead whose event type now names a
// team (enrichment, a later edit, an intake path that didn't sort) is given
// that team. Never touches a lead a person sorted. Registered in the FREQUENT lane.
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
  const result = await sortUnsortedLeads();
  return NextResponse.json({ success: true, ...result });
}
