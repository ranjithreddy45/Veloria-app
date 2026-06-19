"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  marketingCampaignSchema,
  campaignSpendSchema,
  type MarketingCampaignInput,
  type CampaignSpendInput,
} from "@/schemas/attribution.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Marketing Campaign CRUD (spend ledger for CAC / ROAS)
// ------------------------------------------------------------
// Distinct from the email-marketing Campaign model + /campaigns route +
// campaigns:* perms. This module owns MarketingCampaign, /marketing, and
// the marketing:* perms (reads: marketing:read, writes: marketing:manage).
// ============================================================

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ------------------------------------------------------------
// Reads (marketing:read)
// ------------------------------------------------------------

export async function getMarketingCampaigns(params?: {
  isActive?: boolean;
  channel?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const where: Prisma.MarketingCampaignWhereInput = {};
    if (typeof params?.isActive === "boolean") where.isActive = params.isActive;
    if (params?.channel) where.channel = params.channel;

    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { attributions: true } } },
    });

    return { success: true as const, data: serialize(campaigns) };
  } catch (error) {
    console.error("[GET_MARKETING_CAMPAIGNS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch campaigns" };
  }
}

export async function getMarketingCampaignById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      include: { _count: { select: { attributions: true } } },
    });
    if (!campaign) {
      return { success: false as const, error: "Campaign not found" };
    }

    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[GET_MARKETING_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to fetch campaign" };
  }
}

// ------------------------------------------------------------
// Writes (marketing:manage)
// ------------------------------------------------------------

export async function createMarketingCampaign(data: MarketingCampaignInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = marketingCampaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const v = parsed.data;

    const campaign = await prisma.marketingCampaign.create({
      data: {
        name: v.name,
        channel: v.channel,
        utmSource: v.utmSource || null,
        utmMedium: v.utmMedium || null,
        utmCampaign: v.utmCampaign || null,
        spendToDate: new Prisma.Decimal(v.spendToDate.toFixed(2)),
        currency: v.currency || "INR",
        startDate: toDateOrNull(v.startDate),
        endDate: toDateOrNull(v.endDate),
        isActive: v.isActive,
        notes: v.notes || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "MarketingCampaign",
      entityId: campaign.id,
      changes: { name: campaign.name, channel: campaign.channel },
    });

    revalidatePath("/marketing");
    revalidatePath("/marketing/campaigns");

    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[CREATE_MARKETING_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to create campaign" };
  }
}

export async function updateMarketingCampaign(
  id: string,
  data: MarketingCampaignInput
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    const parsed = marketingCampaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const v = parsed.data;

    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        name: v.name,
        channel: v.channel,
        utmSource: v.utmSource || null,
        utmMedium: v.utmMedium || null,
        utmCampaign: v.utmCampaign || null,
        spendToDate: new Prisma.Decimal(v.spendToDate.toFixed(2)),
        currency: v.currency || "INR",
        startDate: toDateOrNull(v.startDate),
        endDate: toDateOrNull(v.endDate),
        isActive: v.isActive,
        notes: v.notes || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "MarketingCampaign",
      entityId: campaign.id,
      changes: { name: campaign.name, channel: campaign.channel },
    });

    revalidatePath("/marketing");
    revalidatePath("/marketing/campaigns");

    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[UPDATE_MARKETING_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to update campaign" };
  }
}

export async function setCampaignSpend(id: string, data: CampaignSpendInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = campaignSpendSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        spendToDate: new Prisma.Decimal(parsed.data.spendToDate.toFixed(2)),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "MarketingCampaign",
      entityId: campaign.id,
      changes: { spendToDate: parsed.data.spendToDate },
    });

    revalidatePath("/marketing");
    revalidatePath("/marketing/campaigns");

    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[SET_CAMPAIGN_SPEND_ERROR]", error);
    return { success: false as const, error: "Failed to update spend" };
  }
}

export async function deleteMarketingCampaign(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    // Detach attributions first (campaignId is nullable) so deleting a
    // campaign never breaks the 1:1 LeadAttribution rows — the nightly
    // rollup will re-link survivors to another matching campaign if any.
    await prisma.leadAttribution.updateMany({
      where: { campaignId: id },
      data: { campaignId: null },
    });
    await prisma.marketingCampaign.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "MarketingCampaign",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/marketing");
    revalidatePath("/marketing/campaigns");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_MARKETING_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to delete campaign" };
  }
}
