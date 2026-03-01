"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  campaignSchema,
  scheduleCampaignSchema,
  type CampaignInput,
} from "@/schemas/campaign.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Campaigns (Filtered by Status)
// ============================================================

export async function getCampaigns(params?: {
  status?: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(campaigns) };
  } catch (error) {
    console.error("[GET_CAMPAIGNS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch campaigns" };
  }
}

// ============================================================
// Get Single Campaign
// ============================================================

export async function getCampaignById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return { success: false as const, error: "Campaign not found" };
    }

    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[GET_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to fetch campaign" };
  }
}

// ============================================================
// Create Campaign (DRAFT)
// ============================================================

export async function createCampaign(data: CampaignInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = campaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const campaignData = parsed.data;

    const campaign = await prisma.campaign.create({
      data: {
        name: campaignData.name,
        subject: campaignData.subject,
        htmlContent: campaignData.htmlContent,
        recipientFilter: campaignData.recipientFilter ?? undefined,
        scheduledAt: campaignData.scheduledAt
          ? new Date(campaignData.scheduledAt)
          : null,
        status: "DRAFT",
        createdById: session.user.id as string,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Campaign",
      entityId: campaign.id,
    });

    revalidatePath("/campaigns");
    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[CREATE_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to create campaign" };
  }
}

// ============================================================
// Update Campaign (only if DRAFT)
// ============================================================

export async function updateCampaign(id: string, data: CampaignInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = campaignSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only DRAFT campaigns can be edited",
      };
    }

    const campaignData = parsed.data;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: campaignData.name,
        subject: campaignData.subject,
        htmlContent: campaignData.htmlContent,
        recipientFilter: campaignData.recipientFilter ?? undefined,
        scheduledAt: campaignData.scheduledAt
          ? new Date(campaignData.scheduledAt)
          : null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Campaign",
      entityId: campaign.id,
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[UPDATE_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to update campaign" };
  }
}

// ============================================================
// Delete Campaign (only if DRAFT)
// ============================================================

export async function deleteCampaign(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only DRAFT campaigns can be deleted",
      };
    }

    await prisma.campaign.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Campaign",
      entityId: id,
    });

    revalidatePath("/campaigns");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to delete campaign" };
  }
}

// ============================================================
// Schedule Campaign
// ============================================================

export async function scheduleCampaign(id: string, scheduledAt: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scheduleCampaignSchema.safeParse({ scheduledAt });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only DRAFT campaigns can be scheduled",
      };
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledAt: new Date(parsed.data.scheduledAt),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Campaign",
      entityId: campaign.id,
      changes: { from: "DRAFT", to: "SCHEDULED" },
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[SCHEDULE_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to schedule campaign" };
  }
}

// ============================================================
// Send Campaign (mock: count contacts matching filter)
// ============================================================

export async function sendCampaign(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
      return {
        success: false as const,
        error: "Only DRAFT or SCHEDULED campaigns can be sent",
      };
    }

    // Set to SENDING first
    await prisma.campaign.update({
      where: { id },
      data: { status: "SENDING" },
    });

    // Mock: count contacts matching filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter = existing.recipientFilter as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactWhere: any = {};

    if (filter?.contactType) {
      contactWhere.type = filter.contactType;
    }

    const totalContacts = await prisma.contact.count({ where: contactWhere });
    const totalSent = totalContacts > 0 ? totalContacts : 1; // At minimum 1 for mock

    // Set to SENT with stats
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        totalSent,
        totalOpened: Math.floor(totalSent * 0.45), // mock 45% open rate
        totalClicked: Math.floor(totalSent * 0.12), // mock 12% click rate
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Campaign",
      entityId: campaign.id,
      changes: { from: existing.status, to: "SENT", totalSent },
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[SEND_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to send campaign" };
  }
}

// ============================================================
// Cancel Campaign
// ============================================================

export async function cancelCampaign(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Campaign not found" };
    }

    if (existing.status === "SENT" || existing.status === "CANCELLED") {
      return {
        success: false as const,
        error: `Cannot cancel a campaign that is already ${existing.status}`,
      };
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Campaign",
      entityId: campaign.id,
      changes: { from: existing.status, to: "CANCELLED" },
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { success: true as const, data: serialize(campaign) };
  } catch (error) {
    console.error("[CANCEL_CAMPAIGN_ERROR]", error);
    return { success: false as const, error: "Failed to cancel campaign" };
  }
}

// ============================================================
// Get Campaign Stats (aggregate)
// ============================================================

export async function getCampaignStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "campaigns:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [totalCampaigns, statusCounts, aggregates] = await Promise.all([
      prisma.campaign.count(),
      prisma.campaign.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.campaign.aggregate({
        _sum: {
          totalSent: true,
          totalOpened: true,
          totalClicked: true,
        },
      }),
    ]);

    const statusMap = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.id])
    );

    return {
      success: true as const,
      data: serialize({
        totalCampaigns,
        draft: statusMap.DRAFT ?? 0,
        scheduled: statusMap.SCHEDULED ?? 0,
        sent: statusMap.SENT ?? 0,
        cancelled: statusMap.CANCELLED ?? 0,
        totalSent: aggregates._sum.totalSent ?? 0,
        totalOpened: aggregates._sum.totalOpened ?? 0,
        totalClicked: aggregates._sum.totalClicked ?? 0,
      }),
    };
  } catch (error) {
    console.error("[GET_CAMPAIGN_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch campaign stats" };
  }
}
