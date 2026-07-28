import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, LayoutGridIcon, PlusIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getChart, createChart } from "@/actions/seating.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
        icon={LayoutGridIcon}
        accent="amber"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Floor plan</span>
            <span className="h-3 w-px bg-border" />
            <span className="numeric text-foreground/80">{booking.bookingNumber}</span>
          </div>
        }
        title="Seating Chart"
        description={`${booking.eventName} — tables, zones and who sits where.`}
      />

      {chart ? (
        <SeatingEditor bookingId={bookingId} chart={chart} />
      ) : (
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<LayoutGridIcon className="size-6" />}
              title="No seating chart yet"
              description="Lay out tables and zones, then assign guests so the floor team knows exactly where everyone sits."
              action={<CreateChartButton bookingId={bookingId} />}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
