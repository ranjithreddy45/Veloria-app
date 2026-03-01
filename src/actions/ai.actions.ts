"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { scoreLeadWithAI } from "@/lib/ai/lead-scoring";
import { scoreDeal } from "@/lib/ai/deal-scoring";
import { Prisma } from "@prisma/client";

// ============================================================
// AI Score a Single Lead
// ============================================================

export async function aiScoreLead(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify the lead exists
    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Run the AI scoring
    const { score, reason } = await scoreLeadWithAI(leadId);

    // Update the lead with AI score data
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiScore: score,
        aiScoreReason: reason,
        aiScoredAt: new Date(),
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Lead",
      entityId: leadId,
      changes: { aiScore: score },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return { success: true as const, data: serialize(updatedLead) };
  } catch (error) {
    console.error("[AI_SCORE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to score lead with AI" };
  }
}

// ============================================================
// AI Score All Active Leads
// ============================================================

export async function aiScoreAllLeads() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get all leads that are not WON or LOST
    const leads = await prisma.lead.findMany({
      where: {
        status: {
          notIn: ["WON", "LOST"],
        },
      },
      select: { id: true },
    });

    let updatedCount = 0;

    // Score each lead
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

        updatedCount++;
      } catch (error) {
        // Log but continue scoring remaining leads
        console.error(`[AI_SCORE_ALL] Failed to score lead ${lead.id}:`, error);
      }
    }

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Lead",
      entityId: "bulk-ai-score",
      changes: { action: "ai_score_all", leadsScored: updatedCount },
    });

    revalidatePath("/leads");

    return {
      success: true as const,
      data: { updatedCount },
    };
  } catch (error) {
    console.error("[AI_SCORE_ALL_LEADS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to score leads with AI",
    };
  }
}

// ============================================================
// AI Score a Single Deal
// ============================================================

export async function aiScoreDeal(dealId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "ai:use")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify the deal exists
    const existing = await prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!existing) {
      return { success: false as const, error: "Deal not found" };
    }

    // Run the AI scoring
    const scoreResult = await scoreDeal(dealId);

    // Store factors and recommendations as JSON
    const aiFactorsData = {
      factors: scoreResult.factors,
      recommendations: scoreResult.recommendations,
    };

    // Update the deal with AI score data
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        aiScore: scoreResult.winProbability,
        aiScoreReason: scoreResult.explanation,
        aiScoredAt: new Date(),
        aiFactors: aiFactorsData as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Deal",
      entityId: dealId,
      changes: {
        aiScore: scoreResult.winProbability,
        riskLevel: scoreResult.riskLevel,
      },
    });

    revalidatePath("/pipeline");

    return { success: true as const, data: serialize(scoreResult) };
  } catch (error) {
    console.error("[AI_SCORE_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to score deal with AI" };
  }
}

// ============================================================
// AI Score All Active Deals
// ============================================================

export async function aiScoreAllDeals() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "ai:admin")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get all active deals (no wonDate, no lostDate)
    const deals = await prisma.deal.findMany({
      where: {
        wonDate: null,
        lostDate: null,
      },
      select: { id: true },
    });

    let updatedCount = 0;

    // Score each deal
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

        updatedCount++;
      } catch (error) {
        // Log but continue scoring remaining deals
        console.error(
          `[AI_SCORE_ALL_DEALS] Failed to score deal ${deal.id}:`,
          error
        );
      }
    }

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Deal",
      entityId: "bulk-ai-score-deals",
      changes: { action: "ai_score_all_deals", dealsScored: updatedCount },
    });

    revalidatePath("/pipeline");

    return {
      success: true as const,
      data: { updatedCount },
    };
  } catch (error) {
    console.error("[AI_SCORE_ALL_DEALS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to score deals with AI",
    };
  }
}
