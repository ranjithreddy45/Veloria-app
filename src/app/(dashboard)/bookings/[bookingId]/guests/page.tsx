import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, UsersIcon, PlusIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getGuestList, createGuestList } from "@/actions/guest.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GuestManager } from "./_components/guest-manager";
import { CreateGuestListButton } from "./_components/guest-manager";

export const metadata: Metadata = { title: "Guest Management" };

// ============================================================
// Guest Management Page (Server Component)
// ============================================================

interface GuestPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function GuestPage({ params }: GuestPageProps) {
  const { bookingId } = await params;

  const bookingResult = await getBooking(bookingId);
  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const guestListResult = await getGuestList(bookingId);

  if (!guestListResult.success) {
    notFound();
  }

  const guestList = guestListResult.data;

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
        title="Guest Management"
        description={`${booking.eventName} - ${booking.bookingNumber}`}
      />

      {guestList ? (
        <GuestManager
          bookingId={bookingId}
          guestList={guestList}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
              <UsersIcon className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No Guest List Yet</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Create a guest list to start managing guests, RSVPs, and check-ins
              for this event.
            </p>
            <CreateGuestListButton bookingId={bookingId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
