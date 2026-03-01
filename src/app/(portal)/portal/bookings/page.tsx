import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  ArrowUpRight,
  CalendarX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalBookings } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  BOOKING_STATUS_COLORS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "My Bookings" };

// ============================================================
// Bookings List Page
// ============================================================

export default async function PortalBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const bookings = await getPortalBookings(session.user.id);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingBookings = bookings.filter(
    (b) => new Date(b.date) >= now && b.status !== "CANCELLED" && b.status !== "COMPLETED"
  );
  const pastBookings = bookings.filter(
    (b) => new Date(b.date) < now || b.status === "COMPLETED" || b.status === "CANCELLED"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Bookings"
        description="View and manage all your event bookings."
      />

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <CalendarX className="size-8 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No bookings yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Your bookings will appear here once they are created. Contact us to plan your next event.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Upcoming Bookings */}
          {upcomingBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming Events ({upcomingBookings.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </div>
          )}

          {/* Past Bookings */}
          {pastBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Past Events ({pastBookings.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} isPast />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Booking Card Component
// ============================================================

interface BookingCardProps {
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    date: Date | string;
    timeSlot: string;
    venueName: string;
    guestCount: number;
    status: string;
    totalAmount: number;
  };
  isPast?: boolean;
}

function BookingCard({ booking, isPast }: BookingCardProps) {
  const eventDate = new Date(booking.date);

  return (
    <Link href={`/portal/bookings/${booking.id}`}>
      <Card
        className={`group transition-all duration-200 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 ${
          isPast ? "opacity-75 hover:opacity-100" : ""
        }`}
      >
        <CardContent className="p-0">
          {/* Date Strip */}
          <div className={`flex items-center gap-3 rounded-t-xl px-5 py-3 ${isPast ? "bg-muted/50" : "bg-indigo-50/50 dark:bg-indigo-950/20"}`}>
            <div className="text-center">
              <p className={`text-2xl font-bold ${isPast ? "text-muted-foreground/60" : "text-indigo-600 dark:text-indigo-400"}`}>
                {eventDate.getDate()}
              </p>
              <p className={`text-xs font-medium uppercase ${isPast ? "text-muted-foreground/60" : "text-indigo-500 dark:text-indigo-400"}`}>
                {eventDate.toLocaleDateString("en-IN", { month: "short" })}
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {booking.eventName}
              </p>
              <p className="text-xs text-muted-foreground">{booking.eventType}</p>
            </div>
            <StatusBadge
              status={booking.status}
              colorMap={BOOKING_STATUS_COLORS}
              className="text-[10px]"
            />
          </div>

          {/* Details */}
          <div className="space-y-2.5 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 text-muted-foreground/60 flex-shrink-0" />
              <span className="truncate">{booking.venueName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-3.5 text-muted-foreground/60 flex-shrink-0" />
              <span className="truncate">
                {TIME_SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-3.5 text-muted-foreground/60 flex-shrink-0" />
                <span>{booking.guestCount} guests</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatINR(booking.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-5 py-2.5">
            <span className="text-xs text-muted-foreground/60">
              #{booking.bookingNumber}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
              View details
              <ArrowUpRight className="size-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
