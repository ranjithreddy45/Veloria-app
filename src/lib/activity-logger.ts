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

let systemUserId: string | null = null;

/**
 * The user an automated action is written under. Eleven call sites pass the
 * literal "system", which is not a User id: every one of those rows failed the
 * foreign key and the action was never recorded (38 times in two days). They
 * now land under the first active admin, the same account captures and crons
 * already use. Memoised; a missing admin logs nothing rather than crashing.
 */
async function actorId(userId: string | null | undefined): Promise<string | null> {
  if (userId && userId !== "system") return userId;
  if (!systemUserId) {
    const admin = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    systemUserId = admin?.id ?? null;
  }
  return systemUserId;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const userId = await actorId(params.userId);
    if (!userId) return;
    await prisma.activityLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: (params.changes as Prisma.InputJsonValue) ?? undefined,
        userId,
      },
    });
  } catch (error) {
    // Log but never throw — activity logging must not break operations
    console.error("[ACTIVITY_LOG_ERROR]", error);
  }
}
