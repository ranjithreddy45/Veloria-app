"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import {
  emailTrackingFilterSchema,
  type TrackingStats,
  type ContactEngagement,
  type TrackingEventRow,
  type TopEngagedContact,
  type CampaignStats,
  type EmailTrackingFilterInput,
} from "@/schemas/email-tracking.schema";

// ============================================================
// Get Overall Tracking Stats
// ============================================================

export async function getTrackingStats(params?: EmailTrackingFilterInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Parse & validate filters
    const filters = params
      ? emailTrackingFilterSchema.parse(params)
      : undefined;

    // Build date filter for events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventWhere: any = {};
    if (filters?.dateRange?.from || filters?.dateRange?.to) {
      eventWhere.occurredAt = {};
      if (filters.dateRange.from) {
        eventWhere.occurredAt.gte = new Date(filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        eventWhere.occurredAt.lte = new Date(filters.dateRange.to);
      }
    }
    if (filters?.type) {
      eventWhere.type = filters.type;
    }

    // Build pixel filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pixelWhere: any = {};
    if (filters?.contactId) {
      pixelWhere.contactId = filters.contactId;
    }
    if (filters?.campaignId) {
      pixelWhere.campaignId = filters.campaignId;
    }

    // Total tracked emails
    const totalTracked = await prisma.emailTrackingPixel.count({
      where: pixelWhere,
    });

    // Total events
    const allEvents = await prisma.emailTrackingEvent.findMany({
      where: {
        ...eventWhere,
        pixel: pixelWhere,
      },
      select: {
        type: true,
        pixelId: true,
      },
    });

    const totalOpens = allEvents.filter((e) => e.type === "EMAIL_OPEN").length;
    const totalClicks = allEvents.filter(
      (e) => e.type === "LINK_CLICK"
    ).length;

    const uniqueOpenPixels = new Set(
      allEvents.filter((e) => e.type === "EMAIL_OPEN").map((e) => e.pixelId)
    );
    const uniqueClickPixels = new Set(
      allEvents.filter((e) => e.type === "LINK_CLICK").map((e) => e.pixelId)
    );

    const stats: TrackingStats = {
      totalTracked,
      totalOpens,
      totalClicks,
      uniqueOpens: uniqueOpenPixels.size,
      uniqueClicks: uniqueClickPixels.size,
      openRate: totalTracked > 0 ? (uniqueOpenPixels.size / totalTracked) * 100 : 0,
      clickRate: totalTracked > 0 ? (uniqueClickPixels.size / totalTracked) * 100 : 0,
    };

    return { success: true as const, data: serialize(stats) };
  } catch (error) {
    console.error("[GET_TRACKING_STATS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch tracking stats",
    };
  }
}

// ============================================================
// Get Tracking for a Specific Communication
// ============================================================

export async function getTrackingForCommunication(communicationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const pixel = await prisma.emailTrackingPixel.findUnique({
      where: { communicationId },
      include: {
        events: {
          orderBy: { occurredAt: "desc" },
        },
      },
    });

    if (!pixel) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(pixel) };
  } catch (error) {
    console.error("[GET_TRACKING_FOR_COMMUNICATION_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch tracking data",
    };
  }
}

// ============================================================
// Get Contact Engagement Stats
// ============================================================

export async function getContactEngagement(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get contact info
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Get all pixels for this contact
    const pixels = await prisma.emailTrackingPixel.findMany({
      where: { contactId },
      include: {
        events: {
          orderBy: { occurredAt: "desc" },
        },
      },
    });

    const emailsSent = pixels.length;
    const allEvents = pixels.flatMap((p) => p.events);
    const openEvents = allEvents.filter((e) => e.type === "EMAIL_OPEN");
    const clickEvents = allEvents.filter((e) => e.type === "LINK_CLICK");

    const uniqueOpenPixels = new Set(openEvents.map((e) => e.pixelId));
    const uniqueClickPixels = new Set(clickEvents.map((e) => e.pixelId));

    const lastOpen =
      openEvents.length > 0 ? openEvents[0].occurredAt.toISOString() : null;
    const lastClick =
      clickEvents.length > 0 ? clickEvents[0].occurredAt.toISOString() : null;

    const engagement: ContactEngagement = {
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      contactEmail: contact.email || "",
      emailsSent,
      opened: uniqueOpenPixels.size,
      clicked: uniqueClickPixels.size,
      openRate:
        emailsSent > 0 ? (uniqueOpenPixels.size / emailsSent) * 100 : 0,
      lastOpen,
      lastClick,
    };

    return { success: true as const, data: serialize(engagement) };
  } catch (error) {
    console.error("[GET_CONTACT_ENGAGEMENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch contact engagement",
    };
  }
}

// ============================================================
// Get Tracking Events (Paginated)
// ============================================================

export async function getTrackingEvents(params?: EmailTrackingFilterInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const filters = params
      ? emailTrackingFilterSchema.parse(params)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.dateRange?.from || filters?.dateRange?.to) {
      where.occurredAt = {};
      if (filters.dateRange.from) {
        where.occurredAt.gte = new Date(filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        where.occurredAt.lte = new Date(filters.dateRange.to);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pixelWhere: any = {};
    if (filters?.contactId) {
      pixelWhere.contactId = filters.contactId;
    }
    if (filters?.campaignId) {
      pixelWhere.campaignId = filters.campaignId;
    }

    if (Object.keys(pixelWhere).length > 0) {
      where.pixel = pixelWhere;
    }

    const events = await prisma.emailTrackingEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        pixel: {
          include: {
            communication: {
              select: {
                id: true,
                subject: true,
                contactId: true,
              },
            },
          },
        },
      },
    });

    const rows: TrackingEventRow[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      recipientEmail: event.pixel.recipientEmail,
      subject: event.pixel.communication.subject,
      linkUrl: event.linkUrl,
      ipAddress: event.ipAddress,
      occurredAt: event.occurredAt.toISOString(),
      communicationId: event.pixel.communicationId,
      contactId: event.pixel.communication.contactId,
    }));

    return { success: true as const, data: serialize(rows) };
  } catch (error) {
    console.error("[GET_TRACKING_EVENTS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch tracking events",
    };
  }
}

// ============================================================
// Get Top Engaged Contacts
// ============================================================

export async function getTopEngagedContacts(limit: number = 10) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get all pixels with their events, grouped by contact
    const pixels = await prisma.emailTrackingPixel.findMany({
      where: {
        contactId: { not: null },
      },
      include: {
        events: {
          select: {
            type: true,
            occurredAt: true,
          },
        },
      },
    });

    // Group by contactId
    const contactMap = new Map<
      string,
      { opens: number; clicks: number; lastEngagement: Date | null }
    >();

    for (const pixel of pixels) {
      const cid = pixel.contactId!;
      const existing = contactMap.get(cid) || {
        opens: 0,
        clicks: 0,
        lastEngagement: null,
      };

      for (const event of pixel.events) {
        if (event.type === "EMAIL_OPEN") existing.opens++;
        if (event.type === "LINK_CLICK") existing.clicks++;

        if (
          !existing.lastEngagement ||
          event.occurredAt > existing.lastEngagement
        ) {
          existing.lastEngagement = event.occurredAt;
        }
      }

      contactMap.set(cid, existing);
    }

    // Sort by engagement score (opens + clicks * 2)
    const sorted = Array.from(contactMap.entries())
      .map(([contactId, data]) => ({
        contactId,
        totalOpens: data.opens,
        totalClicks: data.clicks,
        engagementScore: data.opens + data.clicks * 2,
        lastEngagement: data.lastEngagement?.toISOString() || null,
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    // Fetch contact details
    const contactIds = sorted.map((s) => s.contactId);
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const contactLookup = new Map(contacts.map((c) => [c.id, c]));

    const result: TopEngagedContact[] = sorted.map((item) => {
      const contact = contactLookup.get(item.contactId);
      return {
        contactId: item.contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : "Unknown",
        contactEmail: contact?.email || "",
        totalOpens: item.totalOpens,
        totalClicks: item.totalClicks,
        engagementScore: item.engagementScore,
        lastEngagement: item.lastEngagement,
      };
    });

    return { success: true as const, data: serialize(result) };
  } catch (error) {
    console.error("[GET_TOP_ENGAGED_CONTACTS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch top engaged contacts",
    };
  }
}

// ============================================================
// Get Campaign Stats
// ============================================================

export async function getCampaignStats(campaignId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "campaigns:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const pixels = await prisma.emailTrackingPixel.findMany({
      where: { campaignId },
      include: {
        events: {
          select: {
            type: true,
            pixelId: true,
          },
        },
      },
    });

    const totalSent = pixels.length;
    const allEvents = pixels.flatMap((p) => p.events);
    const openEvents = allEvents.filter((e) => e.type === "EMAIL_OPEN");
    const clickEvents = allEvents.filter((e) => e.type === "LINK_CLICK");

    const uniqueOpenPixels = new Set(openEvents.map((e) => e.pixelId));
    const uniqueClickPixels = new Set(clickEvents.map((e) => e.pixelId));

    const stats: CampaignStats = {
      campaignId,
      totalSent,
      totalOpens: openEvents.length,
      totalClicks: clickEvents.length,
      uniqueOpens: uniqueOpenPixels.size,
      uniqueClicks: uniqueClickPixels.size,
      openRate:
        totalSent > 0 ? (uniqueOpenPixels.size / totalSent) * 100 : 0,
      clickRate:
        totalSent > 0 ? (uniqueClickPixels.size / totalSent) * 100 : 0,
    };

    return { success: true as const, data: serialize(stats) };
  } catch (error) {
    console.error("[GET_CAMPAIGN_STATS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch campaign stats",
    };
  }
}
