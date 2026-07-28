import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, UsersIcon, PlusIcon } from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { getGuestList, createGuestList } from "@/actions/guest.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
        icon={UsersIcon}
        accent="cyan"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Guests</span>
            <span className="h-3 w-px bg-border" />
            <span className="numeric text-foreground/80">{booking.bookingNumber}</span>
          </div>
        }
        title="Guest Management"
        description={`${booking.eventName} — invitations, RSVPs and headcount.`}
      />

      {guestList ? (
        <GuestManager
          bookingId={bookingId}
          guestList={guestList}
        />
      ) : (
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<UsersIcon className="size-6" />}
              title="No guest list yet"
              description="Start a guest list to track invitations, RSVPs and check-ins for this event."
              action={<CreateGuestListButton bookingId={bookingId} />}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
