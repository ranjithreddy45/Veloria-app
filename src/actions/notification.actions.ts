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
// createNotification
// ============================================================

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<NotificationItem> {
  // Auth gate: this is exported from a "use server" file and is therefore a
  // reachable RPC. Without a guard any client could write an arbitrary
  // notification (attacker-controlled title/message/actionUrl) to any userId,
  // enabling in-app phishing and spoofing. Require an authenticated session and
  // only allow fanning out to OTHER users for privileged roles; everyone else
  // may only create notifications for themselves.
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const role = session.user.role as string | undefined;
  const canFanOut = role === "SUPER_ADMIN" || role === "ADMIN";
  if (data.userId !== session.user.id && !canFanOut) {
    throw new Error("Forbidden");
  }

  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl || null,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
  try {
    revalidatePath("/notifications");
  } catch {
    // revalidatePath throws during SSR render — safe to ignore here
  }
  return notification;
}

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
