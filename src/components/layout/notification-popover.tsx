"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
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
    bg: "bg-muted",
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
};

// ============================================================
// NotificationPopover Component
// ============================================================

export function NotificationPopover() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const userId = user?.id;

  // Fetch unread count with polling every 30 seconds
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count", userId],
    queryFn: () => (userId ? getUnreadCount(userId) : Promise.resolve(0)),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Fetch recent notifications when popover opens
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "recent", userId],
    queryFn: () =>
      userId
        ? getNotifications(userId, { limit: 8 })
        : Promise.resolve({ notifications: [], total: 0, hasMore: false }),
    enabled: !!userId && open,
    refetchInterval: open ? 30000 : false,
  });

  const notifications = notificationsData?.notifications ?? [];

  // Mark single as read
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markAsRead(notificationId);
        queryClient.invalidateQueries({
          queryKey: ["notifications"],
        });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        toast.error("Couldn't mark notification as read. Please try again.");
      }
    },
    [queryClient]
  );

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllAsRead(userId);
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast.error("Couldn't mark notifications as read. Please try again.");
    }
  }, [userId, queryClient]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-muted-foreground"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-0">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-1rem))] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 border-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="mr-1 size-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
              <Bell className="mb-2 size-8" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <Link
            href="/notifications"
            className="block text-center text-xs font-medium text-primary transition-colors hover:text-primary/80"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// NotificationRow
// ============================================================

function NotificationRow({
  notification,
  onMarkAsRead,
}: {
  notification: NotificationItem;
  onMarkAsRead: (id: string) => void;
}) {
  const iconConfig =
    NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
  const Icon = iconConfig.icon;

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
  };

  const content = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors cursor-pointer",
        notification.isRead
          ? "hover:bg-accent/50"
          : "bg-primary/5 hover:bg-primary/10"
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          iconConfig.bg
        )}
      >
        <Icon className={cn("size-3.5", iconConfig.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-tight",
              notification.isRead
                ? "text-muted-foreground"
                : "font-medium text-foreground"
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return content;
}
