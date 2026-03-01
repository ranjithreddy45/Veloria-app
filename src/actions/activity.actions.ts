"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";

// ============================================================
// Activity Log Types
// ============================================================

export type ActivityLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

// ============================================================
// Get Activity Logs (Paginated with Filters)
// ============================================================

export async function getActivityLogs(params?: {
  entityType?: string;
  userId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 30;
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.userId) where.userId = params.userId;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return serialize({
      success: true as const,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[GET_ACTIVITY_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch activity logs" };
  }
}

// ============================================================
// Get Team Users (for filter dropdown)
// ============================================================

export async function getTeamUsers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const users = await prisma.user.findMany({
      where: { role: { not: "CLIENT" } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: users };
  } catch (error) {
    console.error("[GET_TEAM_USERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch users" };
  }
}
