import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { calculateScoresForPeriod } from "@/lib/performance-calculator";

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

    // Calculate for previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    const result = await calculateScoresForPeriod(period);
    return NextResponse.json({ success: true, period, ...result });
  } catch (error) {
    console.error("[PERFORMANCE_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
