"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { refreshPartnerEarnedRollup } from "@/lib/referral/payout";

// ============================================================
// Referral Partner Payout Ledger — INTERNAL (auth + RBAC gated)
// ------------------------------------------------------------
// PENDING → APPROVED → PAID state machine, mirroring approveReferralReward /
// payReferralReward. Every transition is guarded so a double-click or retry
// cannot double-advance / double-pay (money safety).
// ============================================================

const PAYOUT_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// List payouts (optionally filtered by status / partner).
// ---------------------------------------------------------------------------
export async function listReferralPayouts(params?: {
  status?: string;
  partnerId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const where: Prisma.ReferralPayoutWhereInput = {};
    if (
      params?.status &&
      ["PENDING", "APPROVED", "PAID", "CANCELLED"].includes(params.status)
    ) {
      where.status = params.status;
    }
    if (params?.partnerId) where.partnerId = params.partnerId;

    const payouts = await prisma.referralPayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAYOUT_PAGE_SIZE,
      include: {
        partner: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    return { success: true as const, data: serialize(payouts) };
  } catch (error) {
    console.error("[LIST_REFERRAL_PAYOUTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payouts" };
  }
}

// ---------------------------------------------------------------------------
// Approve: PENDING → APPROVED. Guarded updateMany so concurrent calls converge.
// ---------------------------------------------------------------------------
export async function approveReferralPayout(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:rewards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payout = await prisma.referralPayout.findUnique({
      where: { id },
      select: { id: true, status: true, partnerId: true },
    });
    if (!payout) return { success: false as const, error: "Payout not found" };
    if (payout.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only PENDING payouts can be approved",
      };
    }

    const updated = await prisma.referralPayout.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    if (updated.count === 0) {
      return { success: false as const, error: "Payout is no longer pending" };
    }

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ReferralPayout",
      entityId: id,
      changes: { from: "PENDING", to: "APPROVED" },
    });

    revalidatePath("/referrals/partners");
    revalidatePath(`/referrals/partners/${payout.partnerId}`);
    return { success: true as const };
  } catch (error) {
    console.error("[APPROVE_REFERRAL_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to approve payout" };
  }
}

// ---------------------------------------------------------------------------
// Pay: APPROVED → PAID. Idempotent — the guarded updateMany only flips a row
// still APPROVED, so a retry/double-click cannot record two paymentRefs.
// ---------------------------------------------------------------------------
export async function payReferralPayout(id: string, paymentRef: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:rewards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const ref = (paymentRef || "").trim();
    if (!ref) {
      return { success: false as const, error: "A payment reference is required" };
    }

    const payout = await prisma.referralPayout.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        partnerId: true,
        partner: { select: { userId: true, name: true } },
      },
    });
    if (!payout) return { success: false as const, error: "Payout not found" };
    if (payout.status !== "APPROVED") {
      return {
        success: false as const,
        error: "Only APPROVED payouts can be marked paid",
      };
    }

    const updated = await prisma.referralPayout.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "PAID", paidAt: new Date(), paymentRef: ref },
    });
    if (updated.count === 0) {
      return { success: false as const, error: "Payout is no longer approved" };
    }

    // Refresh the partner's totalPaid/totalEarned rollups authoritatively.
    await refreshPartnerEarnedRollup(payout.partnerId).catch((e) =>
      console.error("[PAY_REFERRAL_PAYOUT_ROLLUP_ERROR]", e),
    );

    if (payout.partner.userId) {
      notify({
        userId: payout.partner.userId,
        type: "REFERRAL_REWARD_APPROVED" as never,
        title: "Referral Payout Sent",
        message: `Your referral payout has been paid (ref ${ref}).`,
        actionUrl: `/referrals/partners/${payout.partnerId}`,
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ReferralPayout",
      entityId: id,
      changes: { from: "APPROVED", to: "PAID", paymentRef: ref },
    });

    revalidatePath("/referrals/partners");
    revalidatePath(`/referrals/partners/${payout.partnerId}`);
    return { success: true as const };
  } catch (error) {
    console.error("[PAY_REFERRAL_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to pay payout" };
  }
}

// ---------------------------------------------------------------------------
// Cancel a payout (PENDING/APPROVED → CANCELLED). Guarded.
// ---------------------------------------------------------------------------
export async function cancelReferralPayout(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:rewards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payout = await prisma.referralPayout.findUnique({
      where: { id },
      select: { id: true, status: true, partnerId: true },
    });
    if (!payout) return { success: false as const, error: "Payout not found" };
    if (payout.status === "PAID" || payout.status === "CANCELLED") {
      return {
        success: false as const,
        error: "Paid or cancelled payouts cannot be cancelled",
      };
    }

    const updated = await prisma.referralPayout.updateMany({
      where: { id, status: { in: ["PENDING", "APPROVED"] } },
      data: {
        status: "CANCELLED",
        notes: reason?.trim() || null,
      },
    });
    if (updated.count === 0) {
      return { success: false as const, error: "Payout can no longer be cancelled" };
    }

    await refreshPartnerEarnedRollup(payout.partnerId).catch(() => undefined);

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ReferralPayout",
      entityId: id,
      changes: { from: payout.status, to: "CANCELLED", reason: reason || null },
    });

    revalidatePath("/referrals/partners");
    revalidatePath(`/referrals/partners/${payout.partnerId}`);
    return { success: true as const };
  } catch (error) {
    console.error("[CANCEL_REFERRAL_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to cancel payout" };
  }
}
