import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { analyzeSentiment } from "@/lib/ai/sentiment";

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

    // Find communications without sentiment analysis (limit 100)
    const communications = await prisma.communication.findMany({
      where: { sentimentAt: null },
      select: { id: true, content: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    let success = 0;
    let failed = 0;

    for (const comm of communications) {
      try {
        const result = await analyzeSentiment(comm.content);
        await prisma.communication.update({
          where: { id: comm.id },
          data: {
            sentiment: result.sentiment,
            sentimentScore: result.score,
            sentimentAt: new Date(),
          },
        });
        success++;
      } catch (err) {
        console.error(`[SENTIMENT_CRON_ERROR] comm=${comm.id}`, err);
        failed++;
      }
    }

    return NextResponse.json({
      processed: communications.length,
      success,
      failed,
    });
  } catch (error) {
    console.error("[SENTIMENT_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
