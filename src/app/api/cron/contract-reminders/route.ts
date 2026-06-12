import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { remindContractSignings } from "@/actions/acq-contract.actions";

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
  const reminded = await remindContractSignings();
  return NextResponse.json({ success: true, reminded });
}
