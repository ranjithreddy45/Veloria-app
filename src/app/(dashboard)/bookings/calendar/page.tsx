import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ListIcon, BanIcon } from "lucide-react";

import {
  getBookingsForCalendar,
  getLeadsForCalendar,
  getBlackoutDates,
  getVenues,
} from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { BookingCalendar } from "../_components/booking-calendar";

export const metadata: Metadata = { title: "Booking Calendar" };

// ============================================================
// Calendar View Page
// ============================================================

export default async function CalendarPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [bookingsResult, leadsResult, blackoutsResult, venuesResult] = await Promise.all([
    getBookingsForCalendar(month, year),
    getLeadsForCalendar(month, year),
    getBlackoutDates({ month, year }),
    getVenues(),
  ]);

  const bookings = bookingsResult.success ? bookingsResult.data : [];
  const leads = leadsResult.success ? leadsResult.data : [];
  const blackouts = blackoutsResult.success ? blackoutsResult.data : [];
  const venues = (venuesResult.success ? venuesResult.data : []).map(
    (v: { id: string; name: string }) => ({ id: v.id, name: v.name })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Bookings · Operations</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{bookings.length}</span> booking{bookings.length === 1 ? "" : "s"} this month
            </span>
          </div>
        }
        title="Booking Calendar"
        help={<PageHelp id="bookings-calendar" />}
        description="View and manage bookings in calendar format."
      >
        <Button variant="outline" asChild>
          <Link href="/bookings">
            <ListIcon className="mr-2 size-4" />
            List View
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/bookings/blackouts">
            <BanIcon className="mr-2 size-4" />
            Blackout Dates
          </Link>
        </Button>
        <Button asChild>
          <Link href="/bookings/new">
            <PlusIcon className="mr-2 size-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>
      <BookingCalendar
        initialBookings={bookings}
        initialLeads={leads}
        initialBlackouts={blackouts}
        venues={venues}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  );
}
