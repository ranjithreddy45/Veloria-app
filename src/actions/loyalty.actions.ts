"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  earnPointsSchema,
  redeemPointsSchema,
  adjustPointsSchema,
  type EarnPointsInput,
  type RedeemPointsInput,
  type AdjustPointsInput,
} from "@/schemas/loyalty.schema";
import type { LoyaltyTier } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Tier Thresholds
// ============================================================

const TIER_THRESHOLDS: { tier: LoyaltyTier; minPoints: number }[] = [
  { tier: "PLATINUM", minPoints: 5000 },
  { tier: "GOLD", minPoints: 2000 },
  { tier: "SILVER", minPoints: 500 },
  { tier: "BRONZE", minPoints: 0 },
];

function calculateTier(totalEarned: number): LoyaltyTier {
  for (const { tier, minPoints } of TIER_THRESHOLDS) {
    if (totalEarned >= minPoints) return tier;
  }
  return "BRONZE";
}

// ============================================================
// Get Loyalty Accounts (List with filters)
// ============================================================

export async function getLoyaltyAccounts(params?: {
  tier?: LoyaltyTier;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.tier) {
      where.tier = params.tier;
    }

    const accounts = await prisma.loyaltyAccount.findMany({
      where,
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
      orderBy: { updatedAt: "desc" },
    });

    return { success: true as const, data: serialize(accounts) };
  } catch (error) {
    console.error("[GET_LOYALTY_ACCOUNTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch loyalty accounts" };
  }
}

// ============================================================
// Get Loyalty Account By Contact
// ============================================================

export async function getLoyaltyAccountByContact(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { contactId },
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
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!account) {
      return { success: false as const, error: "Loyalty account not found" };
    }

    return { success: true as const, data: serialize(account) };
  } catch (error) {
    console.error("[GET_LOYALTY_ACCOUNT_BY_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch loyalty account" };
  }
}

// ============================================================
// Get Loyalty Account By ID
// ============================================================

export async function getLoyaltyAccountById(accountId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
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
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!account) {
      return { success: false as const, error: "Loyalty account not found" };
    }

    return { success: true as const, data: serialize(account) };
  } catch (error) {
    console.error("[GET_LOYALTY_ACCOUNT_BY_ID_ERROR]", error);
    return { success: false as const, error: "Failed to fetch loyalty account" };
  }
}

// ============================================================
// Get or Create Account
// ============================================================

export async function getOrCreateAccount(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Try to find existing account
    let account = await prisma.loyaltyAccount.findUnique({
      where: { contactId },
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
    });

    if (!account) {
      // Create new BRONZE account
      account = await prisma.loyaltyAccount.create({
        data: {
          contactId,
          points: 0,
          tier: "BRONZE",
          totalEarned: 0,
          totalRedeemed: 0,
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
        },
      });

      logActivity({
        userId: session.user.id,
        action: "created",
        entityType: "LoyaltyAccount",
        entityId: account.id,
        changes: {
          contactName: `${contact.firstName} ${contact.lastName}`,
          tier: "BRONZE",
        },
      }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));
    }

    revalidatePath("/loyalty");
    return { success: true as const, data: serialize(account) };
  } catch (error) {
    console.error("[GET_OR_CREATE_ACCOUNT_ERROR]", error);
    return { success: false as const, error: "Failed to get or create loyalty account" };
  }
}

// ============================================================
// Earn Points
// ============================================================

export async function earnPoints(data: EarnPointsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = earnPointsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { points, description, referenceId } = parsed.data;

    // Resolve account
    let accountId = parsed.data.accountId;

    if (!accountId && parsed.data.contactId) {
      const account = await prisma.loyaltyAccount.findUnique({
        where: { contactId: parsed.data.contactId },
        select: { id: true },
      });

      if (!account) {
        return { success: false as const, error: "Loyalty account not found for this contact" };
      }
      accountId = account.id;
    }

    if (!accountId) {
      return { success: false as const, error: "Account ID or Contact ID is required" };
    }

    // Update account and create transaction in a single prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Loyalty account not found");
      }

      const newTotalEarned = account.totalEarned + points;
      const newPoints = account.points + points;
      const newTier = calculateTier(newTotalEarned);

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          points: newPoints,
          totalEarned: newTotalEarned,
          tier: newTier,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          type: "EARNED",
          points,
          description,
          referenceId: referenceId || null,
          accountId: accountId!,
        },
      });

      return { account: updatedAccount, transaction };
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "LoyaltyTransaction",
      entityId: result.transaction.id,
      changes: {
        type: "EARNED",
        points,
        description,
        accountId,
      },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    revalidatePath("/loyalty");
    revalidatePath(`/loyalty/${accountId}`);
    return { success: true as const, data: serialize(result.account) };
  } catch (error) {
    console.error("[EARN_POINTS_ERROR]", error);
    return { success: false as const, error: "Failed to earn points" };
  }
}

// ============================================================
// Redeem Points
// ============================================================

export async function redeemPoints(data: RedeemPointsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = redeemPointsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { points, description } = parsed.data;

    // Resolve account
    let accountId = parsed.data.accountId;

    if (!accountId && parsed.data.contactId) {
      const account = await prisma.loyaltyAccount.findUnique({
        where: { contactId: parsed.data.contactId },
        select: { id: true },
      });

      if (!account) {
        return { success: false as const, error: "Loyalty account not found for this contact" };
      }
      accountId = account.id;
    }

    if (!accountId) {
      return { success: false as const, error: "Account ID or Contact ID is required" };
    }

    // Update account and create transaction in a single prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Loyalty account not found");
      }

      if (account.points < points) {
        throw new Error("Insufficient points balance");
      }

      const newPoints = account.points - points;
      const newTotalRedeemed = account.totalRedeemed + points;

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          points: newPoints,
          totalRedeemed: newTotalRedeemed,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          type: "REDEEMED",
          points,
          description,
          accountId: accountId!,
        },
      });

      return { account: updatedAccount, transaction };
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "LoyaltyTransaction",
      entityId: result.transaction.id,
      changes: {
        type: "REDEEMED",
        points,
        description,
        accountId,
      },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    revalidatePath("/loyalty");
    revalidatePath(`/loyalty/${accountId}`);
    return { success: true as const, data: serialize(result.account) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to redeem points";
    console.error("[REDEEM_POINTS_ERROR]", error);
    return { success: false as const, error: message };
  }
}

// ============================================================
// Adjust Points (Admin)
// ============================================================

export async function adjustPoints(data: AdjustPointsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = adjustPointsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { accountId, points, description } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Loyalty account not found");
      }

      const newPoints = account.points + points;

      if (newPoints < 0) {
        throw new Error("Adjustment would result in negative points balance");
      }

      // If adjustment is positive, also update totalEarned and recalculate tier
      const newTotalEarned =
        points > 0 ? account.totalEarned + points : account.totalEarned;
      const newTier = calculateTier(newTotalEarned);

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          points: newPoints,
          ...(points > 0 && { totalEarned: newTotalEarned }),
          tier: newTier,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          type: "ADJUSTED",
          points,
          description,
          accountId,
        },
      });

      return { account: updatedAccount, transaction };
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "LoyaltyTransaction",
      entityId: result.transaction.id,
      changes: {
        type: "ADJUSTED",
        points,
        description,
        accountId,
      },
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    revalidatePath("/loyalty");
    revalidatePath(`/loyalty/${accountId}`);
    return { success: true as const, data: serialize(result.account) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to adjust points";
    console.error("[ADJUST_POINTS_ERROR]", error);
    return { success: false as const, error: message };
  }
}

// ============================================================
// Get Transactions
// ============================================================

export async function getTransactions(accountId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(transactions) };
  } catch (error) {
    console.error("[GET_TRANSACTIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch transactions" };
  }
}

// ============================================================
// Get Loyalty Stats
// ============================================================

export async function getLoyaltyStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "loyalty:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [
      totalAccounts,
      bronzeCount,
      silverCount,
      goldCount,
      platinumCount,
      pointsAggregate,
    ] = await Promise.all([
      prisma.loyaltyAccount.count(),
      prisma.loyaltyAccount.count({ where: { tier: "BRONZE" } }),
      prisma.loyaltyAccount.count({ where: { tier: "SILVER" } }),
      prisma.loyaltyAccount.count({ where: { tier: "GOLD" } }),
      prisma.loyaltyAccount.count({ where: { tier: "PLATINUM" } }),
      prisma.loyaltyAccount.aggregate({
        _sum: {
          points: true,
          totalEarned: true,
          totalRedeemed: true,
        },
      }),
    ]);

    return {
      success: true as const,
      data: {
        totalAccounts,
        bronzeCount,
        silverCount,
        goldCount,
        platinumCount,
        totalPointsOutstanding: pointsAggregate._sum.points ?? 0,
        totalPointsEarned: pointsAggregate._sum.totalEarned ?? 0,
        totalPointsRedeemed: pointsAggregate._sum.totalRedeemed ?? 0,
      },
    };
  } catch (error) {
    console.error("[GET_LOYALTY_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch loyalty stats" };
  }
}

// ============================================================
// Get Portal Loyalty (for client portal — uses user email)
// ============================================================

export async function getPortalLoyalty(userId: string) {
  try {
    // Verify the caller IS the userId (portal self-access only)
    const session = await auth();
    if (!session?.user?.id || session.user.id !== userId) {
      return { success: false as const, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return { success: false as const, error: "User not found" };
    }

    // Find contact by email
    const contact = await prisma.contact.findFirst({
      where: { email: user.email },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: true as const, data: null };
    }

    // Find loyalty account
    const account = await prisma.loyaltyAccount.findUnique({
      where: { contactId: contact.id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!account) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(account) };
  } catch (error) {
    console.error("[GET_PORTAL_LOYALTY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch loyalty data" };
  }
}
