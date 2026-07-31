import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { backfillEnquirySource } from "@/lib/enquiry-source-backfill";

// Fills Contact.enquirySource from each contact's first lead where it's blank.
// Registered in the daily orchestrator's JOBS array as "enquiry-source-backfill".
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
  const result = await backfillEnquirySource();
  return NextResponse.json({ success: true, ...result });
}
