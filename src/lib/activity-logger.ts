import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ============================================================
// Activity Logger
// ============================================================
// Fire-and-forget logging utility. Errors are caught internally
// so activity logging never breaks the main flow.

interface LogActivityParams {
  userId: string;
  action: string; // "created" | "updated" | "deleted" | "status_changed"
  entityType: string; // "Contact" | "Lead" | "Booking" | "Invoice" | "Payment"
  entityId: string;
  changes?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: (params.changes as Prisma.InputJsonValue) ?? undefined,
        userId: params.userId,
      },
    });
  } catch (error) {
    // Log but never throw — activity logging must not break operations
    console.error("[ACTIVITY_LOG_ERROR]", error);
  }
}
