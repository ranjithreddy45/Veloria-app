import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getOperation, getStaffUsers } from "@/actions/operations.actions";
import { getBookingVendors } from "@/actions/vendor.actions";
import { Button } from "@/components/ui/button";
import { OperationsView } from "./_components/operations-view";
import { serialize } from "@/lib/utils";

export const metadata: Metadata = { title: "Event Operations" };

// ============================================================
// Operations Page
// ============================================================

interface OperationsPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function OperationsPage({ params }: OperationsPageProps) {
  const { bookingId } = await params;

  const [bookingResult, operationResult, staffResult, bookingVendorsResult] =
    await Promise.all([
      getBooking(bookingId),
      getOperation(bookingId),
      getStaffUsers(),
      getBookingVendors(bookingId),
    ]);

  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const operation = operationResult.success ? operationResult.data : null;
  const staffUsers = staffResult.success ? staffResult.data : [];
  const bookingVendors = bookingVendorsResult.success
    ? bookingVendorsResult.data
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/bookings/${booking.id}`}>
                <ArrowLeftIcon className="mr-1 size-4" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Event Operations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {booking.eventName} | {booking.bookingNumber}
          </p>
        </div>
      </div>

      {/* Operations Content */}
      <OperationsView
        booking={serialize({
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          eventName: booking.eventName,
          eventType: booking.eventType,
          date: booking.date,
          timeSlot: booking.timeSlot,
        })}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        operation={operation as any}
        staffUsers={staffUsers}
        bookingVendors={bookingVendors}
      />
    </div>
  );
}
