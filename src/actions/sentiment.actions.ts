"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { analyzeSentiment } from "@/lib/ai/sentiment";

// ============================================================
// Get Contact Sentiment Trend
// ============================================================

export async function getContactSentimentTrend(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get all communications with sentiment data for this contact
    const communications = await prisma.communication.findMany({
      where: {
        contactId,
        sentimentAt: { not: null },
        sentimentScore: { not: null },
      },
      select: {
        sentiment: true,
        sentimentScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by month
    const monthMap = new Map<
      string,
      {
        month: string;
        totalScore: number;
        count: number;
        positive: number;
        neutral: number;
        negative: number;
      }
    >();

    for (const comm of communications) {
      const date = new Date(comm.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          totalScore: 0,
          count: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.totalScore += comm.sentimentScore ?? 0;
      entry.count += 1;

      if (comm.sentiment === "POSITIVE") entry.positive += 1;
      else if (comm.sentiment === "NEUTRAL") entry.neutral += 1;
      else if (comm.sentiment === "NEGATIVE") entry.negative += 1;
    }

    // Convert to array with avgScore, sorted by month ascending
    const trend = Array.from(monthMap.values())
      .map((entry) => ({
        month: entry.month,
        avgScore: Math.round((entry.totalScore / entry.count) * 100) / 100,
        count: entry.count,
        positive: entry.positive,
        neutral: entry.neutral,
        negative: entry.negative,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { success: true as const, data: serialize(trend) };
  } catch (error) {
    console.error("[GET_CONTACT_SENTIMENT_TREND_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch sentiment trend",
    };
  }
}

// ============================================================
// Bulk Analyze Sentiment
// ============================================================

export async function bulkAnalyzeSentiment() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "ai:admin")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Find communications without sentiment analysis
    const communications = await prisma.communication.findMany({
      where: { sentimentAt: null },
      select: { id: true, content: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    let analyzed = 0;
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
        analyzed++;
      } catch (err) {
        console.error(`[BULK_SENTIMENT_ERROR] comm=${comm.id}`, err);
        failed++;
      }
    }

    return { success: true as const, data: { analyzed, failed } };
  } catch (error) {
    console.error("[BULK_ANALYZE_SENTIMENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to run bulk sentiment analysis",
    };
  }
}

// ============================================================
// Get Sentiment Stats
// ============================================================

export async function getSentimentStats(contactId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sentimentAt: { not: null } };
    if (contactId) {
      where.contactId = contactId;
    }

    const communications = await prisma.communication.findMany({
      where,
      select: {
        sentiment: true,
        sentimentScore: true,
      },
    });

    const total = communications.length;
    const positive = communications.filter(
      (c) => c.sentiment === "POSITIVE"
    ).length;
    const neutral = communications.filter(
      (c) => c.sentiment === "NEUTRAL"
    ).length;
    const negative = communications.filter(
      (c) => c.sentiment === "NEGATIVE"
    ).length;

    const totalScore = communications.reduce(
      (sum, c) => sum + (c.sentimentScore ?? 0),
      0
    );
    const averageScore =
      total > 0 ? Math.round((totalScore / total) * 100) / 100 : 0;

    return {
      success: true as const,
      data: serialize({ total, positive, neutral, negative, averageScore }),
    };
  } catch (error) {
    console.error("[GET_SENTIMENT_STATS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch sentiment stats",
    };
  }
}
