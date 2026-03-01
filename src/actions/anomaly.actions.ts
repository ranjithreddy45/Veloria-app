"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ============================================================
// Types
// ============================================================

export type AnomalyFilters = {
  isActive?: boolean;
  type?: string;
  severity?: string;
};

export type AnomalyStats = {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  bySeverity: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  byType: Record<string, number>;
};

// ============================================================
// Get Anomalies
// ============================================================

export async function getAnomalies(params?: AnomalyFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.severity) {
      where.severity = params.severity;
    }

    const anomalies = await prisma.anomalyAlert.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      include: {
        acknowledgedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { success: true as const, data: serialize(anomalies) };
  } catch (error) {
    console.error("[GET_ANOMALIES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch anomalies" };
  }
}

// ============================================================
// Get Anomaly Stats
// ============================================================

export async function getAnomalyStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [total, active, acknowledged, resolved] = await Promise.all([
      prisma.anomalyAlert.count(),
      prisma.anomalyAlert.count({ where: { isActive: true, acknowledgedAt: null } }),
      prisma.anomalyAlert.count({
        where: { acknowledgedAt: { not: null }, resolvedAt: null },
      }),
      prisma.anomalyAlert.count({ where: { resolvedAt: { not: null } } }),
    ]);

    // Count by severity
    const severityCounts = await prisma.anomalyAlert.groupBy({
      by: ["severity"],
      _count: { severity: true },
    });

    const bySeverity = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const entry of severityCounts) {
      const key = entry.severity as keyof typeof bySeverity;
      if (key in bySeverity) {
        bySeverity[key] = entry._count.severity;
      }
    }

    // Count by type
    const typeCounts = await prisma.anomalyAlert.groupBy({
      by: ["type"],
      _count: { type: true },
    });

    const byType: Record<string, number> = {};
    for (const entry of typeCounts) {
      byType[entry.type] = entry._count.type;
    }

    const stats: AnomalyStats = {
      total,
      active,
      acknowledged,
      resolved,
      bySeverity,
      byType,
    };

    return { success: true as const, data: stats };
  } catch (error) {
    console.error("[GET_ANOMALY_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch anomaly stats" };
  }
}

// ============================================================
// Acknowledge Anomaly
// ============================================================

export async function acknowledgeAnomaly(alertId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "ai:use")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const alert = await prisma.anomalyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return { success: false as const, error: "Alert not found" };
    }

    if (alert.acknowledgedAt) {
      return { success: false as const, error: "Alert already acknowledged" };
    }

    const updated = await prisma.anomalyAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: session.user.id,
      },
      include: {
        acknowledgedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    revalidatePath("/analytics/anomalies");
    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[ACKNOWLEDGE_ANOMALY_ERROR]", error);
    return { success: false as const, error: "Failed to acknowledge anomaly" };
  }
}

// ============================================================
// Resolve Anomaly
// ============================================================

export async function resolveAnomaly(alertId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "ai:use")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const alert = await prisma.anomalyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return { success: false as const, error: "Alert not found" };
    }

    if (alert.resolvedAt) {
      return { success: false as const, error: "Alert already resolved" };
    }

    const updated = await prisma.anomalyAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        isActive: false,
      },
      include: {
        acknowledgedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    revalidatePath("/analytics/anomalies");
    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[RESOLVE_ANOMALY_ERROR]", error);
    return { success: false as const, error: "Failed to resolve anomaly" };
  }
}

// ============================================================
// Get Active High/Critical Count (for indicator)
// ============================================================

export async function getActiveHighCriticalCount() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const count = await prisma.anomalyAlert.count({
      where: {
        isActive: true,
        severity: { in: ["HIGH", "CRITICAL"] },
      },
    });

    return { success: true as const, data: count };
  } catch (error) {
    console.error("[GET_ACTIVE_HIGH_CRITICAL_COUNT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch count" };
  }
}
