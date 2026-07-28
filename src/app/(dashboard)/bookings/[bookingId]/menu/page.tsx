import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, UtensilsCrossedIcon } from "lucide-react";

import { getBookingMenu, getMenuItems } from "@/actions/menu.actions";
import { getBooking } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MenuBuilder } from "./_components/menu-builder";

export const metadata: Metadata = { title: "Booking Menu" };

// ============================================================
// Booking Menu Builder Page
// ============================================================

interface BookingMenuPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function BookingMenuPage({
  params,
}: BookingMenuPageProps) {
  const { bookingId } = await params;

  // Fetch booking, booking menu, and all active menu items in parallel
  const [bookingResult, menuResult, itemsResult] = await Promise.all([
    getBooking(bookingId),
    getBookingMenu(bookingId),
    getMenuItems({ isActive: true, limit: 500 }),
  ]);

  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const bookingMenu = menuResult.success ? menuResult.data : null;
  const menuItems = itemsResult.success ? itemsResult.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UtensilsCrossedIcon}
        accent="emerald"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Food & beverage</span>
            <span className="h-3 w-px bg-border" />
            <span className="numeric text-foreground/80">{booking.bookingNumber}</span>
          </div>
        }
        title="Menu Builder"
        description={`${booking.eventName} — courses, counts and per-plate commercials.`}
      >
        <Button variant="outline" asChild>
          <Link href={`/bookings/${bookingId}`}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Booking
          </Link>
        </Button>
      </PageHeader>
      <MenuBuilder
        bookingId={bookingId}
        bookingGuestCount={booking.guestCount}
        bookingMenu={bookingMenu}
        menuItems={menuItems}
      />
    </div>
  );
}
