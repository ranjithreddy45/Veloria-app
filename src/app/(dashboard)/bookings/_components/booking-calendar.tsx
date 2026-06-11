"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBookingsForCalendar, getBlackoutDates } from "@/actions/booking.actions";
import { DayDetailPanel } from "./day-detail-panel";

// ============================================================
// Types
// ============================================================

interface CalendarBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  status: string;
  date: Date | string;
  timeSlot: string;
  guestCount: number;
  venue: { id: string; name: string };
}

interface BlackoutDateEntry {
  id: string;
  date: Date | string;
  timeSlot: string | null;
  reason: string | null;
  venue: { id: string; name: string };
}

interface BookingCalendarProps {
  initialBookings: CalendarBooking[];
  initialBlackouts: BlackoutDateEntry[];
  initialMonth: number;
  initialYear: number;
}

// ============================================================
// Status Colors for Calendar Pills
// ============================================================

const STATUS_PILL_COLORS: Record<string, string> = {
  HOLD: "bg-amber-100 text-amber-800 border-amber-200",
  TENTATIVE: "bg-purple-100 text-purple-800 border-purple-200",
  CONFIRMED: "bg-green-100 text-green-800 border-green-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-red-50 text-red-400 border-red-100 line-through",
};

// ============================================================
// Day Names
// ============================================================

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ============================================================
// BookingCalendar Component
// ============================================================

export function BookingCalendar({
  initialBookings,
  initialBlackouts,
  initialMonth,
  initialYear,
}: BookingCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = React.useState(
    new Date(initialYear, initialMonth - 1, 1)
  );
  const [bookings, setBookings] = React.useState<CalendarBooking[]>(initialBookings);
  const [blackouts, setBlackouts] = React.useState<BlackoutDateEntry[]>(initialBlackouts);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start of the month to align with day of week
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startDayOfWeek - i));
    return d;
  });

  // Pad the end to fill the last week
  const endDayOfWeek = getDay(monthEnd);
  const trailingDays = Array.from({ length: 6 - endDayOfWeek }, (_, i) => {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + (i + 1));
    return d;
  });

  const allDays = [...paddingDays, ...daysInMonth, ...trailingDays];

  // Navigate months
  async function navigateMonth(direction: "prev" | "next") {
    setIsLoading(true);
    const newDate =
      direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    setCurrentDate(newDate);

    const month = newDate.getMonth() + 1;
    const year = newDate.getFullYear();

    try {
      const [bookingsResult, blackoutsResult] = await Promise.all([
        getBookingsForCalendar(month, year),
        getBlackoutDates({ month, year }),
      ]);

      if (bookingsResult.success) {
        setBookings(bookingsResult.data);
      }
      if (blackoutsResult.success) {
        setBlackouts(blackoutsResult.data as BlackoutDateEntry[]);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }

  // Get bookings for a specific day
  function getBookingsForDay(day: Date): CalendarBooking[] {
    return bookings.filter((b) => isSameDay(new Date(b.date), day));
  }

  // Check if day has blackouts
  function getBlackoutsForDay(day: Date): BlackoutDateEntry[] {
    return blackouts.filter((b) => isSameDay(new Date(b.date), day));
  }

  // Handle day click
  function handleDayClick(day: Date) {
    if (isSameMonth(day, currentDate)) {
      setSelectedDay(day);
    }
  }

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth("prev")}
            disabled={isLoading}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[140px] text-center sm:min-w-[200px]">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth("next")}
            disabled={isLoading}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const today = new Date();
            setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
            const month = today.getMonth() + 1;
            const year = today.getFullYear();
            setIsLoading(true);
            Promise.all([
              getBookingsForCalendar(month, year),
              getBlackoutDates({ month, year }),
            ]).then(([bResult, blResult]) => {
              if (bResult.success) setBookings(bResult.data);
              if (blResult.success) setBlackouts(blResult.data as BlackoutDateEntry[]);
              setIsLoading(false);
            });
          }}
        >
          Today
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className={cn("rounded-lg border bg-card", isLoading && "opacity-60 pointer-events-none")}>
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-xs font-medium text-zinc-500 uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7">
          {allDays.map((day, i) => {
            const dayBookings = getBookingsForDay(day);
            const dayBlackouts = getBlackoutsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const hasBlackouts = dayBlackouts.length > 0;

            return (
              <div
                key={i}
                className={cn(
                  "relative min-h-[110px] border-b border-r p-1.5 cursor-pointer transition-colors",
                  !isCurrentMonth && "bg-zinc-50/50",
                  isCurrentMonth && "hover:bg-zinc-50",
                  isSelected && "bg-indigo-50 ring-1 ring-inset ring-indigo-200",
                  hasBlackouts && isCurrentMonth && "bg-red-50/40",
                  // Remove right border for last column
                  (i + 1) % 7 === 0 && "border-r-0",
                )}
                onClick={() => handleDayClick(day)}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center text-sm",
                      !isCurrentMonth && "text-zinc-300",
                      isCurrentMonth && "text-zinc-700",
                      isTodayDate &&
                        "bg-indigo-600 text-white rounded-full size-7 font-semibold",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {hasBlackouts && isCurrentMonth && (
                    <span className="text-[10px] text-red-500 font-medium">
                      Blocked
                    </span>
                  )}
                </div>

                {/* Booking Pills */}
                {isCurrentMonth && (
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-medium border",
                          STATUS_PILL_COLORS[booking.status] || "bg-muted text-muted-foreground",
                        )}
                        title={`${booking.eventName} (${booking.venue.name})`}
                      >
                        {booking.eventName}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-[10px] text-zinc-400 font-medium pl-1">
                        +{dayBookings.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      <DayDetailPanel
        selectedDay={selectedDay}
        bookings={selectedDay ? getBookingsForDay(selectedDay) : []}
        blackouts={selectedDay ? getBlackoutsForDay(selectedDay) : []}
        onClose={() => setSelectedDay(null)}
        onBookSlot={(timeSlot) => {
          if (selectedDay) {
            const dateStr = format(selectedDay, "yyyy-MM-dd");
            router.push(`/bookings/new?date=${dateStr}&timeSlot=${timeSlot}`);
          }
        }}
      />
    </div>
  );
}
