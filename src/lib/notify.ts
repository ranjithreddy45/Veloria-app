// ============================================================
// Notification Helper — Fire-and-forget notification creation
// ============================================================
// Writes directly to DB via Prisma. Does NOT call revalidatePath
// so it is safe to use during SSR, inside cron jobs, webhooks,
// or any fire-and-forget context.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { NotificationType } from "@prisma/client";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget notification. Writes directly to DB (no revalidatePath).
 * Errors are swallowed and logged so this never breaks the main flow.
 */
export function notify(params: NotifyParams): void {
  prisma.notification
    .create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl || null,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    })
    .catch((err) => {
      console.error("[NOTIFY_ERROR]", err);
    });
}

/**
 * Awaitable notification — same write, but returns the promise so callers in a
 * serverless context (cron/webhook) can await it before the function freezes,
 * instead of risking the fire-and-forget write being dropped.
 */
export function notifyAwait(params: NotifyParams): Promise<void> {
  return prisma.notification
    .create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl || null,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    })
    .then(() => undefined)
    .catch((err) => {
      console.error("[NOTIFY_ERROR]", err);
    });
}

/**
 * Notify all admin/super_admin users (for system-wide events).
 * Requires a list of admin user IDs.
 */
export async function notifyAdmins(
  adminIds: string[],
  params: Omit<NotifyParams, "userId">
): Promise<void> {
  for (const userId of adminIds) {
    notify({ ...params, userId });
  }
}
