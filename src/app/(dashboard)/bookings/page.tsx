import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  CalendarIcon,
  CalendarCheckIcon,
  ClockIcon,
  CalendarRangeIcon,
  IndianRupeeIcon,
} from "lucide-react";

import { getBookings, getBookingStats } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingsTable } from "./_components/bookings-table";

export const metadata: Metadata = { title: "Bookings" };

// ============================================================
// Bookings List Page
// ============================================================

export default async function BookingsPage() {
  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  const [result, statsResult] = await Promise.all([
    getBookings({ limit: 500 }),
    getBookingStats(),
  ]);

  const bookings = result.success ? result.data.data : [];

  // ---- Headline metrics: DB-wide aggregates, not the 500-row slice ----
  // Summing the loaded rows would understate every KPI once the table grows
  // past the page ceiling, so the tiles read from getBookingStats instead.
  const stats = statsResult.success
    ? statsResult.data
    : {
        total: bookings.length,
        confirmedCount: 0,
        pendingCount: 0,
        thisMonthCount: 0,
        confirmedRevenue: 0,
        holdsValue: 0,
      };

  const totalCount = stats.total;
  const confirmedCount = stats.confirmedCount;
  const pendingCount = stats.pendingCount;
  const thisMonthCount = stats.thisMonthCount;
  const confirmedRevenue = stats.confirmedRevenue;
  const holdsValue = stats.holdsValue;

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  const hasData = totalCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        title="Bookings"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Operations · Calendar</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{totalCount}</span> total
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{confirmedCount}</span> confirmed
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{thisMonthCount}</span> this month
            </span>
          </div>
        }
        description="Manage event bookings, venues, and scheduling."
        help={
          <HelpHint title="What is a Booking?">
            <p>
              A <strong>Booking</strong> is a <em>confirmed event</em> — a venue,
              date, and time slot reserved for a client, with the guest count and
              full commercials (per-plate, hall rental, decor, other services).
            </p>
            <p>
              Bookings usually come from a won <strong>Deal</strong>, and they
              power everything downstream: invoices, tasks, vendors, and
              operations. Each booking holds a slot so the venue can&rsquo;t be
              double-booked.
            </p>
            <p className="text-foreground/70">
              Flow: Contact → Lead → Deal → <strong>Booking</strong>.
            </p>
          </HelpHint>
        }
      >
        <Button variant="outline" asChild>
          <Link href="/bookings/calendar">
            <CalendarIcon className="mr-2 size-4" />
            Calendar
          </Link>
        </Button>
        <Button asChild>
          <Link href="/bookings/new">
            <PlusIcon className="mr-2 size-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>

      {hasData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-rise-in animate-stagger-1">
          <StatTile
            label="Confirmed"
            value={confirmedCount}
            accent="emerald"
            icon={<CalendarCheckIcon className="size-4" />}
            sub={`of ${totalCount} bookings`}
          />
          <StatTile
            label="This month"
            value={thisMonthCount}
            accent="indigo"
            icon={<CalendarRangeIcon className="size-4" />}
            sub="events scheduled"
          />
          <StatTile
            label="Confirmed revenue"
            value={fmtCurrency(confirmedRevenue)}
            accent="violet"
            icon={<IndianRupeeIcon className="size-4" />}
            sub="Contracted — confirmed bookings"
          />
          <StatTile
            label="Pipeline / holds"
            value={fmtCurrency(holdsValue)}
            accent="amber"
            icon={<ClockIcon className="size-4" />}
            sub={`${pendingCount} on hold or tentative`}
          />
        </div>
      )}

      <div className="animate-rise-in animate-stagger-2">
        {bookings.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card shadow-premium">
            <EmptyState
              icon={<CalendarCheckIcon className="size-6" />}
              title="No bookings yet"
              description="A booking is a confirmed event — a venue, date, and slot reserved for a client. Create your first booking, or convert a won deal, to start filling the calendar."
              action={
                <Button asChild>
                  <Link href="/bookings/new">
                    <PlusIcon className="mr-2 size-4" />
                    New Booking
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <BookingsTable data={bookings} />
        )}
      </div>
    </div>
  );
}
