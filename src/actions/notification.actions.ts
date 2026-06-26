"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import type { NotificationType } from "@prisma/client";

// ============================================================
// Types
// ============================================================

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  metadata: unknown;
  createdAt: Date;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  total: number;
  hasMore: boolean;
};

// ============================================================
// getNotifications
// ============================================================

export async function getNotifications(
  userId: string,
  params?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<NotificationsResponse> {
  // IDOR guard: only ever return the SIGNED-IN user's notifications, never an
  // arbitrary caller-supplied userId.
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return { notifications: [], total: 0, hasMore: false };
  }
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  const where = {
    userId: session.user.id,
    ...(params?.unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    hasMore: offset + limit < total,
  };
}

// ============================================================
// getUnreadCount
// ============================================================

export async function getUnreadCount(userId: string): Promise<number> {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) return 0;
  return prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

// ============================================================
// markAsRead
// ============================================================

export async function markAsRead(notificationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership before marking as read
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });
  if (!notification || notification.userId !== session.user.id) {
    throw new Error("Not found");
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

// ============================================================
// markAllAsRead
// ============================================================

export async function markAllAsRead(userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) throw new Error("Unauthorized");

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

// ============================================================
// createNotification — intentionally NOT exported as a server action.
//
// All notification creation goes through the internal helpers in
// src/lib/notify.ts (notify / notifyAwait / notifyAdmins), which are invoked
// server-side from domain actions and crons. A public, RPC-reachable
// createNotification had zero callers and only widened attack surface
// (arbitrary client-supplied title/message/actionUrl → in-app phishing /
// spoofing). It was removed as dead wiring. If an admin-facing manual broadcast
// is ever needed, build it on top of notifyAdmins / notify with an explicit
// permission check rather than re-exporting a raw create.
// ============================================================

// ============================================================
// deleteNotification
// ============================================================

export async function deleteNotification(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!notification || notification.userId !== session.user.id) {
    throw new Error("Not found");
  }

  await prisma.notification.delete({
    where: { id },
  });
  revalidatePath("/notifications");
}
