"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

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

    // Validate & bound pagination so untrusted page/limit can't be abused.
    const page = Math.max(1, Math.floor(Number(params?.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params?.limit) || 30)));
    const skip = (page - 1) * limit;

    const role = session.user.role as string;
    const selfId = session.user.id as string;
    // Only privileged roles (people-admins) may filter the feed by an arbitrary
    // user's id. A non-privileged employee can only query their own activity —
    // this prevents enumerating another specific user's full action history
    // (personal-data IDOR). The broad unfiltered team feed itself stays
    // staff-wide by design.
    const canQueryAnyUser = hasPermission(role, "users:read");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.userId) {
      if (!canQueryAnyUser && params.userId !== selfId) {
        return { success: false as const, error: "Forbidden" };
      }
      where.userId = params.userId;
    }

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
    return {
      success: false as const,
      code: "FETCH_FAILED" as const,
      error:
        "Couldn't load activity right now. This is usually temporary — please retry in a moment.",
    };
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
