"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  calculateScoresSchema,
  awardBadgeSchema,
  createIncentiveSchema,
  type CalculateScoresInput,
  type AwardBadgeInput,
  type CreateIncentiveInput,
} from "@/schemas/performance-score.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { calculateScoresForPeriod } from "@/lib/performance-calculator";

// ============================================================
// Calculate Performance Scores
// ============================================================

export async function calculatePerformanceScores(data: CalculateScoresInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = calculateScoresSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const result = await calculateScoresForPeriod(parsed.data.period);

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "PerformanceScore",
      entityId: parsed.data.period,
    });

    revalidatePath("/performance/scores");
    return {
      success: true as const,
      data: { usersProcessed: result.usersProcessed, vendorsProcessed: result.vendorsProcessed },
    };
  } catch (error) {
    console.error("[CALCULATE_PERFORMANCE_SCORES_ERROR]", error);
    return { success: false as const, error: "Failed to calculate performance scores" };
  }
}

// ============================================================
// Get Performance Scores
// ============================================================

export async function getPerformanceScores(params?: {
  period?: string;
  userId?: string;
  vendorId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.period) {
      where.period = params.period;
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.vendorId) {
      where.vendorId = params.vendorId;
    }

    const scores = await prisma.performanceScore.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { overallScore: "desc" },
    });

    return { success: true as const, data: serialize(scores) };
  } catch (error) {
    console.error("[GET_PERFORMANCE_SCORES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch performance scores" };
  }
}

// ============================================================
// Get Performance Leaderboard
// ============================================================

export async function getPerformanceLeaderboard(params?: {
  period?: string;
  type?: "user" | "vendor";
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = params?.period || defaultPeriod;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { period };

    if (params?.type === "vendor") {
      where.vendorId = { not: null };
    } else {
      where.userId = { not: null };
    }

    const scores = await prisma.performanceScore.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { overallScore: "desc" },
      take: 20,
    });

    // Also include badges for the period
    const badgeWhere: any = { period };
    if (params?.type === "vendor") {
      badgeWhere.vendorId = { not: null };
    } else {
      badgeWhere.userId = { not: null };
    }

    const badges = await prisma.badge.findMany({
      where: badgeWhere,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { earnedAt: "desc" },
    });

    return { success: true as const, data: serialize({ scores, badges }) };
  } catch (error) {
    console.error("[GET_PERFORMANCE_LEADERBOARD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch performance leaderboard" };
  }
}

// ============================================================
// Get Individual Performance Detail
// ============================================================

export async function getIndividualPerformanceDetail(userId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // IDOR guard: a user may view their OWN performance detail; viewing
    // anyone else's (scores, badges, incentive/bonus data) requires the
    // management-level permission held by HR/managers/admins.
    const isSelf = userId === session.user.id;
    if (!isSelf && !hasPermission(session.user.role, "performance:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [scores, badges, incentives] = await Promise.all([
      prisma.performanceScore.findMany({
        where: { userId },
        orderBy: { period: "desc" },
        take: 12,
      }),
      prisma.badge.findMany({
        where: { userId },
        orderBy: { earnedAt: "desc" },
      }),
      prisma.performanceIncentive.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { success: true as const, data: serialize({ scores, badges, incentives }) };
  } catch (error) {
    console.error("[GET_INDIVIDUAL_PERFORMANCE_DETAIL_ERROR]", error);
    return { success: false as const, error: "Failed to fetch individual performance detail" };
  }
}

// ============================================================
// Get Vendor Performance Detail
// ============================================================

export async function getVendorPerformanceDetail(vendorId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [scores, badges, incentives] = await Promise.all([
      prisma.performanceScore.findMany({
        where: { vendorId },
        orderBy: { period: "desc" },
        take: 12,
      }),
      prisma.badge.findMany({
        where: { vendorId },
        orderBy: { earnedAt: "desc" },
      }),
      prisma.performanceIncentive.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { success: true as const, data: serialize({ scores, badges, incentives }) };
  } catch (error) {
    console.error("[GET_VENDOR_PERFORMANCE_DETAIL_ERROR]", error);
    return { success: false as const, error: "Failed to fetch vendor performance detail" };
  }
}

// ============================================================
// Award Badge
// ============================================================

export async function awardBadge(data: AwardBadgeInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:awards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = awardBadgeSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const badgeData = parsed.data;

    if (!badgeData.userId && !badgeData.vendorId) {
      return { success: false as const, error: "Either userId or vendorId is required" };
    }

    const badge = await prisma.badge.create({
      data: {
        type: badgeData.type,
        title: badgeData.title,
        description: badgeData.description || null,
        period: badgeData.period || null,
        userId: badgeData.userId || null,
        vendorId: badgeData.vendorId || null,
      },
    });

    if (badgeData.userId) {
      notify({
        userId: badgeData.userId,
        type: "PERFORMANCE_BADGE_EARNED",
        title: "Badge Earned!",
        message: `You earned the "${badgeData.title}" badge. Congratulations!`,
        actionUrl: "/performance/badges",
      });
    }

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Badge",
      entityId: badge.id,
    });

    revalidatePath("/performance/badges");
    return { success: true as const, data: serialize(badge) };
  } catch (error) {
    console.error("[AWARD_BADGE_ERROR]", error);
    return { success: false as const, error: "Failed to award badge" };
  }
}

// ============================================================
// Get Badges
// ============================================================

export async function getBadges(params?: {
  userId?: string;
  vendorId?: string;
  period?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.vendorId) {
      where.vendorId = params.vendorId;
    }
    if (params?.period) {
      where.period = params.period;
    }

    const badges = await prisma.badge.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { earnedAt: "desc" },
    });

    return { success: true as const, data: serialize(badges) };
  } catch (error) {
    console.error("[GET_BADGES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch badges" };
  }
}

// ============================================================
// Create Incentive
// ============================================================

export async function createIncentive(data: CreateIncentiveInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:awards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createIncentiveSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const incentiveData = parsed.data;

    if (!incentiveData.userId && !incentiveData.vendorId) {
      return { success: false as const, error: "Either userId or vendorId is required" };
    }

    const incentive = await prisma.performanceIncentive.create({
      data: {
        title: incentiveData.title,
        description: incentiveData.description || null,
        points: incentiveData.points,
        bonusAmount: incentiveData.bonusAmount ?? null,
        period: incentiveData.period,
        userId: incentiveData.userId || null,
        vendorId: incentiveData.vendorId || null,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "PerformanceIncentive",
      entityId: incentive.id,
    });

    revalidatePath("/performance/incentives");
    return { success: true as const, data: serialize(incentive) };
  } catch (error) {
    console.error("[CREATE_INCENTIVE_ERROR]", error);
    return { success: false as const, error: "Failed to create incentive" };
  }
}

// ============================================================
// Award Incentive
// ============================================================

export async function awardIncentive(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:awards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.performanceIncentive.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Incentive not found" };
    }

    if (existing.isAwarded) {
      return { success: false as const, error: "Incentive has already been awarded" };
    }

    const incentive = await prisma.performanceIncentive.update({
      where: { id },
      data: {
        isAwarded: true,
        awardedAt: new Date(),
      },
    });

    if (existing.userId) {
      notify({
        userId: existing.userId,
        type: "SYSTEM",
        title: "Incentive Awarded",
        message: `Your incentive "${existing.title}" has been awarded. Well done!`,
        actionUrl: "/performance/incentives",
      });
    }

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "PerformanceIncentive",
      entityId: incentive.id,
    });

    revalidatePath("/performance/incentives");
    return { success: true as const, data: serialize(incentive) };
  } catch (error) {
    console.error("[AWARD_INCENTIVE_ERROR]", error);
    return { success: false as const, error: "Failed to award incentive" };
  }
}

// ============================================================
// Get Incentives
// ============================================================

export async function getIncentives(params?: {
  userId?: string;
  vendorId?: string;
  period?: string;
  isAwarded?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Incentive/bonus amounts are management-only — gate on performance:manage
    // to match the nav (a read-only rep must not see all staff/vendor payouts).
    if (!hasPermission(session.user.role, "performance:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.vendorId) {
      where.vendorId = params.vendorId;
    }
    if (params?.period) {
      where.period = params.period;
    }
    if (params?.isAwarded !== undefined) {
      where.isAwarded = params.isAwarded;
    }

    const incentives = await prisma.performanceIncentive.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(incentives) };
  } catch (error) {
    console.error("[GET_INCENTIVES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch incentives" };
  }
}
