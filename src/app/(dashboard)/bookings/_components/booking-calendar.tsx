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
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getBookingsForCalendar,
  getBlackoutDates,
  getLeadsForCalendar,
} from "@/actions/booking.actions";
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

interface CalendarLead {
  id: string;
  title: string;
  status: string;
  eventType: string | null;
  eventDate: Date | string | null;
  slot: string | null;
  guestCount: number | null;
  contact: { firstName: string | null; lastName: string | null; company: string | null } | null;
  preferredVenue: { id: string; name: string } | null;
}

interface BlackoutDateEntry {
  id: string;
  date: Date | string;
  timeSlot: string | null;
  reason: string | null;
  venue: { id: string; name: string };
}

interface VenueOption {
  id: string;
  name: string;
}

interface BookingCalendarProps {
  initialBookings: CalendarBooking[];
  initialLeads: CalendarLead[];
  initialBlackouts: BlackoutDateEntry[];
  venues: VenueOption[];
  initialMonth: number;
  initialYear: number;
}

type ViewMode = "all" | "bookings" | "leads";

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function leadName(l: CalendarLead): string {
  const n = [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ").trim();
  return n || l.contact?.company || l.title || "Enquiry";
}

// ============================================================
// BookingCalendar Component
// ============================================================

export function BookingCalendar({
  initialBookings,
  initialLeads,
  initialBlackouts,
  venues,
  initialMonth,
  initialYear,
}: BookingCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = React.useState(
    new Date(initialYear, initialMonth - 1, 1)
  );
  const [bookings, setBookings] = React.useState<CalendarBooking[]>(initialBookings);
  const [leads, setLeads] = React.useState<CalendarLead[]>(initialLeads);
  const [blackouts, setBlackouts] = React.useState<BlackoutDateEntry[]>(initialBlackouts);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>("all");
  const [venueId, setVenueId] = React.useState<string>("");

  const showBookings = view !== "leads";
  const showLeads = view !== "bookings";

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startDayOfWeek - i));
    return d;
  });
  const endDayOfWeek = getDay(monthEnd);
  const trailingDays = Array.from({ length: 6 - endDayOfWeek }, (_, i) => {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + (i + 1));
    return d;
  });
  const allDays = [...paddingDays, ...daysInMonth, ...trailingDays];

  // Load all three datasets for a given month + venue scope.
  const loadData = React.useCallback(async (date: Date, venue: string) => {
    setIsLoading(true);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const v = venue || undefined;
    try {
      const [bRes, lRes, blRes] = await Promise.all([
        getBookingsForCalendar(month, year, v),
        getLeadsForCalendar(month, year, v),
        getBlackoutDates({ month, year }),
      ]);
      if (bRes.success) setBookings(bRes.data as CalendarBooking[]);
      if (lRes.success) setLeads(lRes.data as CalendarLead[]);
      if (blRes.success) setBlackouts(blRes.data as BlackoutDateEntry[]);
    } catch {
      // keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  function navigateMonth(direction: "prev" | "next") {
    const newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    setCurrentDate(newDate);
    void loadData(newDate, venueId);
  }

  function goToday() {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    setCurrentDate(first);
    void loadData(first, venueId);
  }

  function onVenueChange(v: string) {
    setVenueId(v);
    void loadData(currentDate, v);
  }

  function getBookingsForDay(day: Date): CalendarBooking[] {
    return bookings.filter((b) => isSameDay(new Date(b.date), day));
  }
  function getLeadsForDay(day: Date): CalendarLead[] {
    return leads.filter((l) => l.eventDate && isSameDay(new Date(l.eventDate), day));
  }
  function getBlackoutsForDay(day: Date): BlackoutDateEntry[] {
    return blackouts.filter((b) => isSameDay(new Date(b.date), day));
  }

  function handleDayClick(day: Date) {
    if (isSameMonth(day, currentDate)) setSelectedDay(day);
  }

  const venueLabel = venueId ? venues.find((v) => v.id === venueId)?.name : "All venues";

  return (
    <div className="space-y-4">
      {/* Toolbar: month nav + view toggle + venue filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-card">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")} disabled={isLoading}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="min-w-[140px] text-center text-[17px] font-semibold tracking-[-0.01em] tabular-nums sm:min-w-[180px]">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")} disabled={isLoading}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} disabled={isLoading}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[13px]">
            {([
              { k: "all", label: "Both" },
              { k: "bookings", label: "Bookings" },
              { k: "leads", label: "Leads" },
            ] as const).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setView(opt.k)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  view === opt.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Venue filter */}
          <select
            value={venueId}
            onChange={(e) => onVenueChange(e.target.value)}
            disabled={isLoading}
            className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by venue"
          >
            <option value="">All venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-green-200 bg-green-100" /> Booked (confirmed event)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-dashed border-sky-300 bg-sky-50" /> Lead (enquiry, not booked)
        </span>
        {venueId && <span className="font-medium text-foreground/70">· Showing: {venueLabel}</span>}
      </div>

      {/* Calendar Grid */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card shadow-card",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {allDays.map((day, i) => {
            const dayBookings = showBookings ? getBookingsForDay(day) : [];
            const dayLeads = showLeads ? getLeadsForDay(day) : [];
            const dayBlackouts = getBlackoutsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const hasBlackouts = dayBlackouts.length > 0;

            // Combine pills (bookings first, then leads), cap at 3.
            const pills: React.ReactNode[] = [];
            for (const b of dayBookings) {
              pills.push(
                <div
                  key={`b-${b.id}`}
                  className={cn(
                    "truncate rounded-md border px-1.5 py-[3px] text-[11.5px] font-medium leading-tight",
                    STATUS_PILL_COLORS[b.status] || "bg-muted text-muted-foreground"
                  )}
                  title={`Booking: ${b.eventName} (${b.venue.name})`}
                >
                  {b.eventName}
                </div>
              );
            }
            for (const l of dayLeads) {
              pills.push(
                <div
                  key={`l-${l.id}`}
                  className="truncate rounded-md border border-dashed border-sky-300 bg-sky-50 px-1.5 py-[3px] text-[11.5px] font-medium leading-tight text-sky-700"
                  title={`Lead: ${leadName(l)}${l.preferredVenue ? ` (${l.preferredVenue.name})` : ""}`}
                >
                  ◦ {leadName(l)}
                </div>
              );
            }
            const hiddenCount = pills.length - 3;

            return (
              <div
                key={i}
                className={cn(
                  "relative min-h-[124px] cursor-pointer border-b border-r p-2 transition-colors",
                  !isCurrentMonth && "bg-muted/30",
                  isCurrentMonth && "hover:bg-accent/40",
                  isSelected && "bg-indigo-50 ring-1 ring-inset ring-indigo-200",
                  hasBlackouts && isCurrentMonth && "bg-red-50/40",
                  (i + 1) % 7 === 0 && "border-r-0"
                )}
                onClick={() => handleDayClick(day)}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center text-[13px] tabular-nums",
                      !isCurrentMonth && "text-muted-foreground/40",
                      isCurrentMonth && "font-medium text-foreground",
                      isTodayDate &&
                        "rounded-full bg-indigo-600 font-semibold text-white"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {hasBlackouts && isCurrentMonth && (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-red-500">
                      Blocked
                    </span>
                  )}
                </div>

                {isCurrentMonth && (
                  <div className="space-y-1">
                    {pills.slice(0, 3)}
                    {hiddenCount > 0 && (
                      <div className="pl-1 text-[10.5px] font-medium text-muted-foreground">
                        +{hiddenCount} more
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
        leads={selectedDay ? getLeadsForDay(selectedDay) : []}
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
