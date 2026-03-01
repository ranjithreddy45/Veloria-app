import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CalendarClockIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getTimeline, createTimeline, getStaffForAssignment } from "@/actions/event-day.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { BOOKING_STATUS_COLORS } from "@/lib/constants";
import { serialize } from "@/lib/utils";
import { DayOfTimeline } from "./_components/day-of-timeline";
import { CreateTimelineButton } from "./_components/create-timeline-button";

export const metadata: Metadata = { title: "Day-of Timeline" };

// ============================================================
// Day-of Timeline Page
// ============================================================

interface DayOfPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function DayOfPage({ params }: DayOfPageProps) {
  const { bookingId } = await params;

  const [bookingResult, timelineResult, staffResult] = await Promise.all([
    getBooking(bookingId),
    getTimeline(bookingId),
    getStaffForAssignment(),
  ]);

  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const timeline = timelineResult.success ? timelineResult.data : null;
  const staff = staffResult.success ? staffResult.data : [];

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/bookings/${bookingId}`}>
          <ArrowLeftIcon className="mr-2 size-4" />
          Back to Booking
        </Link>
      </Button>

      {/* Header */}
      <PageHeader
        title="Day-of Timeline"
        description={`${booking.eventName} | ${booking.bookingNumber}`}
      >
        <StatusBadge
          status={booking.status}
          colorMap={BOOKING_STATUS_COLORS}
        />
      </PageHeader>

      {/* Content */}
      {timeline ? (
        <DayOfTimeline
          timeline={serialize(timeline)}
          bookingId={bookingId}
          eventName={booking.eventName}
          eventDate={booking.date as string}
          staff={serialize(staff)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <CalendarClockIcon className="text-muted-foreground mb-4 size-12" />
          <h2 className="text-lg font-semibold">No Timeline Yet</h2>
          <p className="text-muted-foreground mt-1 mb-6 text-sm text-center max-w-md">
            Create a day-of timeline to plan and manage event activities in
            real-time on the day of the event.
          </p>
          <CreateTimelineButton bookingId={bookingId} />
        </div>
      )}
    </div>
  );
}
