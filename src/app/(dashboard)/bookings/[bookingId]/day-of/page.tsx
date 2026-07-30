import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CalendarClockIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getTimeline, createTimeline, getStaffForAssignment } from "@/actions/event-day.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={`/bookings/${bookingId}`}>
          <ArrowLeftIcon className="mr-2 size-4" />
          Back to booking
        </Link>
      </Button>

      {/* Header */}
      <PageHeader
        icon={CalendarClockIcon}
        accent="gold"
        title="Day-of Timeline"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Event day</span>
            <span className="h-3 w-px bg-border" />
            <span className="numeric text-foreground/80">
              {booking.bookingNumber}
            </span>
          </div>
        }
        description={`${booking.eventName} — the minute-by-minute run of show for the crew.`}
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
        <div className="rounded-2xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<CalendarClockIcon className="size-6" />}
            title="No run of show yet"
            description="Build a day-of timeline so the crew can follow — and tick off — every activity in real time on event day."
            action={<CreateTimelineButton bookingId={bookingId} />}
          />
        </div>
      )}
    </div>
  );
}
