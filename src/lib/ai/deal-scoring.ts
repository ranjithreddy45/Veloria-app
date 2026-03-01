import { prisma } from "@/lib/prisma";
import { chatCompletionJSON, getOpenAIClient } from "@/lib/ai/openai-client";

// ============================================================
// Types
// ============================================================

export interface DealScoreResult {
  winProbability: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explanation: string;
  factors: DealScoreFactor[];
  recommendations: string[];
}

export interface DealScoreFactor {
  name: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  score: number; // contribution to total
  description: string;
}

// ============================================================
// LLM Enhancement Response Shape
// ============================================================

interface LLMScoreRefinement {
  adjustedScore: number;
  insights: string[];
  recommendations: string[];
  riskAssessment: string;
}

// ============================================================
// Deterministic Factor Scorers
// ============================================================

function scoreStageVelocity(
  dealCreatedAt: Date,
  stageOrder: number,
  totalStages: number
): DealScoreFactor {
  const daysInPipeline = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(dealCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // Expected days per stage: ~14 days. More stages progressed per day = better.
  const expectedDaysPerStage = 14;
  const expectedDaysTotal = stageOrder * expectedDaysPerStage;
  const velocityRatio =
    expectedDaysTotal > 0 ? expectedDaysTotal / daysInPipeline : 1;

  let score: number;
  let description: string;
  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";

  if (velocityRatio >= 1.5) {
    score = 20;
    impact = "POSITIVE";
    description = `Deal is progressing ${Math.round(velocityRatio * 100 - 100)}% faster than average through the pipeline (${daysInPipeline} days, stage ${stageOrder}/${totalStages}).`;
  } else if (velocityRatio >= 1.0) {
    score = 15;
    impact = "POSITIVE";
    description = `Deal is progressing at a healthy pace through the pipeline (${daysInPipeline} days, stage ${stageOrder}/${totalStages}).`;
  } else if (velocityRatio >= 0.5) {
    score = 10;
    impact = "NEUTRAL";
    description = `Deal is moving somewhat slower than average (${daysInPipeline} days in pipeline, stage ${stageOrder}/${totalStages}).`;
  } else if (velocityRatio >= 0.25) {
    score = 5;
    impact = "NEGATIVE";
    description = `Deal is stalling — ${daysInPipeline} days in pipeline but only at stage ${stageOrder}/${totalStages}. Consider follow-up.`;
  } else {
    score = 0;
    impact = "NEGATIVE";
    description = `Deal has been in the pipeline for ${daysInPipeline} days with slow progression. Risk of going cold.`;
  }

  return { name: "Stage Velocity", impact, score, description };
}

function scoreCommunicationEngagement(
  communicationCount: number
): DealScoreFactor {
  let score: number;
  let description: string;
  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";

  if (communicationCount >= 5) {
    score = 20;
    impact = "POSITIVE";
    description = `Strong engagement with ${communicationCount} communications in the last 30 days. Active dialogue indicates strong interest.`;
  } else if (communicationCount >= 3) {
    score = 15;
    impact = "POSITIVE";
    description = `Good engagement with ${communicationCount} communications in the last 30 days.`;
  } else if (communicationCount >= 1) {
    score = 10;
    impact = "NEUTRAL";
    description = `Limited engagement with only ${communicationCount} communication(s) in the last 30 days. Consider increasing touchpoints.`;
  } else {
    score = 0;
    impact = "NEGATIVE";
    description =
      "No communications in the last 30 days. Deal may be going cold — immediate follow-up recommended.";
  }

  return { name: "Communication Engagement", impact, score, description };
}

function scoreDealValueComparison(
  dealValue: number,
  averageDealValue: number
): DealScoreFactor {
  if (averageDealValue <= 0) {
    return {
      name: "Deal Value Comparison",
      impact: "NEUTRAL",
      score: 8,
      description:
        "No historical deal data to compare. Scoring with default value.",
    };
  }

  const ratio = dealValue / averageDealValue;
  let score: number;
  let description: string;
  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";

  if (ratio >= 2) {
    score = 15;
    impact = "POSITIVE";
    description = `High-value deal at ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(dealValue)} — ${Math.round(ratio * 100)}% of average deal value. Indicates serious buyer intent.`;
  } else if (ratio >= 1) {
    score = 12;
    impact = "POSITIVE";
    description = `Above-average deal value at ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(dealValue)}.`;
  } else if (ratio >= 0.5) {
    score = 8;
    impact = "NEUTRAL";
    description = `Deal value of ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(dealValue)} is below average but within a reasonable range.`;
  } else {
    score = 4;
    impact = "NEGATIVE";
    description = `Below-average deal value of ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(dealValue)}. May indicate budget constraints.`;
  }

  return { name: "Deal Value Comparison", impact, score, description };
}

function scoreExpectedCloseDate(
  expectedCloseDate: Date | null
): DealScoreFactor {
  if (!expectedCloseDate) {
    return {
      name: "Expected Close Date",
      impact: "NEUTRAL",
      score: 5,
      description:
        "No expected close date set. Consider adding one for better pipeline forecasting.",
    };
  }

  const daysUntilClose = Math.floor(
    (new Date(expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  let score: number;
  let description: string;
  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";

  if (daysUntilClose < 0) {
    // Past due
    const daysOverdue = Math.abs(daysUntilClose);
    score = Math.max(0, 5 - Math.floor(daysOverdue / 7));
    impact = "NEGATIVE";
    description = `Expected close date was ${daysOverdue} day(s) ago. Deal is overdue — review and update the timeline.`;
  } else if (daysUntilClose <= 7) {
    score = 15;
    impact = "POSITIVE";
    description = `Expected to close within ${daysUntilClose} day(s). High urgency — prioritize closing activities.`;
  } else if (daysUntilClose <= 30) {
    score = 12;
    impact = "POSITIVE";
    description = `Expected to close within ${daysUntilClose} days. Good momentum — maintain engagement.`;
  } else if (daysUntilClose <= 90) {
    score = 8;
    impact = "NEUTRAL";
    description = `Expected close in ${daysUntilClose} days. Mid-term deal — keep nurturing.`;
  } else {
    score = 4;
    impact = "NEUTRAL";
    description = `Expected close in ${daysUntilClose} days. Long-term deal — consider periodic check-ins.`;
  }

  return { name: "Expected Close Date", impact, score, description };
}

function scoreLeadQuality(
  leadStatus: string,
  leadSource: string
): DealScoreFactor {
  const statusScores: Record<string, number> = {
    NEGOTIATION: 10,
    PROPOSAL_SENT: 8,
    QUALIFIED: 6,
    CONTACTED: 4,
    NEW: 2,
    WON: 0,
    LOST: 0,
  };

  const sourceBonus: Record<string, number> = {
    REFERRAL: 5,
    PARTNER: 4,
    WEBSITE: 3,
    EVENT: 3,
    SOCIAL_MEDIA: 2,
    PHONE_INQUIRY: 2,
    EMAIL: 2,
    WALK_IN: 2,
    ADVERTISEMENT: 1,
    OTHER: 1,
  };

  const statusScore = statusScores[leadStatus] ?? 2;
  const bonus = sourceBonus[leadSource] ?? 1;
  const totalScore = Math.min(15, statusScore + bonus);

  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  if (totalScore >= 12) {
    impact = "POSITIVE";
  } else if (totalScore >= 7) {
    impact = "NEUTRAL";
  } else {
    impact = "NEGATIVE";
  }

  return {
    name: "Lead Quality",
    impact,
    score: totalScore,
    description: `Lead status "${leadStatus}" from "${leadSource}" source. ${
      totalScore >= 12
        ? "Strong lead progression and quality source indicate high intent."
        : totalScore >= 7
          ? "Moderate lead quality — continue nurturing."
          : "Early-stage lead from lower-priority source. May require additional qualification."
    }`,
  };
}

function scoreBookingConversion(
  hasBooking: boolean,
  bookingStatus?: string | null
): DealScoreFactor {
  if (hasBooking && bookingStatus === "CONFIRMED") {
    return {
      name: "Booking Conversion",
      impact: "POSITIVE",
      score: 15,
      description:
        "Deal has a confirmed booking. Extremely high probability of closing successfully.",
    };
  }

  if (hasBooking) {
    return {
      name: "Booking Conversion",
      impact: "POSITIVE",
      score: 12,
      description:
        "Deal has an associated booking. Strong conversion signal — follow up to confirm.",
    };
  }

  return {
    name: "Booking Conversion",
    impact: "NEUTRAL",
    score: 0,
    description:
      "No booking created yet. Consider proposing a booking to advance the deal.",
  };
}

// ============================================================
// Risk Level
// ============================================================

function getRiskLevel(
  score: number
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 70) return "LOW";
  if (score >= 50) return "MEDIUM";
  if (score >= 30) return "HIGH";
  return "CRITICAL";
}

// ============================================================
// Main Scoring Function
// ============================================================

export async function scoreDeal(dealId: string): Promise<DealScoreResult> {
  // 1. Fetch deal with all relations
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      stage: true,
      lead: {
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
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      booking: {
        select: { id: true, status: true },
      },
    },
  });

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  // 2. Fetch supplementary data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [communicationCount, totalStages, avgValue] = await Promise.all([
    // Count recent communications for this contact
    deal.lead.contact
      ? prisma.communication.count({
          where: {
            contactId: deal.lead.contact.id,
            createdAt: { gte: thirtyDaysAgo },
          },
        })
      : Promise.resolve(0),
    // Count total pipeline stages (excluding won/lost)
    prisma.pipelineStage.count({
      where: { isWonStage: false, isLostStage: false },
    }),
    // Average deal value for comparison
    prisma.deal.aggregate({
      _avg: { value: true },
      where: {
        id: { not: dealId },
      },
    }),
  ]);

  const averageDealValue = Number(avgValue._avg.value ?? 0);
  const dealValue = Number(deal.value);

  // 3. Calculate deterministic factors
  const factors: DealScoreFactor[] = [
    scoreStageVelocity(deal.createdAt, deal.stage.order, totalStages || 5),
    scoreCommunicationEngagement(communicationCount),
    scoreDealValueComparison(dealValue, averageDealValue),
    scoreExpectedCloseDate(deal.expectedCloseDate),
    scoreLeadQuality(deal.lead.status, deal.lead.source),
    scoreBookingConversion(!!deal.booking, deal.booking?.status ?? null),
  ];

  let deterministicScore = factors.reduce((sum, f) => sum + f.score, 0);
  deterministicScore = Math.max(0, Math.min(100, deterministicScore));

  let riskLevel = getRiskLevel(deterministicScore);

  // Build default explanation and recommendations
  const positiveFactors = factors.filter((f) => f.impact === "POSITIVE");
  const negativeFactors = factors.filter((f) => f.impact === "NEGATIVE");

  let explanation = `AI Deal Score: ${deterministicScore}/100 (${riskLevel} risk)\n\n`;
  if (positiveFactors.length > 0) {
    explanation += `Strengths: ${positiveFactors.map((f) => f.name).join(", ")}.\n`;
  }
  if (negativeFactors.length > 0) {
    explanation += `Areas of concern: ${negativeFactors.map((f) => f.name).join(", ")}.\n`;
  }

  let recommendations: string[] = [];

  // Generate default recommendations based on factors
  if (communicationCount === 0) {
    recommendations.push(
      "Schedule an immediate follow-up call or email to re-engage this contact."
    );
  }
  if (!deal.expectedCloseDate) {
    recommendations.push(
      "Set an expected close date to improve pipeline forecasting accuracy."
    );
  } else {
    const daysUntil = Math.floor(
      (new Date(deal.expectedCloseDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysUntil < 0) {
      recommendations.push(
        "Update the expected close date — the current one has passed."
      );
    }
  }
  if (!deal.booking) {
    recommendations.push(
      "Consider creating a booking to advance this deal toward closure."
    );
  }
  if (negativeFactors.length > 0) {
    recommendations.push(
      `Address concerns in: ${negativeFactors.map((f) => f.name).join(", ")}.`
    );
  }
  if (deterministicScore >= 70) {
    recommendations.push(
      "This deal is in good shape. Focus on closing activities and securing commitment."
    );
  }

  // 4. Optional LLM enhancement
  const aiClient = getOpenAIClient();
  if (aiClient) {
    try {
      const dealContext = {
        title: deal.title,
        value: dealValue,
        probability: deal.probability,
        daysInPipeline: Math.floor(
          (Date.now() - new Date(deal.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        stageName: deal.stage.name,
        stageOrder: deal.stage.order,
        isWonStage: deal.stage.isWonStage,
        isLostStage: deal.stage.isLostStage,
        leadStatus: deal.lead.status,
        leadSource: deal.lead.source,
        eventType: deal.lead.eventType,
        eventDate: deal.lead.eventDate
          ? new Date(deal.lead.eventDate).toISOString()
          : null,
        guestCount: deal.lead.guestCount,
        expectedCloseDate: deal.expectedCloseDate
          ? new Date(deal.expectedCloseDate).toISOString()
          : null,
        communicationsLast30Days: communicationCount,
        hasBooking: !!deal.booking,
        bookingStatus: deal.booking?.status ?? null,
        notes: deal.notes,
        deterministicScore,
        deterministicFactors: factors.map((f) => ({
          name: f.name,
          impact: f.impact,
          score: f.score,
        })),
      };

      const llmResult = await chatCompletionJSON<LLMScoreRefinement>({
        system: `You are a CRM deal scoring AI for a venue/event management company in India (currency: INR).
Given deal context and a deterministic base score, refine the score and provide actionable insights.

Respond with this JSON structure:
{
  "adjustedScore": <number 0-100, should be close to the deterministic score but can adjust based on nuanced factors>,
  "insights": [<2-3 short insight strings about this deal>],
  "recommendations": [<3-5 specific, actionable recommendation strings>],
  "riskAssessment": "<1-2 sentence risk summary>"
}`,
        user: JSON.stringify(dealContext),
      });

      if (llmResult) {
        // Blend scores: 70% deterministic + 30% LLM
        const blendedScore = Math.round(
          deterministicScore * 0.7 + (llmResult.adjustedScore ?? deterministicScore) * 0.3
        );
        deterministicScore = Math.max(0, Math.min(100, blendedScore));
        riskLevel = getRiskLevel(deterministicScore);

        if (llmResult.insights && llmResult.insights.length > 0) {
          explanation += `\nAI Insights:\n${llmResult.insights.map((i) => `  - ${i}`).join("\n")}`;
        }

        if (llmResult.riskAssessment) {
          explanation += `\n\nRisk Assessment: ${llmResult.riskAssessment}`;
        }

        if (llmResult.recommendations && llmResult.recommendations.length > 0) {
          recommendations = llmResult.recommendations;
        }
      }
    } catch (error) {
      // LLM enhancement failed — fall back to deterministic-only
      console.error("[DEAL_SCORING_LLM_ERROR]", error);
    }
  }

  return {
    winProbability: deterministicScore,
    riskLevel,
    explanation,
    factors,
    recommendations,
  };
}
