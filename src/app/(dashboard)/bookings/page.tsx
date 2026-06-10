import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, CalendarIcon } from "lucide-react";

import { getBookings } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { BookingsTable } from "./_components/bookings-table";

export const metadata: Metadata = { title: "Bookings" };

// ============================================================
// Bookings List Page
// ============================================================

export default async function BookingsPage() {
  const result = await getBookings();

  const bookings = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Manage event bookings, venues, and scheduling."
        help={
          <HelpHint title="What is a Booking?">
            <p>
              A <strong>Booking</strong> is a <em>confirmed event</em> — a venue,
              date, and time slot reserved for a client, with the guest count and
              full commercials (per-plate, hall rental, decor, other services).
            </p>
            <p>
              Bookings usually come from a won <strong>Deal</strong>, and they
              power everything downstream: invoices, tasks, vendors, and
              operations. Each booking holds a slot so the venue can&rsquo;t be
              double-booked.
            </p>
            <p className="text-foreground/70">
              Flow: Contact → Lead → Deal → <strong>Booking</strong>.
            </p>
          </HelpHint>
        }
      >
        <Button variant="outline" asChild>
          <Link href="/bookings/calendar">
            <CalendarIcon className="mr-2 size-4" />
            Calendar
          </Link>
        </Button>
        <Button asChild>
          <Link href="/bookings/new">
            <PlusIcon className="mr-2 size-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>
      <BookingsTable data={bookings} />
    </div>
  );
}
