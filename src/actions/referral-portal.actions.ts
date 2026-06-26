"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  generateUniquePartnerCode,
  buildPartnerLink,
} from "@/lib/referral-portal/partner-code";
import {
  createReferralPartnerSchema,
  updateReferralPartnerSchema,
  type CreateReferralPartnerInput,
  type UpdateReferralPartnerInput,
} from "@/schemas/referral-portal.schema";

// ============================================================
// Referral Portal — INTERNAL (auth + RBAC gated) actions
// ------------------------------------------------------------
// Partner CRUD + dashboard reads. The payout ledger lifecycle lives in
// referral-payout.actions.ts; the 5-star flywheel in referral-flywheel.actions.ts.
// ============================================================

// ---------------------------------------------------------------------------
// Create a partner — generates a unique code + public /refer/<code> link.
// ---------------------------------------------------------------------------
export async function createReferralPartner(data: CreateReferralPartnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createReferralPartnerSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const d = parsed.data;

    let code = "";
    let partner;
    for (let attempt = 0; attempt < 4; attempt++) {
      code = await generateUniquePartnerCode();
      try {
        partner = await prisma.referralPartner.create({
          data: {
            code,
            type: d.type,
            name: d.name,
            email: d.email || null,
            phone: d.phone || null,
            contactId: d.contactId || null,
            userId: d.userId || null,
            vendorId: d.vendorId || null,
            issuedFromReviewId: d.issuedFromReviewId || null,
            payoutType: d.payoutType,
            payoutValue: new Prisma.Decimal(d.payoutValue),
            payoutPercent: new Prisma.Decimal(d.payoutPercent),
          },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue; // code collision — retry with a fresh code
        }
        throw error;
      }
    }

    if (!partner) {
      return { success: false as const, error: "Could not allocate a unique code" };
    }

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "ReferralPartner",
      entityId: partner.id,
      changes: { name: d.name, type: d.type, code, payoutType: d.payoutType },
    });

    revalidatePath("/referrals/partners");
    return {
      success: true as const,
      data: { ...serialize(partner), link: buildPartnerLink(partner.code) },
    };
  } catch (error) {
    console.error("[CREATE_REFERRAL_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to create referral partner" };
  }
}

// ---------------------------------------------------------------------------
// Update a partner (name/type/contact/payout config/active).
// ---------------------------------------------------------------------------
export async function updateReferralPartner(
  id: string,
  data: UpdateReferralPartnerInput,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateReferralPartnerSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const existing = await prisma.referralPartner.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Partner not found" };
    }
    const u = parsed.data;

    const partner = await prisma.referralPartner.update({
      where: { id },
      data: {
        ...(u.name !== undefined && { name: u.name }),
        ...(u.type !== undefined && { type: u.type }),
        ...(u.email !== undefined && { email: u.email || null }),
        ...(u.phone !== undefined && { phone: u.phone || null }),
        ...(u.payoutType !== undefined && { payoutType: u.payoutType }),
        ...(u.payoutValue !== undefined && {
          payoutValue: new Prisma.Decimal(u.payoutValue),
        }),
        ...(u.payoutPercent !== undefined && {
          payoutPercent: new Prisma.Decimal(u.payoutPercent),
        }),
        ...(u.isActive !== undefined && { isActive: u.isActive }),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "ReferralPartner",
      entityId: id,
      changes: u as Record<string, unknown>,
    });

    revalidatePath("/referrals/partners");
    revalidatePath(`/referrals/partners/${id}`);
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[UPDATE_REFERRAL_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to update referral partner" };
  }
}

// ---------------------------------------------------------------------------
// List partners with optional type/active filter.
// ---------------------------------------------------------------------------
export async function getReferralPartners(params?: {
  type?: string;
  isActive?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const where: Prisma.ReferralPartnerWhereInput = {};
    const VALID_TYPES = ["PLANNER", "DECORATOR", "VENDOR", "GUEST", "EMPLOYEE"];
    if (params?.type && VALID_TYPES.includes(params.type)) {
      where.type = params.type as (typeof VALID_TYPES)[number] as never;
    }
    if (typeof params?.isActive === "boolean") where.isActive = params.isActive;

    const partners = await prisma.referralPartner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { _count: { select: { submissions: true, payouts: true } } },
    });

    return {
      success: true as const,
      data: partners.map((p) => ({
        ...serialize(p),
        link: buildPartnerLink(p.code),
      })),
    };
  } catch (error) {
    console.error("[GET_REFERRAL_PARTNERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral partners" };
  }
}

// ---------------------------------------------------------------------------
// Partner detail — submissions + payouts.
// ---------------------------------------------------------------------------
export async function getReferralPartnerById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const partner = await prisma.referralPartner.findUnique({
      where: { id },
      include: {
        submissions: { orderBy: { createdAt: "desc" }, take: 200 },
        payouts: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });
    if (!partner) {
      return { success: false as const, error: "Partner not found" };
    }

    return {
      success: true as const,
      data: { ...serialize(partner), link: buildPartnerLink(partner.code) },
    };
  } catch (error) {
    console.error("[GET_REFERRAL_PARTNER_BY_ID_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral partner" };
  }
}

// ---------------------------------------------------------------------------
// Portal rollup stats for the dashboard header.
// ---------------------------------------------------------------------------
export async function getReferralPortalStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [
      totalPartners,
      activePartners,
      submissionsAgg,
      convertedSubs,
      earnedAgg,
      paidAgg,
      pendingPayouts,
    ] = await Promise.all([
      prisma.referralPartner.count(),
      prisma.referralPartner.count({ where: { isActive: true } }),
      prisma.referralPortalSubmission.count(),
      prisma.referralPortalSubmission.count({
        where: { convertedBookingId: { not: null } },
      }),
      prisma.referralPayout.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { amount: true },
      }),
      prisma.referralPayout.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.referralPayout.aggregate({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalSubmissions = submissionsAgg;
    const conversionRate =
      totalSubmissions > 0
        ? Math.round((convertedSubs / totalSubmissions) * 1000) / 10
        : 0;

    return {
      success: true as const,
      data: {
        totalPartners,
        activePartners,
        totalSubmissions,
        convertedSubmissions: convertedSubs,
        conversionRate,
        totalEarned: Number(earnedAgg._sum.amount ?? 0),
        totalPaid: Number(paidAgg._sum.amount ?? 0),
        pendingPayoutCount: pendingPayouts._count,
        pendingPayoutValue: Number(pendingPayouts._sum.amount ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_REFERRAL_PORTAL_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch portal stats" };
  }
}
