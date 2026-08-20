"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell,
  CheckCheck,
  CalendarCheck,
  CreditCard,
  FileText,
  CheckSquare,
  UserPlus,
  Trophy,
  XCircle,
  Info,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type NotificationItem,
} from "@/actions/notification.actions";
import type { NotificationType } from "@prisma/client";

// ============================================================
// Notification icon map
// ============================================================

const NOTIFICATION_ICONS: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string }
> = {
  BOOKING_CREATED: {
    icon: CalendarCheck,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  BOOKING_UPDATED: {
    icon: CalendarCheck,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  BOOKING_CANCELLED: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  PAYMENT_RECEIVED: {
    icon: CreditCard,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  PAYMENT_OVERDUE: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  INVOICE_SENT: {
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  TASK_ASSIGNED: {
    icon: CheckSquare,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  TASK_OVERDUE: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  LEAD_ASSIGNED: {
    icon: UserPlus,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  DEAL_WON: {
    icon: Trophy,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  DEAL_LOST: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  SYSTEM: {
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-zinc-100",
  },
  TASK_ESCALATED: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  ESCALATION_ACKNOWLEDGED: {
    icon: CheckSquare,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  REFERRAL_CONVERTED: {
    icon: Trophy,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  REFERRAL_REWARD_APPROVED: {
    icon: CreditCard,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  PERFORMANCE_BADGE_EARNED: {
    icon: Trophy,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  SLA_WARNING: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  EXECUTION_TASK_BLOCKED: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  INVITATION_SENT: {
    icon: Bell,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  RSVP_RECEIVED: {
    icon: CheckSquare,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  REMINDER_FAILED: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  VENDOR_WORK_ORDER_SENT: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  VENDOR_CONFIRMATION_REMINDER: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  ADVANCE_PAYMENT_RELEASED: { icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" },
  VENDOR_SLA_BREACH: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  SERVICES_NOT_LOCKED: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  PROPERTY_CHECKLIST_DUE: { icon: CheckSquare, color: "text-purple-600", bg: "bg-purple-50" },
  REVIEW_POINTS_VERIFIED: { icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
  REVIEW_POINTS_PAYOUT_DUE: { icon: CreditCard, color: "text-green-600", bg: "bg-green-50" },
};

// ============================================================
// Safe text rendering
// ============================================================

// Defensive coercion for notification text fields. Content is already rendered
// as React text children (auto-escaped — no dangerouslySetInnerHTML anywhere),
// so DOM XSS is not possible. This guards the residual cases: non-string values
// slipping through the RPC type, control characters, and unbounded length that
// could break layout or be abused for spoofing.
function safeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  // Strip ASCII control chars (except tab/newline) that could affect rendering.
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}…`
    : cleaned;
}

// ============================================================
// Types
// ============================================================

interface NotificationListProps {
  initialNotifications: NotificationItem[];
  userId: string;
  total: number;
}

type FilterTab = "all" | "unread";

// ============================================================
// NotificationList Component
// ============================================================

export function NotificationList({
  initialNotifications,
  userId,
  total,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [isPending, startTransition] = useTransition();

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark single as read/unread toggle
  const handleToggleRead = useCallback(
    (notificationId: string) => {
      startTransition(async () => {
        // Snapshot for rollback, then apply optimistic update.
        const snapshot = notifications;
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        try {
          await markAsRead(notificationId);
        } catch (err) {
          // Server rejected (e.g. Unauthorized / Not found) — revert UI.
          setNotifications(snapshot);
          toast.error(
            err instanceof Error
              ? err.message
              : "Could not mark notification as read"
          );
        }
      });
    },
    [notifications]
  );

  // Mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    startTransition(async () => {
      const snapshot = notifications;
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      try {
        await markAllAsRead(userId);
      } catch (err) {
        setNotifications(snapshot);
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not mark all notifications as read"
        );
      }
    });
  }, [userId, notifications]);

  // Delete notification
  const handleDelete = useCallback(
    (notificationId: string) => {
      startTransition(async () => {
        const snapshot = notifications;
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
        try {
          await deleteNotification(notificationId);
        } catch (err) {
          setNotifications(snapshot);
          toast.error(
            err instanceof Error
              ? err.message
              : "Could not delete notification"
          );
        }
      });
    },
    [notifications]
  );

  return (
    <div className="space-y-4">
      {/* Filters and actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === "unread"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleMarkAllAsRead}
            disabled={isPending}
          >
            <CheckCheck className="mr-1.5 size-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notification cards */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="mb-3 size-10" />
            <p className="text-sm font-medium">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
            <p className="mt-1 text-xs">
              {filter === "unread"
                ? "You're all caught up!"
                : "Notifications will appear here when there's activity"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => {
            const iconConfig =
              NOTIFICATION_ICONS[notification.type] ||
              NOTIFICATION_ICONS.SYSTEM;
            const Icon = iconConfig.icon;

            return (
              <Card
                key={notification.id}
                className={cn(
                  "border-zinc-200/80 shadow-sm transition-all duration-200",
                  !notification.isRead && "border-l-2 border-l-indigo-500 bg-indigo-50/30"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        iconConfig.bg
                      )}
                    >
                      <Icon className={cn("size-4", iconConfig.color)} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              notification.isRead
                                ? "text-foreground/80"
                                : "font-semibold text-foreground"
                            )}
                          >
                            {safeText(notification.title, 200)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {safeText(notification.message, 500)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="mt-1 size-2.5 shrink-0 rounded-full bg-indigo-600" />
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            { addSuffix: true }
                          )}
                        </span>
                        <span className="text-xs text-zinc-300">&middot;</span>
                        <span className="text-xs text-muted-foreground">
                          {format(
                            new Date(notification.createdAt),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center gap-2">
                        {notification.actionUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            asChild
                          >
                            <Link href={notification.actionUrl}>
                              View details
                            </Link>
                          </Button>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleToggleRead(notification.id)}
                            disabled={isPending}
                          >
                            <Eye className="mr-1 size-3" />
                            Mark as read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(notification.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="mr-1 size-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
