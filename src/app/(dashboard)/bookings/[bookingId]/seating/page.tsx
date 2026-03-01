import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, LayoutGridIcon, PlusIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getChart, createChart } from "@/actions/seating.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeatingEditor } from "./_components/seating-editor";
import { CreateChartButton } from "./_components/seating-editor";

export const metadata: Metadata = { title: "Seating Chart" };

// ============================================================
// Seating Chart Page (Server Component)
// ============================================================

interface SeatingPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function SeatingPage({ params }: SeatingPageProps) {
  const { bookingId } = await params;

  const bookingResult = await getBooking(bookingId);
  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const chartResult = await getChart(bookingId);

  if (!chartResult.success) {
    notFound();
  }

  const chart = chartResult.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/bookings/${bookingId}`}>
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Booking
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Seating Chart"
        description={`${booking.eventName} - ${booking.bookingNumber}`}
      />

      {chart ? (
        <SeatingEditor bookingId={bookingId} chart={chart} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
              <LayoutGridIcon className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No Seating Chart Yet</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Create a seating chart to start arranging tables and assigning
              guests for this event.
            </p>
            <CreateChartButton bookingId={bookingId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
