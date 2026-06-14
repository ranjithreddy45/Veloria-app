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

import { getBookings } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { BookingsTable } from "./_components/bookings-table";

export const metadata: Metadata = { title: "Bookings" };

// ============================================================
// Bookings List Page
// ============================================================

export default async function BookingsPage() {
  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  const result = await getBookings({ limit: 500 });

  const bookings = result.success ? result.data.data : [];

  // ---- Summary metrics (derived from already-loaded rows only) ----
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // A booking still "in play" — anything that isn't cancelled or completed.
  const isActive = (s: string) => s !== "CANCELLED" && s !== "COMPLETED";

  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pendingCount = bookings.filter(
    (b) => b.status === "HOLD" || b.status === "TENTATIVE"
  ).length;

  const thisMonthBookings = bookings.filter((b) => {
    const d = new Date(b.date);
    return d >= monthStart && d < nextMonthStart && b.status !== "CANCELLED";
  });
  const thisMonthCount = thisMonthBookings.length;

  // Pipeline revenue across active bookings (excludes cancelled/completed).
  const activeRevenue = bookings
    .filter((b) => isActive(b.status))
    .reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  const hasData = bookings.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Operations · Calendar</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{bookings.length}</span> total
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
          <StatTile
            label="Confirmed"
            value={confirmedCount}
            accent="emerald"
            icon={<CalendarCheckIcon className="size-4" />}
            sub={`of ${bookings.length} bookings`}
          />
          <StatTile
            label="Awaiting confirmation"
            value={pendingCount}
            accent="amber"
            icon={<ClockIcon className="size-4" />}
            sub="on hold or tentative"
          />
          <StatTile
            label="This month"
            value={thisMonthCount}
            accent="indigo"
            icon={<CalendarRangeIcon className="size-4" />}
            sub="events scheduled"
          />
          <StatTile
            label="Active revenue"
            value={fmtCurrency(activeRevenue)}
            accent="violet"
            icon={<IndianRupeeIcon className="size-4" />}
            sub="across open bookings"
          />
        </div>
      )}

      <BookingsTable data={bookings} />
    </div>
  );
}
