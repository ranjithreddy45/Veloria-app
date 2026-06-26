import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import {
  generateUniquePartnerCode,
  buildPartnerLink,
} from "@/lib/referral-portal/partner-code";

// ============================================================
// Review → Referral flywheel — core helper (NOT "use server")
// ------------------------------------------------------------
// Mirrors lib/reputation/review-request.ts. The daily cron idempotently issues
// a personal GUEST ReferralPartner code to delighted customers and WhatsApps
// them their /refer/<code> link:
//   (a) ReviewRequest rows ROUTED_PUBLIC with gateRating >= 4 whose booking
//       contact lacks a flywheel-issued partner, and
//   (b) Review rows rating = 5, isApproved = true, referralCodeIssued = false.
//
// One-shot dedupe: a partner is issued at most once per contact (issuedFromReviewId
// / contactId guard) and Review.referralCodeIssued is flipped ONLY AFTER the
// durable ReferralPartner row commits — a mid-batch freeze re-issues cleanly
// rather than marking issued-but-never-sent. Best-effort, never throws,
// batched take(500).
// ============================================================

export interface FlywheelResult {
  issued: number;
  sent: number;
  failedSend: number;
  skippedExisting: number;
  skippedNoContact: number;
}

const BATCH = 500;

// Default GUEST-partner payout config when no rule overrides it. POINTS keeps
// the referrer in the loyalty loop without committing cash up front; staff can
// edit the partner to FLAT/PERCENT later.
const DEFAULT_GUEST_PAYOUT = {
  payoutType: "POINTS" as const,
  payoutValue: new Prisma.Decimal(500), // 500 loyalty points per converted referral
  payoutPercent: new Prisma.Decimal(0),
};

export function buildReferralPortalLink(code: string): string {
  return buildPartnerLink(code);
}

// ---------------------------------------------------------------------------
// Issue a single GUEST partner code for a contact, idempotently. Returns the
// existing partner if the contact already has a flywheel-issued one. The
// ReferralPartner.code @unique is guarded by retrying on P2002.
// ---------------------------------------------------------------------------
async function issuePartnerForContact(args: {
  contactId: string;
  reviewId?: string | null;
  customerName: string;
}): Promise<{ partnerId: string; code: string; created: boolean } | null> {
  // Already issued for this contact (any flywheel source)?
  const existing = await prisma.referralPartner.findFirst({
    where: { type: "GUEST", contactId: args.contactId },
    select: { id: true, code: true },
  });
  if (existing) {
    return { partnerId: existing.id, code: existing.code, created: false };
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = await generateUniquePartnerCode();
    try {
      const partner = await prisma.referralPartner.create({
        data: {
          code,
          type: "GUEST",
          name: args.customerName || "Veloria Guest",
          contactId: args.contactId,
          issuedFromReviewId: args.reviewId || null,
          payoutType: DEFAULT_GUEST_PAYOUT.payoutType,
          payoutValue: DEFAULT_GUEST_PAYOUT.payoutValue,
          payoutPercent: DEFAULT_GUEST_PAYOUT.payoutPercent,
          isActive: true,
        },
        select: { id: true, code: true },
      });
      return { partnerId: partner.id, code: partner.code, created: true };
    } catch (error) {
      // P2002 = code collision (generateUniquePartnerCode race) → retry.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      console.error("[referral-flywheel] partner create failed", error);
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Send the personal referral-invite WhatsApp. Best-effort; logs WhatsAppMessage.
// ---------------------------------------------------------------------------
async function sendReferralInvite(args: {
  contactId: string;
  phone: string | null;
  customerName: string;
  code: string;
}): Promise<boolean> {
  const phone = args.phone?.trim();
  if (!phone) return false;

  const referralLink = buildReferralPortalLink(args.code);
  const textFallback =
    `Hi ${args.customerName || "there"}, thank you for the kind words about your event at ` +
    `Veloria Grand! As a thank-you, here's your personal referral link — share it with ` +
    `friends planning a celebration and you'll both be rewarded: ${referralLink}`;

  let result: { success: boolean; messageId?: string; error?: string };
  try {
    result = await sendWhatsApp({
      to: phone,
      template: "referral_invite",
      message: textFallback,
      params: { customerName: args.customerName || "there", referralLink },
    });
    if (!result.success) {
      result = await sendWhatsApp({ to: phone, message: textFallback });
    }
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "WhatsApp send threw",
    };
  }

  await prisma.whatsAppMessage
    .create({
      data: {
        direction: "OUTBOUND",
        content: `[Referral invite] ${textFallback}`,
        templateName: "referral_invite",
        status: result.success ? "SENT" : "FAILED",
        whatsappId: result.success ? result.messageId || null : undefined,
        failureReason: result.success ? undefined : result.error || "WhatsApp send failed",
        contactId: args.contactId,
      },
    })
    .catch(() => undefined);

  return result.success;
}

// ---------------------------------------------------------------------------
// Cron worker. Scans both 5-star trigger sources and issues + sends codes.
// ---------------------------------------------------------------------------
export async function issueReferralCodeForFiveStarReviews(): Promise<FlywheelResult> {
  const result: FlywheelResult = {
    issued: 0,
    sent: 0,
    failedSend: 0,
    skippedExisting: 0,
    skippedNoContact: 0,
  };

  // --- Source (a): ROUTED_PUBLIC ReviewRequests with gateRating >= 4 ----------
  const happyRequests = await prisma.reviewRequest.findMany({
    where: { status: "ROUTED_PUBLIC", gateRating: { gte: 4 } },
    select: {
      contactId: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { ratedAt: "desc" },
    take: BATCH,
  });

  for (const req of happyRequests) {
    if (!req.contactId) {
      result.skippedNoContact += 1;
      continue;
    }
    const customerName = `${req.contact.firstName} ${req.contact.lastName ?? ""}`.trim();
    const partner = await issuePartnerForContact({
      contactId: req.contactId,
      customerName,
    });
    if (!partner) continue;
    if (!partner.created) {
      result.skippedExisting += 1;
      continue;
    }
    result.issued += 1;
    const ok = await sendReferralInvite({
      contactId: req.contactId,
      phone: req.contact.phone,
      customerName,
      code: partner.code,
    });
    if (ok) result.sent += 1;
    else result.failedSend += 1;
  }

  // --- Source (b): approved 5-star Reviews not yet issued ---------------------
  const fiveStar = await prisma.review.findMany({
    where: { rating: 5, isApproved: true, referralCodeIssued: false },
    select: {
      id: true,
      contactId: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: BATCH,
  });

  for (const review of fiveStar) {
    if (!review.contactId) {
      result.skippedNoContact += 1;
      continue;
    }
    const customerName = `${review.contact.firstName} ${review.contact.lastName ?? ""}`.trim();
    const partner = await issuePartnerForContact({
      contactId: review.contactId,
      reviewId: review.id,
      customerName,
    });
    if (!partner) continue;

    // Flip the one-shot dedupe flag ONLY after the durable partner row exists.
    await prisma.review
      .update({ where: { id: review.id }, data: { referralCodeIssued: true } })
      .catch(() => undefined);

    if (!partner.created) {
      result.skippedExisting += 1;
      continue;
    }
    result.issued += 1;
    const ok = await sendReferralInvite({
      contactId: review.contactId,
      phone: review.contact.phone,
      customerName,
      code: partner.code,
    });
    if (ok) result.sent += 1;
    else result.failedSend += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// On-demand single-review issuance (staff "issue code" button). Returns the
// issued/existing code. Best-effort send.
// ---------------------------------------------------------------------------
export async function issueReferralCodeForReview(
  reviewId: string,
): Promise<
  | { ok: true; code: string; created: boolean; sent: boolean }
  | { ok: false; error: string }
> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      contactId: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
  });
  if (!review) return { ok: false, error: "Review not found" };
  if (!review.contactId) return { ok: false, error: "Review has no contact" };

  const customerName = `${review.contact.firstName} ${review.contact.lastName ?? ""}`.trim();
  const partner = await issuePartnerForContact({
    contactId: review.contactId,
    reviewId: review.id,
    customerName,
  });
  if (!partner) return { ok: false, error: "Could not issue partner code" };

  await prisma.review
    .update({ where: { id: review.id }, data: { referralCodeIssued: true } })
    .catch(() => undefined);

  const sent = await sendReferralInvite({
    contactId: review.contactId,
    phone: review.contact.phone,
    customerName,
    code: partner.code,
  });

  return { ok: true, code: partner.code, created: partner.created, sent };
}
