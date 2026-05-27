"use client";

import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import {
  CalendarCheck,
  Clock,
  ArrowUpRight,
  MapPin,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_COLORS } from "@/lib/constants";
import type { UpcomingEvent } from "@/actions/dashboard.actions";
import type { Serialized } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface UpcomingEventsProps {
  events: Serialized<UpcomingEvent>[];
}

// ============================================================
// Status label map
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  HOLD: "Hold",
  TENTATIVE: "Tentative",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// ============================================================
// Time Slot display
// ============================================================

const TIME_SLOT_SHORT: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  FULL_DAY: "Full Day",
};

// ============================================================
// Upcoming Events Component
// ============================================================

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Upcoming Events
          </CardTitle>
          <p className="text-xs text-muted-foreground">Next 7 days</p>
        </div>
        <Link
          href="/bookings"
          className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          View all
          <ArrowUpRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
            <CalendarCheck className="mb-2 size-8" />
            <p className="text-sm font-medium">No upcoming events</p>
            <p className="text-xs">Events in the next 7 days will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => {
              const daysRemaining = differenceInDays(
                new Date(event.date),
                new Date()
              );
              return (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-accent/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20 transition-transform duration-200 group-hover:scale-105">
                    <CalendarCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium leading-tight text-foreground">
                      {event.eventName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span>
                        {format(new Date(event.date), "MMM d, yyyy")} &middot;{" "}
                        {TIME_SLOT_SHORT[event.timeSlot] || event.timeSlot}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {event.venue.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {event.contact.firstName} {event.contact.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        BOOKING_STATUS_COLORS[event.status]
                      )}
                    >
                      {STATUS_LABELS[event.status] || event.status}
                    </Badge>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        daysRemaining <= 0
                          ? "text-red-600 dark:text-red-400"
                          : daysRemaining <= 2
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground/60"
                      )}
                    >
                      {daysRemaining <= 0
                        ? "Today"
                        : daysRemaining === 1
                          ? "Tomorrow"
                          : `${daysRemaining} days`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
