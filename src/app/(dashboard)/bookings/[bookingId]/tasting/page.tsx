import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, UtensilsIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getTastingsByBooking } from "@/actions/tasting.actions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { BOOKING_STATUS_COLORS } from "@/lib/constants";
import { TastingForm } from "./_components/tasting-form";
import { TastingList } from "./_components/tasting-list";

export const metadata: Metadata = { title: "Menu Tastings" };

// ============================================================
// Menu Tasting Scheduler Page
// ============================================================

interface TastingPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function TastingPage({ params }: TastingPageProps) {
  const { bookingId } = await params;

  // Fetch booking, tastings, and venues in parallel
  const [bookingResult, tastingsResult, venues] = await Promise.all([
    getBooking(bookingId),
    getTastingsByBooking(bookingId),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const tastings = tastingsResult.success ? tastingsResult.data : [];
  const serializedVenues = serialize(venues);

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
        title="Menu Tastings"
        description={`${booking.eventName} | ${booking.bookingNumber}`}
      >
        <StatusBadge
          status={booking.status}
          colorMap={BOOKING_STATUS_COLORS}
        />
      </PageHeader>

      {/* Schedule New Tasting Form */}
      <TastingForm
        bookingId={bookingId}
        contactId={booking.contact.id}
        venues={serializedVenues}
      />

      {/* Existing Tastings */}
      {tastings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UtensilsIcon className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Scheduled Tastings ({tastings.length})
            </h2>
          </div>
          <TastingList
            tastings={tastings}
            bookingId={bookingId}
            contactId={booking.contact.id}
            venues={serializedVenues}
          />
        </div>
      )}
    </div>
  );
}
