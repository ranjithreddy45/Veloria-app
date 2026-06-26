"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarCheckIcon, CalendarClockIcon, MapPinIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================================
// Account events timeline — past vs upcoming corporate bookings (read-only)
// ============================================================

export interface AccountEvent {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  status: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  totalAmount: number;
  venue: { id: string; name: string } | null;
}

interface AccountEventsTimelineProps {
  past: AccountEvent[];
  upcoming: AccountEvent[];
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function EventRow({ ev }: { ev: AccountEvent }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
      <div className="min-w-0">
        <Link
          href={`/bookings/${ev.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {ev.eventName}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{ev.eventType}</span>
          <span>{format(new Date(ev.date), "dd MMM yyyy")}</span>
          <span>{ev.timeSlot}</span>
          {ev.venue && (
            <span className="inline-flex items-center gap-0.5">
              <MapPinIcon className="size-3" />
              {ev.venue.name}
            </span>
          )}
          <span>{ev.guestCount} pax</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-medium tabular-nums">{inr(ev.totalAmount)}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {ev.status}
        </div>
      </div>
    </li>
  );
}

export function AccountEventsTimeline({ past, upcoming }: AccountEventsTimelineProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClockIcon className="size-4 text-blue-600" />
            Upcoming events
            <span className="text-sm font-normal text-muted-foreground">
              ({upcoming.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming corporate events.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheckIcon className="size-4 text-emerald-600" />
            Past events
            <span className="text-sm font-normal text-muted-foreground">
              ({past.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past corporate events.</p>
          ) : (
            <ul className="space-y-2">
              {past.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
