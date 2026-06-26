import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creditReferrerOnConversion } from "@/lib/referral/payout";

// ============================================================
// Referral payout accrual sweep — cron worker (NOT "use server")
// ------------------------------------------------------------
// Idempotent + best-effort, mirrors enqueueReviewRequestsForCompletedBookings.
//   1. Detect conversions: ReferralPortalSubmissions whose linked Referral has
//      a confirmed booking, OR whose linked Lead converted to a Booking. Stamp
//      convertedBookingId + bookingValue on the submission.
//   2. Accrue: for each converted submission lacking a ReferralPayout, create a
//      PENDING payout via creditReferrerOnConversion (dedup by referral/submission).
//   3. Refresh denormalised partner rollups authoritatively (recompute, not ++).
//
// A single failing row never aborts the sweep.
// ============================================================

export interface AccrualResult {
  scanned: number;
  newlyConverted: number;
  payoutsCreated: number;
  payoutsDeduped: number;
  partnersRefreshed: number;
}

const BATCH = 500;

// Self-referral suppression marker written by recordReferralIngestion
// (src/lib/referral/ingest.ts) into submission.message. There is no durable
// boolean column on ReferralPortalSubmission, so the marker IS the suppression
// flag — a submission whose message carries this prefix must never accrue a
// payout or loyalty credit (anti-fraud guard for self-referrals). Kept in sync
// with the string written at ingest time.
const SELF_REFERRAL_SUPPRESS_MARKER = "[self-referral — payout suppressed]";

function isPayoutSuppressed(message: string | null): boolean {
  return !!message && message.includes(SELF_REFERRAL_SUPPRESS_MARKER);
}

export async function enqueueReferralPayoutsForConvertedReferrals(): Promise<AccrualResult> {
  const result: AccrualResult = {
    scanned: 0,
    newlyConverted: 0,
    payoutsCreated: 0,
    payoutsDeduped: 0,
    partnersRefreshed: 0,
  };

  // 1) Detect conversions on submissions not yet marked converted.
  const open = await prisma.referralPortalSubmission.findMany({
    where: { convertedBookingId: null },
    select: { id: true, leadId: true, referralId: true, partnerId: true, message: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  result.scanned = open.length;

  for (const sub of open) {
    try {
      // Self-referrals are payout-suppressed at ingest: never stamp them as
      // converted, so they can never enter the accrual loop below.
      if (isPayoutSuppressed(sub.message)) continue;

      const conversion = await detectConversion(sub.referralId, sub.leadId);
      if (!conversion) continue;

      await prisma.referralPortalSubmission.update({
        where: { id: sub.id },
        data: {
          convertedBookingId: conversion.bookingId,
          bookingValue: conversion.bookingValue,
        },
      });
      result.newlyConverted += 1;
    } catch (e) {
      console.error("[payout-accrual] conversion detect failed", sub.id, e);
    }
  }

  // 2) Accrue payouts for every converted submission lacking one.
  const converted = await prisma.referralPortalSubmission.findMany({
    where: { convertedBookingId: { not: null } },
    select: {
      id: true,
      partnerId: true,
      referralId: true,
      convertedBookingId: true,
      bookingValue: true,
      message: true,
    },
    orderBy: { updatedAt: "desc" },
    take: BATCH,
  });

  const touchedPartners = new Set<string>();

  for (const sub of converted) {
    try {
      // Enforce the self-referral suppression marker: such submissions accrue
      // nothing (no payout, no loyalty credit). Guarded here too in case a row
      // was stamped converted by an earlier run before suppression was enforced.
      if (isPayoutSuppressed(sub.message)) continue;

      const credit = await creditReferrerOnConversion({
        partnerId: sub.partnerId,
        submissionId: sub.id,
        referralId: sub.referralId,
        bookingId: sub.convertedBookingId,
        bookingValue: sub.bookingValue,
      });
      if (credit.ok) {
        touchedPartners.add(sub.partnerId);
        if (credit.deduped) result.payoutsDeduped += 1;
        else result.payoutsCreated += 1;
      }
    } catch (e) {
      console.error("[payout-accrual] accrual failed", sub.id, e);
    }
  }

  // 3) Refresh partner rollups authoritatively for every touched partner.
  for (const partnerId of touchedPartners) {
    try {
      await refreshPartnerRollups(partnerId);
      result.partnersRefreshed += 1;
    } catch (e) {
      console.error("[payout-accrual] rollup refresh failed", partnerId, e);
    }
  }

  return result;
}

interface Conversion {
  bookingId: string;
  bookingValue: Prisma.Decimal | null;
}

/**
 * A submission is "converted" when its Referral reached BOOKING_CONFIRMED (with
 * convertedBookingId) OR its captured Lead links to a CONFIRMED/COMPLETED
 * Booking. Null-guards missing refs (plain-ref orphan tolerance).
 */
async function detectConversion(
  referralId: string | null,
  leadId: string | null,
): Promise<Conversion | null> {
  // Path A: engine-tracked referral conversion.
  if (referralId) {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { status: true, convertedBookingId: true, bookingValue: true },
    });
    if (
      referral?.convertedBookingId &&
      (referral.status === "BOOKING_CONFIRMED" || referral.status === "CONVERTED")
    ) {
      return {
        bookingId: referral.convertedBookingId,
        bookingValue: referral.bookingValue,
      };
    }
  }

  // Path B: lead → booking. There is no direct Lead↔Booking FK, so the lead's
  // contact is the bridge: find a confirmed booking for that contact created
  // at/after the lead (best-effort linkage; null-guarded).
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { contactId: true, createdAt: true },
    });
    if (lead?.contactId) {
      const booking = await prisma.booking.findFirst({
        where: {
          contactId: lead.contactId,
          status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
          createdAt: { gte: lead.createdAt },
        },
        select: { id: true, totalAmount: true },
        orderBy: { createdAt: "asc" },
      });
      if (booking) {
        return { bookingId: booking.id, bookingValue: booking.totalAmount };
      }
    }
  }

  return null;
}

/**
 * Authoritative recompute of a partner's denormalised dashboard rollups.
 */
async function refreshPartnerRollups(partnerId: string): Promise<void> {
  const [submittedCount, convertedCount, earnedAgg, paidAgg] = await Promise.all([
    prisma.referralPortalSubmission.count({ where: { partnerId } }),
    prisma.referralPortalSubmission.count({
      where: { partnerId, convertedBookingId: { not: null } },
    }),
    prisma.referralPayout.aggregate({
      where: { partnerId, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    }),
    prisma.referralPayout.aggregate({
      where: { partnerId, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  await prisma.referralPartner.update({
    where: { id: partnerId },
    data: {
      submittedCount,
      convertedCount,
      totalEarned: earnedAgg._sum.amount ?? new Prisma.Decimal(0),
      totalPaid: paidAgg._sum.amount ?? new Prisma.Decimal(0),
    },
  });
}
