"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { issueReferralCodeForReview } from "@/lib/reputation/referral-flywheel";
import { buildPartnerLink } from "@/lib/referral-portal/partner-code";

// ============================================================
// Review → Referral Flywheel — INTERNAL (auth + RBAC gated) actions
// ------------------------------------------------------------
// Staff-facing controls + analytics over the flywheel. The actual issuance /
// crediting logic lives in lib/reputation/referral-flywheel.ts and
// lib/referral/payout.ts (callable from cron without an auth session).
// ============================================================

// ---------------------------------------------------------------------------
// Manually issue a reviewer's personal referral code (from the reviews UI).
// ---------------------------------------------------------------------------
export async function issueCodeForReviewManual(reviewId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const result = await issueReferralCodeForReview(reviewId);
    if (!result.ok) {
      return { success: false as const, error: result.error };
    }

    await logActivity({
      userId: session.user.id,
      action: result.created ? "created" : "issued",
      entityType: "ReferralPartner",
      entityId: reviewId,
      changes: { source: "review", reviewId, code: result.code, sent: result.sent },
    });

    revalidatePath("/referrals/partners");
    return {
      success: true as const,
      data: {
        code: result.code,
        link: buildPartnerLink(result.code),
        created: result.created,
        sent: result.sent,
      },
    };
  } catch (error) {
    console.error("[ISSUE_CODE_FOR_REVIEW_MANUAL_ERROR]", error);
    return { success: false as const, error: "Failed to issue referral code" };
  }
}

// ---------------------------------------------------------------------------
// Flywheel funnel stats: codes issued → submissions → conversions → payouts.
// ---------------------------------------------------------------------------
export async function getFlywheelStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [
      codesIssued,
      guestCodesIssued,
      submissions,
      conversions,
      pendingPayouts,
      paidPayouts,
    ] = await Promise.all([
      prisma.referralPartner.count(),
      prisma.referralPartner.count({
        where: { type: "GUEST", issuedFromReviewId: { not: null } },
      }),
      prisma.referralPortalSubmission.count(),
      prisma.referralPortalSubmission.count({
        where: { convertedBookingId: { not: null } },
      }),
      prisma.referralPayout.aggregate({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.referralPayout.aggregate({
        where: { status: "PAID" },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    const submissionRate =
      codesIssued > 0 ? Math.round((submissions / codesIssued) * 1000) / 10 : 0;
    const conversionRate =
      submissions > 0 ? Math.round((conversions / submissions) * 1000) / 10 : 0;

    return {
      success: true as const,
      data: {
        codesIssued,
        guestCodesIssued,
        submissions,
        conversions,
        submissionRate,
        conversionRate,
        pendingPayoutCount: pendingPayouts._count,
        pendingPayoutValue: Number(pendingPayouts._sum.amount ?? 0),
        paidPayoutCount: paidPayouts._count,
        paidPayoutValue: Number(paidPayouts._sum.amount ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_FLYWHEEL_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch flywheel stats" };
  }
}
