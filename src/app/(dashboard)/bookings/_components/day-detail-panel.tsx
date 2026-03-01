"use client";

import { format } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
  MapPinIcon,
  AlertTriangleIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { BOOKING_STATUS_COLORS, TIME_SLOT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

interface DayDetailPanelProps {
  selectedDay: Date | null;
  bookings: CalendarBooking[];
  blackouts: BlackoutDateEntry[];
  onClose: () => void;
  onBookSlot: (timeSlot: string) => void;
}

// ============================================================
// Time Slots for Display
// ============================================================

const DISPLAY_SLOTS = [
  { key: "MORNING", label: "Morning", time: "8:00 AM - 12:00 PM" },
  { key: "AFTERNOON", label: "Afternoon", time: "12:00 PM - 5:00 PM" },
  { key: "EVENING", label: "Evening", time: "5:00 PM - 11:00 PM" },
];

// ============================================================
// DayDetailPanel Component
// ============================================================

export function DayDetailPanel({
  selectedDay,
  bookings,
  blackouts,
  onClose,
  onBookSlot,
}: DayDetailPanelProps) {
  const isOpen = selectedDay !== null;

  // Check if a specific slot is booked
  function getBookingForSlot(slotKey: string): CalendarBooking | undefined {
    return bookings.find(
      (b) => b.timeSlot === slotKey || b.timeSlot === "FULL_DAY"
    );
  }

  // Check if a specific slot is blacked out
  function isSlotBlackedOut(slotKey: string): BlackoutDateEntry | undefined {
    return blackouts.find(
      (b) => b.timeSlot === slotKey || b.timeSlot === null
    );
  }

  // Check for full day booking
  const fullDayBooking = bookings.find((b) => b.timeSlot === "FULL_DAY");
  const fullDayBlackout = blackouts.find((b) => b.timeSlot === null);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-indigo-600" />
            {selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : ""}
          </SheetTitle>
          <SheetDescription>
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} on this day
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {/* Full Day Blackout Warning */}
          {fullDayBlackout && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangleIcon className="size-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Full Day Blackout
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {fullDayBlackout.venue.name}
                  {fullDayBlackout.reason && ` - ${fullDayBlackout.reason}`}
                </p>
              </div>
            </div>
          )}

          {/* Full Day Booking */}
          {fullDayBooking && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase">
                  Full Day Booking
                </span>
                <StatusBadge
                  status={fullDayBooking.status}
                  colorMap={BOOKING_STATUS_COLORS}
                />
              </div>
              <Link
                href={`/bookings/${fullDayBooking.id}`}
                className="block hover:bg-zinc-50 -mx-1 px-1 rounded"
              >
                <p className="font-medium text-sm">{fullDayBooking.eventName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="size-3" />
                    {fullDayBooking.venue.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-3" />
                    {fullDayBooking.guestCount} guests
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* Time Slot Breakdown */}
          {!fullDayBooking && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold text-zinc-700">
                Time Slots
              </h3>
              <div className="space-y-3">
                {DISPLAY_SLOTS.map((slot) => {
                  const booking = getBookingForSlot(slot.key);
                  const blackout = isSlotBlackedOut(slot.key);
                  const isAvailable = !booking && !blackout && !fullDayBlackout;

                  return (
                    <div
                      key={slot.key}
                      className={cn(
                        "rounded-lg border p-3",
                        blackout && "border-red-200 bg-red-50/50",
                        isAvailable && "border-green-200 bg-green-50/30",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium">{slot.label}</span>
                          <span className="text-xs text-zinc-400 ml-2">
                            {slot.time}
                          </span>
                        </div>
                        {isAvailable && (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-700 border-green-200 text-xs"
                          >
                            Available
                          </Badge>
                        )}
                        {blackout && (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-700 border-red-200 text-xs"
                          >
                            Blocked
                          </Badge>
                        )}
                      </div>

                      {booking && (
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="block mt-2 hover:bg-white/50 -mx-1 px-1 rounded transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {booking.eventName}
                            </p>
                            <StatusBadge
                              status={booking.status}
                              colorMap={BOOKING_STATUS_COLORS}
                              className="text-[10px]"
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="size-3" />
                              {booking.venue.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <UsersIcon className="size-3" />
                              {booking.guestCount}
                            </span>
                            <span className="text-zinc-400">
                              {booking.bookingNumber}
                            </span>
                          </div>
                        </Link>
                      )}

                      {blackout && (
                        <p className="text-xs text-red-600 mt-1">
                          {blackout.venue.name}
                          {blackout.reason && ` - ${blackout.reason}`}
                        </p>
                      )}

                      {isAvailable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full text-xs h-8"
                          onClick={() => onBookSlot(slot.key)}
                        >
                          <PlusIcon className="mr-1.5 size-3" />
                          Quick Book
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* All bookings on this day (if any non-slot specific) */}
          {bookings.length > 0 && !fullDayBooking && (
            <>
              <Separator />
              <h3 className="text-sm font-semibold text-zinc-700">
                All Bookings ({bookings.length})
              </h3>
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{booking.eventName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                        <ClockIcon className="size-3" />
                        <span>
                          {TIME_SLOT_LABELS[booking.timeSlot]
                            ?.split("(")[0]
                            ?.trim() || booking.timeSlot}
                        </span>
                        <span>{booking.venue.name}</span>
                      </div>
                    </div>
                    <StatusBadge
                      status={booking.status}
                      colorMap={BOOKING_STATUS_COLORS}
                      className="text-[10px]"
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
