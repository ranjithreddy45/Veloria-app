"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { triggerSyncSchema } from "@/schemas/accounting.schema";
import { syncInvoice, syncPayment, syncPayout } from "@/lib/integrations/tally";
import type { AccountingSyncStatus } from "@prisma/client";

// ============================================================
// Get Sync Logs (Filtered + Ordered)
// ============================================================

export async function getSyncLogs(filters?: {
  type?: string;
  status?: AccountingSyncStatus;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const [logs, total] = await Promise.all([
      prisma.accountingSyncLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.accountingSyncLog.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(logs),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_SYNC_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch sync logs" };
  }
}

// ============================================================
// Get Sync Stats
// ============================================================

export async function getSyncStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const [pending, synced, failed] = await Promise.all([
      prisma.accountingSyncLog.count({ where: { status: "PENDING" } }),
      prisma.accountingSyncLog.count({ where: { status: "SYNCED" } }),
      prisma.accountingSyncLog.count({ where: { status: "FAILED" } }),
    ]);

    return {
      success: true as const,
      data: { pending, synced, failed },
    };
  } catch (error) {
    console.error("[GET_SYNC_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch sync stats" };
  }
}

// ============================================================
// Trigger Sync
// ============================================================

export async function triggerSync(data: { type: string; entityId: string }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "accounting:sync")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = triggerSyncSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { type, entityId } = parsed.data;

    let log;
    switch (type) {
      case "INVOICE":
        log = await syncInvoice(entityId);
        break;
      case "PAYMENT":
        log = await syncPayment(entityId);
        break;
      case "PAYOUT":
        log = await syncPayout(entityId);
        break;
      default:
        return { success: false as const, error: "Unknown sync type" };
    }

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "AccountingSyncLog",
      entityId: log.id,
      changes: { type, entityId },
    });

    revalidatePath("/settings/integrations/tally");
    return { success: true as const, data: serialize(log) };
  } catch (error) {
    console.error("[TRIGGER_SYNC_ERROR]", error);
    return { success: false as const, error: "Failed to trigger sync" };
  }
}

// ============================================================
// Retry Failed Sync
// ============================================================

export async function retryFailedSync(logId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "accounting:sync")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.accountingSyncLog.findUnique({
      where: { id: logId },
    });

    if (!existing) {
      return { success: false as const, error: "Sync log not found" };
    }

    if (existing.status !== "FAILED") {
      return { success: false as const, error: "Only failed syncs can be retried" };
    }

    // HONEST no-op: the Tally export is not wired to a provider yet, so a "retry"
    // cannot actually sync. Never fabricate a SYNCED status + fake TALLY-RETRY ref —
    // that misleads staff into believing the invoice reached the accounting system.
    return {
      success: false as const,
      error: "Tally integration isn't connected yet — nothing was synced. Connect Tally in Settings → Integrations before retrying.",
    };
  } catch (error) {
    console.error("[RETRY_FAILED_SYNC_ERROR]", error);
    return { success: false as const, error: "Failed to retry sync" };
  }
}

// ============================================================
// Clear Old Sync Logs (older than 30 days)
// ============================================================

export async function clearSyncLogs() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "accounting:sync")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.accountingSyncLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "AccountingSyncLog",
      entityId: "bulk",
      changes: { deletedCount: result.count, olderThan: thirtyDaysAgo.toISOString() },
    });

    revalidatePath("/settings/integrations/tally");
    return { success: true as const, data: { deletedCount: result.count } };
  } catch (error) {
    console.error("[CLEAR_SYNC_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to clear sync logs" };
  }
}
