"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Types
// ============================================================

export type TeamMemberPerformance = {
  userId: string;
  userName: string;
  role: string;
  bookingsWon: number;
  revenueGenerated: number;
  leadsConverted: number;
  avgDealSize: number;
  conversionRate: number;
};

export type VenuePerformanceData = {
  venueId: string;
  venueName: string;
  totalBookings: number;
  totalRevenue: number;
  avgBookingValue: number;
  utilizationRate: number;
  topEventType: string;
  averageRating: number;
};

export type LeaderboardEntry = {
  userId: string;
  userName: string;
  role: string;
  metricValue: number;
};

export type IndividualMetrics = {
  bookingsManaged: number;
  revenueGenerated: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  avgResponseTime: number;
  tasksCompleted: number;
  rating: number;
};

// ============================================================
// Helpers
// ============================================================

function buildDateFilter(startDate?: string, endDate?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ============================================================
// 1. Team Performance
// ============================================================

export async function getTeamPerformance(params?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const dateFilter = buildDateFilter(params?.startDate, params?.endDate);

    // Get all active internal users (not CLIENT / VENDOR)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { notIn: ["CLIENT", "VENDOR"] },
      },
      select: { id: true, name: true, role: true },
    });

    // Get leads with WON status grouped by assignedTo
    const wonLeads = await prisma.lead.findMany({
      where: {
        status: "WON",
        ...(dateFilter ? { updatedAt: dateFilter } : {}),
      },
      select: {
        assignedToId: true,
        estimatedValue: true,
      },
    });

    // Get all leads grouped by assignedTo for conversion calculation
    const allLeads = await prisma.lead.findMany({
      where: {
        assignedToId: { not: null },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        assignedToId: true,
        status: true,
      },
    });

    // Get bookings with invoices for revenue calculation
    const bookings = await prisma.booking.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        createdById: true,
        totalAmount: true,
      },
    });

    // Build a map per user
    const userMap = new Map<
      string,
      {
        bookingsWon: number;
        revenueGenerated: number;
        leadsConverted: number;
        totalLeads: number;
      }
    >();

    for (const u of users) {
      userMap.set(u.id, {
        bookingsWon: 0,
        revenueGenerated: 0,
        leadsConverted: 0,
        totalLeads: 0,
      });
    }

    // Count won leads and revenue from estimated values
    for (const lead of wonLeads) {
      if (lead.assignedToId && userMap.has(lead.assignedToId)) {
        const entry = userMap.get(lead.assignedToId)!;
        entry.leadsConverted += 1;
        entry.revenueGenerated += Number(lead.estimatedValue ?? 0);
      }
    }

    // Count total leads per user for conversion rate
    for (const lead of allLeads) {
      if (lead.assignedToId && userMap.has(lead.assignedToId)) {
        const entry = userMap.get(lead.assignedToId)!;
        entry.totalLeads += 1;
      }
    }

    // Count bookings
    for (const booking of bookings) {
      if (userMap.has(booking.createdById)) {
        const entry = userMap.get(booking.createdById)!;
        entry.bookingsWon += 1;
      }
    }

    const result: TeamMemberPerformance[] = users.map((u) => {
      const data = userMap.get(u.id)!;
      return {
        userId: u.id,
        userName: u.name ?? "Unknown",
        role: u.role,
        bookingsWon: data.bookingsWon,
        revenueGenerated: data.revenueGenerated,
        leadsConverted: data.leadsConverted,
        avgDealSize:
          data.leadsConverted > 0
            ? data.revenueGenerated / data.leadsConverted
            : 0,
        conversionRate:
          data.totalLeads > 0
            ? Math.round((data.leadsConverted / data.totalLeads) * 100)
            : 0,
      };
    });

    // Sort by revenue descending
    result.sort((a, b) => b.revenueGenerated - a.revenueGenerated);

    return serialize({ success: true as const, data: result });
  } catch (error) {
    console.error("[TEAM_PERFORMANCE_ERROR]", error);
    return { success: false as const, error: "Failed to load team performance" };
  }
}

// ============================================================
// 2. Venue Performance
// ============================================================

export async function getVenuePerformance(params?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const dateFilter = buildDateFilter(params?.startDate, params?.endDate);

    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        bookings: {
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            totalAmount: true,
            eventType: true,
            date: true,
            reviews: {
              select: { rating: true },
            },
          },
        },
      },
    });

    // Calculate the date range for utilization
    const now = new Date();
    const startDate = params?.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), 0, 1);
    const endDate = params?.endDate ? new Date(params.endDate) : now;
    const totalDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    // Each day can have up to 3 time slots (MORNING, AFTERNOON, EVENING)
    const totalSlots = totalDays * 3;

    const result: VenuePerformanceData[] = venues.map((venue) => {
      const totalBookings = venue.bookings.length;
      const totalRevenue = venue.bookings.reduce(
        (sum, b) => sum + Number(b.totalAmount),
        0
      );
      const avgBookingValue =
        totalBookings > 0 ? totalRevenue / totalBookings : 0;

      // Utilization: number of bookings / total possible slots
      const utilizationRate =
        totalSlots > 0
          ? Math.min(100, Math.round((totalBookings / totalSlots) * 100))
          : 0;

      // Top event type
      const eventTypeCounts = new Map<string, number>();
      for (const b of venue.bookings) {
        eventTypeCounts.set(
          b.eventType,
          (eventTypeCounts.get(b.eventType) ?? 0) + 1
        );
      }
      let topEventType = "N/A";
      let maxCount = 0;
      for (const [type, count] of eventTypeCounts) {
        if (count > maxCount) {
          topEventType = type;
          maxCount = count;
        }
      }

      // Average rating from reviews
      const allRatings = venue.bookings.flatMap((b) =>
        b.reviews.map((r) => r.rating)
      );
      const averageRating =
        allRatings.length > 0
          ? allRatings.reduce((s, r) => s + r, 0) / allRatings.length
          : 0;

      return {
        venueId: venue.id,
        venueName: venue.name,
        totalBookings,
        totalRevenue,
        avgBookingValue,
        utilizationRate,
        topEventType,
        averageRating,
      };
    });

    // Sort by revenue descending
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return serialize({ success: true as const, data: result });
  } catch (error) {
    console.error("[VENUE_PERFORMANCE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to load venue performance",
    };
  }
}

// ============================================================
// 3. Leaderboard
// ============================================================

export async function getLeaderboard(params?: {
  metric?: "revenue" | "bookings" | "leads";
  period?: "month" | "quarter" | "year";
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const metric = params?.metric ?? "revenue";
    const period = params?.period ?? "month";

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter": {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      }
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Get internal users
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { notIn: ["CLIENT", "VENDOR"] },
      },
      select: { id: true, name: true, role: true },
    });

    const userMetrics = new Map<string, number>();
    for (const u of users) {
      userMetrics.set(u.id, 0);
    }

    if (metric === "revenue") {
      // Sum estimated value of WON leads per assignee
      const wonLeads = await prisma.lead.findMany({
        where: {
          status: "WON",
          updatedAt: { gte: startDate, lte: now },
        },
        select: { assignedToId: true, estimatedValue: true },
      });
      for (const lead of wonLeads) {
        if (lead.assignedToId && userMetrics.has(lead.assignedToId)) {
          userMetrics.set(
            lead.assignedToId,
            (userMetrics.get(lead.assignedToId) ?? 0) +
              Number(lead.estimatedValue ?? 0)
          );
        }
      }
    } else if (metric === "bookings") {
      // Count bookings created by each user
      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: { gte: startDate, lte: now },
        },
        select: { createdById: true },
      });
      for (const b of bookings) {
        if (userMetrics.has(b.createdById)) {
          userMetrics.set(
            b.createdById,
            (userMetrics.get(b.createdById) ?? 0) + 1
          );
        }
      }
    } else {
      // leads: count of WON leads
      const wonLeads = await prisma.lead.findMany({
        where: {
          status: "WON",
          updatedAt: { gte: startDate, lte: now },
        },
        select: { assignedToId: true },
      });
      for (const lead of wonLeads) {
        if (lead.assignedToId && userMetrics.has(lead.assignedToId)) {
          userMetrics.set(
            lead.assignedToId,
            (userMetrics.get(lead.assignedToId) ?? 0) + 1
          );
        }
      }
    }

    // Build sorted leaderboard (top 10)
    const leaderboard: LeaderboardEntry[] = users
      .map((u) => ({
        userId: u.id,
        userName: u.name ?? "Unknown",
        role: u.role,
        metricValue: userMetrics.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.metricValue - a.metricValue)
      .slice(0, 10);

    return serialize({ success: true as const, data: leaderboard });
  } catch (error) {
    console.error("[LEADERBOARD_ERROR]", error);
    return { success: false as const, error: "Failed to load leaderboard" };
  }
}

// ============================================================
// 4. Individual Metrics
// ============================================================

export async function getIndividualMetrics(
  userId: string,
  params?: { startDate?: string; endDate?: string }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const dateFilter = buildDateFilter(params?.startDate, params?.endDate);

    // Bookings managed (created by this user)
    const bookings = await prisma.booking.findMany({
      where: {
        createdById: userId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { totalAmount: true },
    });
    const bookingsManaged = bookings.length;
    const revenueGenerated = bookings.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0
    );

    // Leads assigned and converted
    const leadsAssigned = await prisma.lead.count({
      where: {
        assignedToId: userId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    const leadsConverted = await prisma.lead.count({
      where: {
        assignedToId: userId,
        status: "WON",
        ...(dateFilter ? { updatedAt: dateFilter } : {}),
      },
    });

    const conversionRate =
      leadsAssigned > 0 ? Math.round((leadsConverted / leadsAssigned) * 100) : 0;

    // Tasks completed
    const tasksCompleted = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: "DONE",
        ...(dateFilter ? { completedAt: dateFilter } : {}),
      },
    });

    // Average response time: time between lead creation and first status change
    // Approximated by average time from creation to updatedAt for leads that have been actioned
    const actionedLeads = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        status: { not: "NEW" },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { createdAt: true, updatedAt: true },
    });

    let avgResponseTime = 0;
    if (actionedLeads.length > 0) {
      const totalHours = actionedLeads.reduce((sum, lead) => {
        const diff =
          new Date(lead.updatedAt).getTime() -
          new Date(lead.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60); // Convert to hours
      }, 0);
      avgResponseTime = Math.round(totalHours / actionedLeads.length);
    }

    // Rating: average review rating for bookings created by this user
    const reviews = await prisma.review.findMany({
      where: {
        booking: {
          createdById: userId,
        },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { rating: true },
    });
    const rating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    const data: IndividualMetrics = {
      bookingsManaged,
      revenueGenerated,
      leadsAssigned,
      leadsConverted,
      conversionRate,
      avgResponseTime,
      tasksCompleted,
      rating,
    };

    return serialize({ success: true as const, data });
  } catch (error) {
    console.error("[INDIVIDUAL_METRICS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to load individual metrics",
    };
  }
}

// ============================================================
// 5. Get Team Members (for selection dropdown)
// ============================================================

export async function getTeamMembers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { notIn: ["CLIENT", "VENDOR"] },
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    return serialize({ success: true as const, data: users });
  } catch (error) {
    console.error("[TEAM_MEMBERS_ERROR]", error);
    return { success: false as const, error: "Failed to load team members" };
  }
}
