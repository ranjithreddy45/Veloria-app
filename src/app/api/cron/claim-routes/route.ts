import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { attachMissingClaimChains } from "@/lib/hr/claim-workflow";

// Backstop for reimbursement approval chains: any claim still awaiting
// approval without a chain (raised before chains existed) gets one, and its
// approvers and the employee are told where it is. Normally a claim gets its
// chain when submitted or the first time a list shows it; this makes sure
// nobody waits on a screen being opened. Registered in the FREQUENT lane.
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
  const result = await attachMissingClaimChains();
  return NextResponse.json({ success: true, ...result });
}
