// ============================================================
// Notification Helper — Fire-and-forget notification creation
// ============================================================
// Never breaks main flow. Wraps createNotification for convenience.

import { createNotification } from "@/actions/notification.actions";
import type { NotificationType } from "@prisma/client";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Fire-and-forget notification. Errors are swallowed and logged.
 */
export function notify(params: NotifyParams): void {
  createNotification({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
  }).catch((err) => {
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
