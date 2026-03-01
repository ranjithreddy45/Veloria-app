import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { checkAllOverdueEscalations } from "@/lib/escalation-engine";

export async function GET(request: Request) {
  try {
    // Verify cron secret (timing-safe comparison)
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

    const result = await checkAllOverdueEscalations();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[ESCALATION_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
