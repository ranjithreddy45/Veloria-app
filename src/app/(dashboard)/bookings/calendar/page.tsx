import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ListIcon } from "lucide-react";

import {
  getBookingsForCalendar,
  getBlackoutDates,
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

  const [bookingsResult, blackoutsResult] = await Promise.all([
    getBookingsForCalendar(month, year),
    getBlackoutDates({ month, year }),
  ]);

  const bookings = bookingsResult.success ? bookingsResult.data : [];
  const blackouts = blackoutsResult.success ? blackoutsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
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
        <Button asChild>
          <Link href="/bookings/new">
            <PlusIcon className="mr-2 size-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>
      <BookingCalendar
        initialBookings={bookings}
        initialBlackouts={blackouts}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  );
}
