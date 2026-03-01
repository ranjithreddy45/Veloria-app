import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { scoreLeadWithAI } from "@/lib/ai/lead-scoring";
import { scoreDeal } from "@/lib/ai/deal-scoring";
import { Prisma } from "@prisma/client";

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

    let leadsScored = 0;
    let leadsFailed = 0;
    let dealsScored = 0;
    let dealsFailed = 0;

    // ========================================
    // Score all active leads
    // ========================================
    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ["WON", "LOST"] },
      },
      select: { id: true },
    });

    for (const lead of leads) {
      try {
        const { score, reason } = await scoreLeadWithAI(lead.id);

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            aiScore: score,
            aiScoreReason: reason,
            aiScoredAt: new Date(),
          },
        });

        leadsScored++;
      } catch (error) {
        console.error(
          `[AI_SCORING_CRON] Failed to score lead ${lead.id}:`,
          error
        );
        leadsFailed++;
      }
    }

    // ========================================
    // Score all active deals
    // ========================================
    const deals = await prisma.deal.findMany({
      where: {
        wonDate: null,
        lostDate: null,
      },
      select: { id: true },
    });

    for (const deal of deals) {
      try {
        const scoreResult = await scoreDeal(deal.id);

        const aiFactorsData = {
          factors: scoreResult.factors,
          recommendations: scoreResult.recommendations,
        };

        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            aiScore: scoreResult.winProbability,
            aiScoreReason: scoreResult.explanation,
            aiScoredAt: new Date(),
            aiFactors: aiFactorsData as unknown as Prisma.InputJsonValue,
          },
        });

        dealsScored++;
      } catch (error) {
        console.error(
          `[AI_SCORING_CRON] Failed to score deal ${deal.id}:`,
          error
        );
        dealsFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      leads: {
        total: leads.length,
        scored: leadsScored,
        failed: leadsFailed,
      },
      deals: {
        total: deals.length,
        scored: dealsScored,
        failed: dealsFailed,
      },
    });
  } catch (error) {
    console.error("[AI_SCORING_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
