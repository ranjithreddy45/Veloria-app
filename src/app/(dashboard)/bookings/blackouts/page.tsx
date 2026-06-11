import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getBlackoutDates, getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  BlackoutManager,
  type BlackoutEntry,
  type BlackoutVenue,
} from "./_components/blackout-manager";

export const metadata: Metadata = { title: "Blackout Dates" };

// ============================================================
// Blackout Dates Page
// ============================================================

export default async function BlackoutsPage() {
  const [blackoutsResult, venuesResult] = await Promise.all([
    getBlackoutDates(),
    getVenues(),
  ]);

  const blackouts = (
    blackoutsResult.success ? blackoutsResult.data : []
  ) as BlackoutEntry[];

  const venues: BlackoutVenue[] = (
    venuesResult.success ? venuesResult.data : []
  )
    .filter((v: { isActive?: boolean }) => v.isActive !== false)
    .map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blackout Dates"
        description="Block venue dates so they can't be booked."
      >
        <Button variant="outline" asChild>
          <Link href="/bookings/calendar">
            <ArrowLeftIcon className="mr-2 size-4" />
            Calendar
          </Link>
        </Button>
      </PageHeader>

      <BlackoutManager blackouts={blackouts} venues={venues} />
    </div>
  );
}
