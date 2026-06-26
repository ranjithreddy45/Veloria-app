import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================================
// Referral payout crediting — core helper (NOT "use server")
// ------------------------------------------------------------
// Called after the existing trackReferralConversion → processReferralRewards
// path, or by the payout-accrual cron. Creates a PENDING ReferralPayout for a
// converted referral and, when the partner pays in POINTS, credits the
// referrer's LoyaltyAccount directly (the auth-gated earnPoints action cannot
// be called from a no-session cron context).
//
// MONEY SAFETY:
//  - PERCENT payouts use integer-paise math (×100, round, ÷100) to avoid
//    IEEE-754 drift, stored as Decimal(12,2).
//  - POINTS payouts credit loyalty (integer) and leave amount = 0; the two
//    units are never conflated on the Decimal amount column.
//  - Idempotent on referralId (and submissionId): a re-run never double-pays.
// ============================================================

const LOYALTY_TIER_THRESHOLDS: { tier: "PLATINUM" | "GOLD" | "SILVER" | "BRONZE"; minPoints: number }[] = [
  { tier: "PLATINUM", minPoints: 5000 },
  { tier: "GOLD", minPoints: 2000 },
  { tier: "SILVER", minPoints: 500 },
  { tier: "BRONZE", minPoints: 0 },
];

function calculateLoyaltyTier(totalEarned: number): "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" {
  for (const { tier, minPoints } of LOYALTY_TIER_THRESHOLDS) {
    if (totalEarned >= minPoints) return tier;
  }
  return "BRONZE";
}

/**
 * Compute the rupee payout amount as a Decimal, integer-paise safe.
 * FLAT   → partner.payoutValue
 * PERCENT→ bookingValue × payoutPercent / 100 (paise-rounded)
 * POINTS → 0 (credited via loyalty, not rupees)
 */
export function computePayoutAmount(
  payoutType: string,
  payoutValue: Prisma.Decimal,
  payoutPercent: Prisma.Decimal,
  bookingValue: Prisma.Decimal | null,
): Prisma.Decimal {
  if (payoutType === "FLAT") {
    return new Prisma.Decimal(payoutValue);
  }
  if (payoutType === "PERCENT") {
    if (!bookingValue) return new Prisma.Decimal(0);
    // paise = round(bookingValue * percent / 100 * 100) = round(bookingValue * percent)
    const paise = new Prisma.Decimal(bookingValue)
      .mul(payoutPercent)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    return paise.div(100);
  }
  // POINTS or unknown → no rupee amount.
  return new Prisma.Decimal(0);
}

/**
 * Points credited for a POINTS-type partner. Uses payoutValue as the flat point
 * count (rounded to int) — partners are configured in whole points.
 */
export function computePayoutPoints(
  payoutType: string,
  payoutValue: Prisma.Decimal,
): number {
  if (payoutType !== "POINTS") return 0;
  return Math.max(0, Math.round(Number(payoutValue)));
}

export interface CreditInput {
  referralId?: string | null;
  submissionId?: string | null;
  partnerId: string;
  bookingId?: string | null;
  bookingValue?: number | Prisma.Decimal | null;
  referralRewardId?: string | null;
}

export interface CreditResult {
  ok: boolean;
  payoutId?: string;
  deduped?: boolean;
  amount?: string;
  points?: number;
  error?: string;
}

/**
 * Credit the referrer on a confirmed conversion: create a PENDING ReferralPayout
 * and (for POINTS partners) a LoyaltyTransaction EARNED. Idempotent — if a
 * payout already exists for this referralId or submissionId, it is returned
 * unchanged. Best-effort; never throws.
 */
export async function creditReferrerOnConversion(
  input: CreditInput,
): Promise<CreditResult> {
  try {
    if (!input.referralId && !input.submissionId) {
      return { ok: false, error: "referralId or submissionId required" };
    }

    // Idempotency: one payout per referral / submission.
    const dedupeOr: Prisma.ReferralPayoutWhereInput[] = [];
    if (input.referralId) dedupeOr.push({ referralId: input.referralId });
    if (input.submissionId) dedupeOr.push({ submissionId: input.submissionId });

    const existing = await prisma.referralPayout.findFirst({
      where: { OR: dedupeOr },
      select: { id: true, amount: true },
    });
    if (existing) {
      return {
        ok: true,
        payoutId: existing.id,
        deduped: true,
        amount: existing.amount.toFixed(2),
      };
    }

    const partner = await prisma.referralPartner.findUnique({
      where: { id: input.partnerId },
      select: {
        id: true,
        contactId: true,
        payoutType: true,
        payoutValue: true,
        payoutPercent: true,
        currency: true,
      },
    });
    if (!partner) return { ok: false, error: "Partner not found" };

    const bookingValue =
      input.bookingValue != null ? new Prisma.Decimal(input.bookingValue) : null;

    const amount = computePayoutAmount(
      partner.payoutType,
      partner.payoutValue,
      partner.payoutPercent,
      bookingValue,
    );
    const points = computePayoutPoints(partner.payoutType, partner.payoutValue);

    // For POINTS partners, credit loyalty directly (replicating earnPoints'
    // $transaction since the auth-gated action cannot run from cron context).
    let loyaltyTransactionId: string | null = null;
    if (points > 0 && partner.contactId) {
      try {
        loyaltyTransactionId = await creditLoyaltyPoints(
          partner.contactId,
          points,
          `Referral reward — converted booking${input.bookingId ? ` ${input.bookingId}` : ""}`,
          input.referralId ?? input.submissionId ?? undefined,
        );
      } catch (e) {
        console.error("[referral.payout] loyalty credit failed", e);
      }
    }

    const payout = await prisma.referralPayout.create({
      data: {
        partnerId: partner.id,
        submissionId: input.submissionId || null,
        referralId: input.referralId || null,
        referralRewardId: input.referralRewardId || null,
        loyaltyTransactionId,
        amount,
        currency: partner.currency,
        status: "PENDING",
      },
      select: { id: true },
    });

    // Refresh the partner's earned rollup authoritatively (recompute, not ++).
    await refreshPartnerEarnedRollup(partner.id);

    return {
      ok: true,
      payoutId: payout.id,
      amount: amount.toFixed(2),
      points,
    };
  } catch (error) {
    console.error("[referral.payout] creditReferrerOnConversion failed", error);
    return { ok: false, error: "Credit failed" };
  }
}

/**
 * Credit loyalty points to a contact's account in one transaction, mirroring
 * earnPoints (update points/totalEarned/tier + an EARNED LoyaltyTransaction).
 * Creates the account if missing. Returns the LoyaltyTransaction id.
 */
async function creditLoyaltyPoints(
  contactId: string,
  points: number,
  description: string,
  referenceId?: string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let account = await tx.loyaltyAccount.findUnique({
      where: { contactId },
      select: { id: true, points: true, totalEarned: true },
    });
    if (!account) {
      const created = await tx.loyaltyAccount.create({
        data: { contactId, points: 0, tier: "BRONZE", totalEarned: 0, totalRedeemed: 0 },
        select: { id: true, points: true, totalEarned: true },
      });
      account = created;
    }

    const newTotalEarned = account.totalEarned + points;
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: account.points + points,
        totalEarned: newTotalEarned,
        tier: calculateLoyaltyTier(newTotalEarned),
      },
    });

    const txn = await tx.loyaltyTransaction.create({
      data: {
        type: "EARNED",
        points,
        description,
        referenceId: referenceId || null,
        accountId: account.id,
      },
      select: { id: true },
    });
    return txn.id;
  });
}

/**
 * Recompute ReferralPartner.totalEarned from its non-cancelled payouts.
 * Eventually-consistent — authoritative recompute rather than incremental.
 */
export async function refreshPartnerEarnedRollup(partnerId: string): Promise<void> {
  const agg = await prisma.referralPayout.aggregate({
    where: { partnerId, status: { not: "CANCELLED" } },
    _sum: { amount: true },
  });
  const paidAgg = await prisma.referralPayout.aggregate({
    where: { partnerId, status: "PAID" },
    _sum: { amount: true },
  });
  await prisma.referralPartner.update({
    where: { id: partnerId },
    data: {
      totalEarned: agg._sum.amount ?? new Prisma.Decimal(0),
      totalPaid: paidAgg._sum.amount ?? new Prisma.Decimal(0),
    },
  });
}
