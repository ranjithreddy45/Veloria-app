"use client";

import { format } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
  MapPinIcon,
  AlertTriangleIcon,
  InboxIcon,
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

interface DayDetailPanelProps {
  selectedDay: Date | null;
  bookings: CalendarBooking[];
  blackouts: BlackoutDateEntry[];
  leads?: CalendarLead[];
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
  leads = [],
  onClose,
  onBookSlot,
}: DayDetailPanelProps) {
  const isOpen = selectedDay !== null;

  function leadName(l: CalendarLead): string {
    const n = [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ").trim();
    return n || l.contact?.company || l.title || "Enquiry";
  }

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
          <SheetTitle className="flex items-center gap-2 tracking-[-0.01em]">
            <CalendarIcon className="size-5 shrink-0 text-indigo-600" />
            {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : ""}
          </SheetTitle>
          <SheetDescription>
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
            {leads.length > 0 && ` · ${leads.length} enquir${leads.length !== 1 ? "ies" : "y"}`} on this day
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
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Full Day Booking
                </span>
                <StatusBadge
                  status={fullDayBooking.status}
                  colorMap={BOOKING_STATUS_COLORS}
                />
              </div>
              <Link
                href={`/bookings/${fullDayBooking.id}`}
                className="block hover:bg-accent/40 -mx-1 px-1 rounded"
              >
                <p className="font-medium text-sm">{fullDayBooking.eventName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="size-3" />
                    {fullDayBooking.venue.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-3" />
                    <span className="numeric">{fullDayBooking.guestCount}</span> guests
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* Time Slot Breakdown */}
          {!fullDayBooking && (
            <>
              <Separator />
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Time slots
                </h3>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  What is booked, blocked and still sellable on this date.
                </p>
              </div>
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
                          <span className="text-xs text-muted-foreground/70 ml-2">
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
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="size-3" />
                              {booking.venue.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <UsersIcon className="size-3" />
                              <span className="numeric">{booking.guestCount}</span>
                            </span>
                            <span className="numeric text-muted-foreground/70">
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
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                All bookings (<span className="numeric">{bookings.length}</span>)
              </h3>
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{booking.eventName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
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

          {/* Leads / enquiries received for this day */}
          {leads.length > 0 && (
            <>
              <Separator />
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-sky-700">
                <InboxIcon className="size-4" />
                Enquiries / leads (<span className="numeric">{leads.length}</span>)
              </h3>
              <p className="-mt-1 text-[13px] text-muted-foreground">
                Not booked yet — these customers have asked about this date.
              </p>
              <div className="space-y-2">
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-3 transition-colors hover:bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{leadName(lead)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {lead.slot && <span className="flex items-center gap-1"><ClockIcon className="size-3" />{lead.slot}</span>}
                        {lead.preferredVenue && <span className="flex items-center gap-1"><MapPinIcon className="size-3" />{lead.preferredVenue.name}</span>}
                        {typeof lead.guestCount === "number" && <span className="flex items-center gap-1"><UsersIcon className="size-3" />{lead.guestCount}</span>}
                        {lead.eventType && <span>{lead.eventType}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-sky-200 bg-sky-100 text-[10px] text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
                      {lead.status}
                    </Badge>
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
