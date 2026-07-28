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
  BOOKING_STATUS_CLIENT_LABELS,
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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="My Bookings"
        description="Every event you've entrusted to us, past and upcoming."
      />

      {bookings.length === 0 ? (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <CalendarX className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Your first celebration awaits
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Bookings appear here the moment your date is held. Talk to us and
              we&apos;ll start planning.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Upcoming Bookings */}
          {upcomingBookings.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Upcoming events
                <span className="numeric text-muted-foreground/60">
                  {upcomingBookings.length}
                </span>
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </section>
          )}

          {/* Past Bookings */}
          {pastBookings.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Past events
                <span className="numeric text-muted-foreground/60">
                  {pastBookings.length}
                </span>
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} isPast />
                ))}
              </div>
            </section>
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
    <Link href={`/portal/bookings/${booking.id}`} className="block">
      <Card
        className={`group shadow-card hover:shadow-card-hover h-full overflow-hidden rounded-2xl py-0 transition-all duration-200 ${
          isPast ? "opacity-70 hover:opacity-100" : ""
        }`}
      >
        <CardContent className="p-0">
          {/* Date Strip */}
          <div
            className={`flex items-center gap-4 px-5 py-4 ${isPast ? "bg-muted/40" : "bg-primary/[0.05]"}`}
          >
            <div className="text-center">
              <p
                className={`numeric text-[26px] font-semibold leading-none ${isPast ? "text-muted-foreground/60" : "text-primary"}`}
              >
                {eventDate.getDate()}
              </p>
              <p
                className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${isPast ? "text-muted-foreground/60" : "text-primary/70"}`}
              >
                {eventDate.toLocaleDateString("en-IN", { month: "short" })}
              </p>
            </div>
            <div className="bg-border h-9 w-px" />
            <div className="min-w-0 flex-1">
              <p className="font-editorial text-foreground truncate text-[16px] font-semibold">
                {booking.eventName}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {booking.eventType}
              </p>
            </div>
            <StatusBadge
              status={booking.status}
              colorMap={BOOKING_STATUS_COLORS}
              label={BOOKING_STATUS_CLIENT_LABELS[booking.status]}
              className="text-[10px]"
            />
          </div>

          {/* Details */}
          <div className="space-y-2.5 border-t px-5 py-4">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <MapPin className="text-muted-foreground/50 size-3.5 flex-shrink-0" />
              <span className="truncate">{booking.venueName}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock className="text-muted-foreground/50 size-3.5 flex-shrink-0" />
              <span className="truncate">
                {TIME_SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Users className="text-muted-foreground/50 size-3.5 flex-shrink-0" />
                <span>
                  <span className="numeric">{booking.guestCount}</span> guests
                </span>
              </div>
              <span className="numeric text-foreground text-[15px] font-semibold">
                {formatINR(booking.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/25 flex items-center justify-between border-t px-5 py-2.5">
            <span className="numeric text-muted-foreground/60 text-[11px]">
              {booking.bookingNumber}
            </span>
            <span className="text-primary flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              View details
              <ArrowUpRight className="size-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
