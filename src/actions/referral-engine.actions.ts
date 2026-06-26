"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  generateReferralCodeSchema,
  createReferralWithCodeSchema,
  trackConversionSchema,
  createReferralRewardRuleSchema,
  updateReferralRewardRuleSchema,
  createReferralAssetSchema,
  type GenerateReferralCodeInput,
  type CreateReferralWithCodeInput,
  type TrackConversionInput,
  type CreateReferralRewardRuleInput,
  type UpdateReferralRewardRuleInput,
  type CreateReferralAssetInput,
} from "@/schemas/referral-engine.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { generateUniqueCode, buildReferralLink } from "@/lib/referral-code";

// ============================================================
// Generate Referral Code
// ============================================================

export async function generateReferralCode(data: GenerateReferralCodeInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = generateReferralCodeSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { contactId, userId, vendorId } = parsed.data;

    // Must have at least one identifier
    if (!contactId && !userId && !vendorId) {
      return {
        success: false as const,
        error: "At least one of contactId, userId, or vendorId is required",
      };
    }

    const code = await generateUniqueCode();
    const link = buildReferralLink(code);

    return { success: true as const, data: { code, link } };
  } catch (error) {
    console.error("[GENERATE_REFERRAL_CODE_ERROR]", error);
    return { success: false as const, error: "Failed to generate referral code" };
  }
}

// ============================================================
// Create Referral With Code
// ============================================================

export async function createReferralWithCode(data: CreateReferralWithCodeInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createReferralWithCodeSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const referralData = parsed.data;

    // Verify the referrer contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: referralData.referrerContactId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: false as const, error: "Referrer contact not found" };
    }

    // Generate referral code and link
    const referralCode = await generateUniqueCode();
    const referralLink = buildReferralLink(referralCode);

    const referral = await prisma.referral.create({
      data: {
        referredName: referralData.referredName,
        referredEmail: referralData.referredEmail || null,
        referredPhone: referralData.referredPhone || null,
        source: referralData.source,
        referrerContactId: referralData.referrerContactId,
        referrerUserId: referralData.referrerUserId || null,
        referrerVendorId: referralData.referrerVendorId || null,
        notes: referralData.notes || null,
        referralCode,
        referralLink,
        status: "PENDING",
      },
      include: {
        referrerContact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Referral",
      entityId: referral.id,
      changes: {
        referredName: referralData.referredName,
        referrerName: `${contact.firstName} ${contact.lastName}`,
        source: referralData.source,
        referralCode,
      },
    });

    revalidatePath("/referrals");
    return { success: true as const, data: serialize(referral) };
  } catch (error) {
    console.error("[CREATE_REFERRAL_WITH_CODE_ERROR]", error);
    return { success: false as const, error: "Failed to create referral" };
  }
}

// ============================================================
// Track Referral Conversion
// ============================================================

export async function trackReferralConversion(data: TrackConversionInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = trackConversionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { referralCode, bookingId, bookingValue } = parsed.data;

    // Find referral by code
    const referral = await prisma.referral.findUnique({
      where: { referralCode },
      include: {
        referrerContact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!referral) {
      return { success: false as const, error: "Referral not found for the given code" };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Update referral with conversion data
    const updatedReferral = await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: "BOOKING_CONFIRMED",
        convertedBookingId: bookingId,
        bookingValue,
      },
    });

    // Process rewards internally (caller already validated auth + permissions)
    const rewardsResult = await processReferralRewards(referral.id, session.user.id);
    if (!rewardsResult.success) {
      console.error(
        "[TRACK_REFERRAL_CONVERSION_REWARDS_ERROR]",
        referral.id,
        rewardsResult.error
      );
    }

    // Notify referrer if they have a userId
    if (referral.referrerUserId) {
      notify({
        userId: referral.referrerUserId,
        type: "REFERRAL_CONVERTED" as never,
        title: "Referral Converted",
        message: `Your referral for ${referral.referredName} has been converted to a booking!`,
        actionUrl: `/referrals/${referral.id}`,
      });
    }

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "Referral",
      entityId: referral.id,
      changes: {
        from: referral.status,
        to: "BOOKING_CONFIRMED",
        bookingId,
        bookingValue,
      },
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${referral.id}`);
    return { success: true as const, data: serialize(updatedReferral) };
  } catch (error) {
    console.error("[TRACK_REFERRAL_CONVERSION_ERROR]", error);
    return { success: false as const, error: "Failed to track referral conversion" };
  }
}

// ============================================================
// Process Referral Rewards (internal)
// ============================================================

// NOTE: Internal helper only. Trusts the caller (trackReferralConversion) to
// have already validated auth + permissions; does NOT re-check auth itself.
// `actorUserId` is the validated caller's id, used for activity logging.
async function processReferralRewards(referralId: string, actorUserId: string) {
  try {
    // Find referral with booking value
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        status: true,
        bookingValue: true,
        referrerContactId: true,
        referrerUserId: true,
        referredName: true,
      },
    });

    if (!referral) {
      return { success: false as const, error: "Referral not found" };
    }

    // Find all active reward rules
    const rules = await prisma.referralRewardRule.findMany({
      where: { isActive: true },
      orderBy: { tierLevel: "asc" },
    });

    const createdRewards: string[] = [];

    for (const rule of rules) {
      let matches = false;

      if (rule.triggerEvent === "BOOKING_CONFIRMED" && referral.status === "BOOKING_CONFIRMED") {
        // Check minBookingValue if applicable
        if (rule.minBookingValue) {
          matches = referral.bookingValue !== null &&
            Number(referral.bookingValue) >= Number(rule.minBookingValue);
        } else {
          matches = true;
        }
      }

      if (rule.triggerEvent === "HIGH_VALUE_BOOKING" && referral.status === "BOOKING_CONFIRMED") {
        // Must meet minBookingValue threshold
        matches = referral.bookingValue !== null &&
          rule.minBookingValue !== null &&
          Number(referral.bookingValue) >= Number(rule.minBookingValue);
      }

      if (rule.triggerEvent === "REPEAT_REFERRAL") {
        // Count previous converted referrals from same referrer
        const previousCount = await prisma.referral.count({
          where: {
            referrerContactId: referral.referrerContactId,
            status: { in: ["CONVERTED", "BOOKING_CONFIRMED"] },
            id: { not: referral.id },
          },
        });
        matches = previousCount > 0;
      }

      if (matches) {
        // Calculate reward value with optional bonus multiplier
        let rewardValue = Number(rule.rewardValue);
        if (rule.bonusMultiplier) {
          rewardValue = rewardValue * Number(rule.bonusMultiplier);
        }

        const reward = await prisma.referralReward.create({
          data: {
            status: "ELIGIBLE",
            rewardType: rule.rewardType,
            rewardValue,
            referralId: referral.id,
            ruleId: rule.id,
          },
        });

        createdRewards.push(reward.id);
      }
    }

    // Notify if rewards were created
    if (createdRewards.length > 0 && referral.referrerUserId) {
      notify({
        userId: referral.referrerUserId,
        type: "REFERRAL_REWARD_APPROVED" as never,
        title: "Referral Rewards Earned",
        message: `You earned ${createdRewards.length} reward(s) for referring ${referral.referredName}!`,
        actionUrl: `/referrals/${referral.id}`,
      });
    }

    logActivity({
      userId: actorUserId,
      action: "created",
      entityType: "ReferralReward",
      entityId: referral.id,
      changes: {
        rewardsCreated: createdRewards.length,
        rewardIds: createdRewards,
      },
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${referralId}`);
    return { success: true as const, data: { rewardsCreated: createdRewards.length } };
  } catch (error) {
    console.error("[PROCESS_REFERRAL_REWARDS_ERROR]", error);
    return { success: false as const, error: "Failed to process referral rewards" };
  }
}

// ============================================================
// Approve Referral Reward
// ============================================================

export async function approveReferralReward(rewardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:rewards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const reward = await prisma.referralReward.findUnique({
      where: { id: rewardId },
      include: {
        referral: {
          select: {
            id: true,
            referredName: true,
            referrerUserId: true,
            referrerContactId: true,
          },
        },
      },
    });

    if (!reward) {
      return { success: false as const, error: "Reward not found" };
    }

    if (reward.status !== "ELIGIBLE" && reward.status !== "REWARD_PENDING") {
      return {
        success: false as const,
        error: "Reward must be in ELIGIBLE or REWARD_PENDING status to approve",
      };
    }

    const updatedReward = await prisma.referralReward.update({
      where: { id: rewardId },
      data: { status: "REWARD_APPROVED" },
    });

    // Notify referrer
    if (reward.referral.referrerUserId) {
      notify({
        userId: reward.referral.referrerUserId,
        type: "REFERRAL_REWARD_APPROVED" as never,
        title: "Referral Reward Approved",
        message: `Your ${reward.rewardType} reward of ${reward.rewardValue} for referring ${reward.referral.referredName} has been approved!`,
        actionUrl: `/referrals/${reward.referral.id}`,
      });
    }

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ReferralReward",
      entityId: rewardId,
      changes: {
        from: reward.status,
        to: "REWARD_APPROVED",
      },
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${reward.referral.id}`);
    return { success: true as const, data: serialize(updatedReward) };
  } catch (error) {
    console.error("[APPROVE_REFERRAL_REWARD_ERROR]", error);
    return { success: false as const, error: "Failed to approve referral reward" };
  }
}

// ============================================================
// Pay Referral Reward
// ============================================================

export async function payReferralReward(rewardId: string, paymentRef: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:rewards")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const reward = await prisma.referralReward.findUnique({
      where: { id: rewardId },
      include: {
        referral: {
          select: { id: true, referredName: true },
        },
      },
    });

    if (!reward) {
      return { success: false as const, error: "Reward not found" };
    }

    if (reward.status !== "REWARD_APPROVED") {
      return {
        success: false as const,
        error: "Reward must be in REWARD_APPROVED status to mark as paid",
      };
    }

    const updatedReward = await prisma.referralReward.update({
      where: { id: rewardId },
      data: {
        status: "REWARD_PAID",
        paidAt: new Date(),
        paymentRef,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "ReferralReward",
      entityId: rewardId,
      changes: {
        from: "REWARD_APPROVED",
        to: "REWARD_PAID",
        paymentRef,
      },
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${reward.referral.id}`);
    return { success: true as const, data: serialize(updatedReward) };
  } catch (error) {
    console.error("[PAY_REFERRAL_REWARD_ERROR]", error);
    return { success: false as const, error: "Failed to pay referral reward" };
  }
}

// ============================================================
// Get Referral Dashboard
// ============================================================

export async function getReferralDashboard() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Total referrals and status breakdown
    const [
      total,
      pending,
      contacted,
      leadCreated,
      bookingConfirmed,
      converted,
      expired,
      cancelled,
    ] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: "PENDING" } }),
      prisma.referral.count({ where: { status: "CONTACTED" } }),
      prisma.referral.count({ where: { status: "LEAD_CREATED" } }),
      prisma.referral.count({ where: { status: "BOOKING_CONFIRMED" } }),
      prisma.referral.count({ where: { status: "CONVERTED" } }),
      prisma.referral.count({ where: { status: "EXPIRED" } }),
      prisma.referral.count({ where: { status: "CANCELLED" } }),
    ]);

    // Conversion rate
    const conversionRate =
      total > 0
        ? Math.round(((bookingConfirmed + converted) / total) * 100 * 100) / 100
        : 0;

    // Total booking value from converted referrals
    const bookingValueAgg = await prisma.referral.aggregate({
      _sum: { bookingValue: true },
      where: {
        status: { in: ["BOOKING_CONFIRMED", "CONVERTED"] },
        bookingValue: { not: null },
      },
    });
    const totalBookingValue = Number(bookingValueAgg._sum.bookingValue || 0);

    // Pending rewards count and value
    const pendingRewardsAgg = await prisma.referralReward.aggregate({
      _count: true,
      _sum: { rewardValue: true },
      where: { status: { in: ["REWARD_PENDING", "ELIGIBLE"] } },
    });
    const pendingRewardsCount = pendingRewardsAgg._count;
    const pendingRewardsValue = Number(pendingRewardsAgg._sum.rewardValue || 0);

    // Top 5 referrers
    const topReferrers = await prisma.referral.groupBy({
      by: ["referrerContactId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    const topReferrerIds = topReferrers.map((r) => r.referrerContactId);
    const topReferrerContacts = await prisma.contact.findMany({
      where: { id: { in: topReferrerIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const topReferrersWithDetails = topReferrers.map((r) => {
      const contact = topReferrerContacts.find((c) => c.id === r.referrerContactId);
      return {
        contactId: r.referrerContactId,
        name: contact ? `${contact.firstName} ${contact.lastName}` : "Unknown",
        email: contact?.email || null,
        referralCount: r._count.id,
      };
    });

    return {
      success: true as const,
      data: {
        total,
        byStatus: {
          pending,
          contacted,
          leadCreated,
          bookingConfirmed,
          converted,
          expired,
          cancelled,
        },
        conversionRate,
        totalBookingValue,
        pendingRewards: {
          count: pendingRewardsCount,
          value: pendingRewardsValue,
        },
        topReferrers: topReferrersWithDetails,
      },
    };
  } catch (error) {
    console.error("[GET_REFERRAL_DASHBOARD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral dashboard" };
  }
}

// ============================================================
// Get Referrer Leaderboard
// ============================================================

export async function getReferrerLeaderboard() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Group referrals by referrerContactId
    const grouped = await prisma.referral.groupBy({
      by: ["referrerContactId"],
      _count: { id: true },
      orderBy: [
        { _count: { id: "desc" } },
      ],
      take: 20,
    });

    const contactIds = grouped.map((g) => g.referrerContactId);

    // Fetch contact info
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Fetch converted counts and booking values per referrer
    const convertedCounts = await prisma.referral.groupBy({
      by: ["referrerContactId"],
      where: {
        referrerContactId: { in: contactIds },
        status: { in: ["CONVERTED", "BOOKING_CONFIRMED"] },
      },
      _count: { id: true },
      _sum: { bookingValue: true },
    });

    const convertedMap = new Map(
      convertedCounts.map((c) => [
        c.referrerContactId,
        {
          convertedCount: c._count.id,
          totalBookingValue: Number(c._sum.bookingValue || 0),
        },
      ])
    );

    const leaderboard = grouped.map((g) => {
      const contact = contacts.find((c) => c.id === g.referrerContactId);
      const converted = convertedMap.get(g.referrerContactId);
      return {
        contactId: g.referrerContactId,
        firstName: contact?.firstName || "",
        lastName: contact?.lastName || "",
        email: contact?.email || null,
        totalReferrals: g._count.id,
        convertedReferrals: converted?.convertedCount || 0,
        totalBookingValue: converted?.totalBookingValue || 0,
      };
    });

    // Sort by converted count desc, then total count desc
    leaderboard.sort((a, b) => {
      if (b.convertedReferrals !== a.convertedReferrals) {
        return b.convertedReferrals - a.convertedReferrals;
      }
      return b.totalReferrals - a.totalReferrals;
    });

    return { success: true as const, data: serialize(leaderboard) };
  } catch (error) {
    console.error("[GET_REFERRER_LEADERBOARD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referrer leaderboard" };
  }
}

// ============================================================
// Get Referral Reward Rules
// ============================================================

export async function getReferralRewardRules() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rules = await prisma.referralRewardRule.findMany({
      include: {
        _count: { select: { rewards: true } },
      },
      orderBy: { tierLevel: "asc" },
    });

    return { success: true as const, data: serialize(rules) };
  } catch (error) {
    console.error("[GET_REFERRAL_REWARD_RULES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral reward rules" };
  }
}

// ============================================================
// Create Referral Reward Rule
// ============================================================

export async function createReferralRewardRule(data: CreateReferralRewardRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createReferralRewardRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const ruleData = parsed.data;

    const rule = await prisma.referralRewardRule.create({
      data: {
        name: ruleData.name,
        description: ruleData.description || null,
        triggerEvent: ruleData.triggerEvent,
        rewardType: ruleData.rewardType,
        rewardValue: ruleData.rewardValue,
        minBookingValue: ruleData.minBookingValue ?? null,
        bonusMultiplier: ruleData.bonusMultiplier ?? null,
        tierLevel: ruleData.tierLevel,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ReferralRewardRule",
      entityId: rule.id,
      changes: {
        name: ruleData.name,
        triggerEvent: ruleData.triggerEvent,
        rewardType: ruleData.rewardType,
        rewardValue: ruleData.rewardValue,
      },
    });

    revalidatePath("/settings/referral-rules");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[CREATE_REFERRAL_REWARD_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to create referral reward rule" };
  }
}

// ============================================================
// Update Referral Reward Rule
// ============================================================

export async function updateReferralRewardRule(
  id: string,
  data: UpdateReferralRewardRuleInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateReferralRewardRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.referralRewardRule.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Reward rule not found" };
    }

    const updateData = parsed.data;

    const rule = await prisma.referralRewardRule.update({
      where: { id },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.description !== undefined && {
          description: updateData.description || null,
        }),
        ...(updateData.triggerEvent !== undefined && {
          triggerEvent: updateData.triggerEvent,
        }),
        ...(updateData.rewardType !== undefined && {
          rewardType: updateData.rewardType,
        }),
        ...(updateData.rewardValue !== undefined && {
          rewardValue: updateData.rewardValue,
        }),
        ...(updateData.minBookingValue !== undefined && {
          minBookingValue: updateData.minBookingValue ?? null,
        }),
        ...(updateData.bonusMultiplier !== undefined && {
          bonusMultiplier: updateData.bonusMultiplier ?? null,
        }),
        ...(updateData.tierLevel !== undefined && {
          tierLevel: updateData.tierLevel,
        }),
        ...(updateData.isActive !== undefined && {
          isActive: updateData.isActive,
        }),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ReferralRewardRule",
      entityId: id,
      changes: updateData as Record<string, unknown>,
    });

    revalidatePath("/settings/referral-rules");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[UPDATE_REFERRAL_REWARD_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to update referral reward rule" };
  }
}

// ============================================================
// Delete Referral Reward Rule
// ============================================================

export async function deleteReferralRewardRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.referralRewardRule.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Reward rule not found" };
    }

    await prisma.referralRewardRule.delete({
      where: { id },
    });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "ReferralRewardRule",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/settings/referral-rules");
    return { success: true as const };
  } catch (error) {
    console.error("[DELETE_REFERRAL_REWARD_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to delete referral reward rule" };
  }
}

// ============================================================
// Get Referral Assets
// ============================================================

export async function getReferralAssets() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:assets")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const assets = await prisma.referralAsset.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(assets) };
  } catch (error) {
    console.error("[GET_REFERRAL_ASSETS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral assets" };
  }
}

// ============================================================
// Create Referral Asset
// ============================================================

export async function createReferralAsset(data: CreateReferralAssetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:assets")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createReferralAssetSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const assetData = parsed.data;

    const asset = await prisma.referralAsset.create({
      data: {
        title: assetData.title,
        description: assetData.description || null,
        type: assetData.type,
        fileUrl: assetData.fileUrl,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ReferralAsset",
      entityId: asset.id,
      changes: {
        title: assetData.title,
        type: assetData.type,
      },
    });

    revalidatePath("/referrals/assets");
    return { success: true as const, data: serialize(asset) };
  } catch (error) {
    console.error("[CREATE_REFERRAL_ASSET_ERROR]", error);
    return { success: false as const, error: "Failed to create referral asset" };
  }
}

// ============================================================
// Delete Referral Asset
// ============================================================

export async function deleteReferralAsset(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:assets")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.referralAsset.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Referral asset not found" };
    }

    await prisma.referralAsset.delete({
      where: { id },
    });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "ReferralAsset",
      entityId: id,
      changes: { title: existing.title },
    });

    revalidatePath("/referrals/assets");
    return { success: true as const };
  } catch (error) {
    console.error("[DELETE_REFERRAL_ASSET_ERROR]", error);
    return { success: false as const, error: "Failed to delete referral asset" };
  }
}
