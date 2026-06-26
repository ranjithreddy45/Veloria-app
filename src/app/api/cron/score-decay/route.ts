import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { recalculateScoresForEntityType } from "@/actions/scoring-rule.actions";

export const maxDuration = 300;

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

    // Pass CRON_SECRET as the internal token so the (otherwise session-gated)
    // recalc action authorizes this session-less cron caller.
    const cronSecret = process.env.CRON_SECRET;
    const [leadResult, contactResult, dealResult] = await Promise.all([
      recalculateScoresForEntityType("LEAD", cronSecret),
      recalculateScoresForEntityType("CONTACT", cronSecret),
      recalculateScoresForEntityType("DEAL", cronSecret),
    ]);

    return NextResponse.json({
      success: true,
      results: {
        lead: leadResult.success ? leadResult.data : { error: leadResult.error },
        contact: contactResult.success ? contactResult.data : { error: contactResult.error },
        deal: dealResult.success ? dealResult.data : { error: dealResult.error },
      },
    });
  } catch (error) {
    console.error("[SCORE_DECAY_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
