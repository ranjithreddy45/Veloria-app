import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, CalendarIcon } from "lucide-react";

import { getBookings } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
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
