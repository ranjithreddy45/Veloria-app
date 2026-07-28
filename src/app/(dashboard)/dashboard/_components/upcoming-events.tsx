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
import { EmptyState } from "@/components/ui/empty-state";
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
    <Card className="card-hover-tint rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming events
          </CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">Next 7 days</p>
        </div>
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:underline"
        >
          View all
          <ArrowUpRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="Nothing on the calendar"
            description="Confirmed bookings in the next 7 days will show up here."
            className="py-12"
            action={
              <Link
                href="/bookings/new"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <CalendarCheck className="size-3.5" strokeWidth={2} />
                New booking
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => {
              const daysRemaining = differenceInDays(
                new Date(event.date),
                new Date()
              );
              return (
                <div
                  key={event.id}
                  className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors first:pt-2 last:pb-2 hover:bg-muted/40"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <CalendarCheck className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium leading-tight text-foreground">
                      {event.eventName}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span>
                        {format(new Date(event.date), "MMM d")} · {TIME_SLOT_SHORT[event.timeSlot] || event.timeSlot}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11.5px] text-muted-foreground/80">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {event.venue.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {event.contact.firstName} {event.contact.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-border px-1.5 py-0 text-[10.5px] font-medium",
                        BOOKING_STATUS_COLORS[event.status]
                      )}
                    >
                      {STATUS_LABELS[event.status] || event.status}
                    </Badge>
                    <span
                      className={cn(
                        "numeric text-[10.5px] font-medium",
                        daysRemaining <= 0
                          ? "text-destructive"
                          : daysRemaining <= 2
                            ? "text-warning"
                            : "text-muted-foreground"
                      )}
                    >
                      {daysRemaining <= 0
                        ? "Today"
                        : daysRemaining === 1
                          ? "Tomorrow"
                          : `${daysRemaining}d`}
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
